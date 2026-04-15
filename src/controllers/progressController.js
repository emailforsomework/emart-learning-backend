'use strict';

const progressRepository = require('../repositories/progressRepository');
const planRepository     = require('../repositories/planRepository');
const { computeReadinessScore } = require('../services/reportService');
const { computeStreak }         = require('../services/streakService');
const userRepository            = require('../repositories/userRepository');

// ─── POST /api/progress ───────────────────────────────────────────────────────
const logSession = async (req, res, next) => {
  try {
    const { planId, sessionDurationMinutes, pomodoroCount } = req.body;

    const plan = await planRepository.findByIdAndUser(planId, req.user.id);
    if (!plan) {
      const err = new Error('Plan not found.'); err.statusCode = 404; err.code = 'NOT_FOUND';
      return next(err);
    }

    // Snapshot of current topic states for the chart
    const topicsSnapshot = plan.schedule
      .flatMap((day) => day.topics)
      .map(({ topicId, status, confidence }) => ({ topicId, status, confidence }));

    const readinessScore = computeReadinessScore(plan);

    const entry = await progressRepository.create({
      userId: req.user.id,
      planId,
      date: new Date(),
      sessionDurationMinutes: sessionDurationMinutes || 0,
      pomodoroCount: pomodoroCount || 0,
      readinessScore,
      topicsSnapshot,
    });

    // Update streak (timezone-aware)
    const user = await userRepository.findById(req.user.id);
    const { newStreak, newLongest, lastStudiedDate } = computeStreak(
      user.lastStudiedDate, user.currentStreak, user.stats.longestStreak, user.timezone
    );
    await userRepository.updateStreak(user._id, {
      currentStreak: newStreak,
      lastStudiedDate,
      'stats.longestStreak': newLongest,
    });

    res.status(201).json({ success: true, entry, readinessScore, newStreak });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/progress ────────────────────────────────────────────────────────
const getProgress = async (req, res, next) => {
  try {
    const { page = 1, limit = 14 } = req.query;
    const entries = await progressRepository.findByUser(req.user.id, { page, limit });
    const total   = await progressRepository.countByUser(req.user.id);
    res.json({ success: true, entries, pagination: { page, limit, total } });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/progress/readiness-history ─────────────────────────────────────
const getReadinessHistory = async (req, res, next) => {
  try {
    const entries = await progressRepository.findRecentByUser(req.user.id, 14);
    // Reverse to chronological order for charts
    res.json({ success: true, history: entries.reverse() });
  } catch (err) {
    next(err);
  }
};

module.exports = { logSession, getProgress, getReadinessHistory };
