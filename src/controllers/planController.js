'use strict';

const planService    = require('../services/planService');
const planRepository = require('../repositories/planRepository');
const { smartReschedule } = require('../services/scheduleService');
const { buildRevisionSlots } = require('../services/adaptiveDifficultyService');
const { computeReadinessScore, getPlanStats, getDaysUntilExam } = require('../services/reportService');
const { v4: uuidv4 } = require('uuid');

// ─── GET /api/plans/active ────────────────────────────────────────────────────
const getActivePlan = async (req, res, next) => {
  try {
    const plan = await planRepository.findActiveByUser(req.user.id);
    if (!plan) return res.json({ success: true, plan: null });

    const readinessScore = computeReadinessScore(plan);
    const stats          = getPlanStats(plan);
    const daysUntilExam  = getDaysUntilExam(plan.examDate);

    res.json({ success: true, plan, readinessScore, stats, daysUntilExam });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/plans ──────────────────────────────────────────────────────────
const createPlan = async (req, res, next) => {
  try {
    const plan = await planService.createPlan(req.user.id, req.body);
    res.status(201).json({ success: true, plan });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/plans/:id ───────────────────────────────────────────────────────
const getPlanById = async (req, res, next) => {
  try {
    const plan = await planRepository.findByIdAndUser(req.params.id, req.user.id);
    if (!plan) {
      const err = new Error('Plan not found.'); err.statusCode = 404; err.code = 'NOT_FOUND';
      return next(err);
    }
    res.json({ success: true, plan });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/plans/:planId/topics/:topicId ─────────────────────────────────
const updateTopic = async (req, res, next) => {
  try {
    const { planId, topicId } = req.params;
    const { status, confidence, skippedReason } = req.body;

    const plan = await planRepository.findByIdAndUser(planId, req.user.id);
    if (!plan) {
      const err = new Error('Plan not found.'); err.statusCode = 404; err.code = 'NOT_FOUND';
      return next(err);
    }

    const patch = {};
    if (status) {
      patch.status = status;
      if (status === 'completed') patch.completedAt = new Date();
    }
    if (confidence != null) patch.confidence = confidence;
    if (skippedReason)      patch.skippedReason = skippedReason;

    await planRepository.updateTopicByTopicId(planId, topicId, patch);

    // If confidence is rated, inject ADE revision slots into future days
    if (confidence != null && status === 'completed') {
      const original = plan.schedule.flatMap((d) => d.topics).find((t) => t.topicId === topicId);
      if (original) {
        const revSlots = buildRevisionSlots(original, confidence, new Date());
        if (revSlots.length > 0) {
          // Insert revision slots into the next available future days
          const updatedSchedule = insertRevisionSlots(plan.schedule, revSlots, plan.dailyStudyHours);
          await planRepository.updateSchedule(planId, updatedSchedule);
        }
      }
    }

    const updated = await planRepository.findByIdAndUser(planId, req.user.id);
    const readinessScore = computeReadinessScore(updated);
    res.json({ success: true, readinessScore, stats: getPlanStats(updated) });
  } catch (err) {
    next(err);
  }
};

// Helper: insert ADE revision slots into the earliest future days with capacity
function insertRevisionSlots(schedule, revSlots, dailyStudyHours) {
  const capacity = dailyStudyHours * 60;
  const queue = [...revSlots];
  const today = new Date(); today.setHours(0, 0, 0, 0);

  return schedule.map((day) => {
    if (queue.length === 0) return day;
    const dd = new Date(day.date); dd.setHours(0, 0, 0, 0);
    if (dd <= today) return day;

    const used = day.topics.reduce((s, t) => s + (t.duration || 0), 0);
    let available = capacity - used;
    const newTopics = [...day.topics];

    while (queue.length > 0 && available >= queue[0].duration) {
      const slot = queue.shift();
      newTopics.push({ ...slot, topicId: uuidv4() });
      available -= slot.duration;
    }
    return { ...day, topics: newTopics };
  });
}

// ─── POST /api/plans/:planId/reschedule ───────────────────────────────────────
const reschedulePlan = async (req, res, next) => {
  try {
    const plan = await planRepository.findByIdAndUser(req.params.planId, req.user.id);
    if (!plan) {
      const err = new Error('Plan not found.'); err.statusCode = 404; err.code = 'NOT_FOUND';
      return next(err);
    }

    // Collect all missed (pending past-due) topics
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const missedTopics = plan.schedule
      .filter((day) => { const d = new Date(day.date); d.setHours(0,0,0,0); return d < today; })
      .flatMap((day) => day.topics.filter((t) => t.status === 'pending'));

    if (missedTopics.length === 0) {
      return res.json({ success: true, message: 'No missed topics to reschedule.', droppedTopics: [] });
    }

    const result = smartReschedule(plan, missedTopics, plan.dailyStudyHours);
    await planRepository.updateSchedule(plan._id, result.schedule);

    res.json({
      success: true,
      status: result.status,
      droppedTopics: result.droppedTopics,
      message: result.status === 'EXAM_TOO_CLOSE'
        ? 'Exam is too close — no remaining days to reschedule into.'
        : `Rescheduled successfully. ${result.droppedTopics.length} topic(s) could not be placed.`,
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/plans/:planId/archive ──────────────────────────────────────────
const archivePlan = async (req, res, next) => {
  try {
    const plan = await planRepository.archivePlan(req.params.planId, req.user.id);
    if (!plan) {
      const err = new Error('Plan not found.'); err.statusCode = 404; err.code = 'NOT_FOUND';
      return next(err);
    }
    res.json({ success: true, plan });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/plans/:id (update settings) ──────────────────────────────────
const updatePlanSettings = async (req, res, next) => {
  try {
    const allowed = ['dailyStudyHours', 'title'];
    const patch = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    }
    const plan = await planRepository.updateSettings(req.params.id, req.user.id, patch);
    res.json({ success: true, plan });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/plans/readiness ─────────────────────────────────────────────────
const getReadiness = async (req, res, next) => {
  try {
    const plan = await planRepository.findActiveByUser(req.user.id);
    if (!plan) return res.json({ success: true, readinessScore: 0, stats: null });

    const readinessScore = computeReadinessScore(plan);
    const stats          = getPlanStats(plan);
    const daysUntilExam  = getDaysUntilExam(plan.examDate);
    res.json({ success: true, readinessScore, stats, daysUntilExam });
  } catch (err) {
    next(err);
  }
};

module.exports = { getActivePlan, createPlan, getPlanById, updateTopic, reschedulePlan, archivePlan, updatePlanSettings, getReadiness };
