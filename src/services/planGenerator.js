'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * planGenerator.js — Pure function. Zero I/O. Fully unit-testable.
 *
 * Input:  { examDate, dailyStudyHours, subjects, goal }
 * Output: { schedule, droppedTopics, emergencyMode, warnings, totalTopics }
 *
 * subjects: [{ name, isWeak, difficultyRating (1-5), topics: [String] }]
 * If subject.topics is empty, the subject name itself is the single topic.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const WEIGHTS = { weak: 0.40, urgency: 0.25, difficulty: 0.20, confidence: 0.15 };
const MIN_TOPIC_DURATION = 20; // minutes
const MAX_TOPIC_DURATION = 120; // cap at 2 hours

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysUntilDate(examDate) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exam = new Date(examDate);
  exam.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((exam - now) / (1000 * 60 * 60 * 24)));
}

function dateOffset(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * computePriorityScore
 * PS = W_weak×IsWeak + W_urgency×(1/daysLeft) + W_difficulty×normDiff - W_confidence×normConf
 * All weights sum to 1.0.
 */
function computePriorityScore({ isWeak, difficultyRating, confidence, daysLeft }) {
  const normDiff = (difficultyRating - 1) / 4;              // 1–5 → 0–1
  const normConf = confidence != null ? (confidence - 1) / 4 : 0.5; // default mid
  const urgency  = 1 / Math.max(daysLeft, 1);

  const rawScore = (
    WEIGHTS.weak       * (isWeak ? 1 : 0) +
    WEIGHTS.urgency    * urgency +
    WEIGHTS.difficulty * normDiff -
    WEIGHTS.confidence * normConf
  );

  return Math.max(0.01, rawScore);
}

/**
 * Expand subjects into flat list of TopicItems with priority scores.
 * allWeak=true → drop weak term (all cancel out, fallback to urgency-only).
 */
function flattenTopics(subjects, daysLeft, allWeak = false) {
  const items = [];
  for (const subject of subjects) {
    const topicList =
      subject.topics && subject.topics.length > 0 ? subject.topics : [subject.name];

    for (const topicName of topicList) {
      const ps = computePriorityScore({
        isWeak: allWeak ? false : subject.isWeak,
        difficultyRating: subject.difficultyRating || 3,
        confidence: null,
        daysLeft,
      });

      items.push({
        topicId: uuidv4(),
        subject: subject.name,
        topic: topicName,
        isWeak: subject.isWeak || false,
        difficultyRating: subject.difficultyRating || 3,
        confidence: null,
        priorityScore: ps,
        status: 'pending',
        isRescheduled: false,
        originalDate: null,
        completedAt: null,
      });
    }
  }
  return items;
}

/**
 * Fill days greedily from a topic queue.
 * Enforces min 1 topic per day even if topic exceeds daily capacity.
 */
function fillDays(queue, numDays, dailyCapacity, phase, dayOffset) {
  const schedule = [];
  let offset = dayOffset;

  for (let d = 0; d < numDays; d++) {
    if (queue.length === 0) break;

    const dayTopics = [];
    let used = 0;

    while (queue.length > 0) {
      const next = queue[0];
      if (used + next.duration <= dailyCapacity) {
        dayTopics.push(queue.shift());
        used += next.duration;
      } else if (dayTopics.length === 0) {
        // Min 1 topic/day rule — even if it busts the cap
        dayTopics.push(queue.shift());
        break;
      } else {
        break;
      }
    }

    if (dayTopics.length > 0) {
      schedule.push({ date: dateOffset(offset), phase, topics: dayTopics });
    }
    offset++;
  }

  return { schedule, nextDayOffset: offset };
}

// ─── Main export ──────────────────────────────────────────────────────────────

function generatePlan({ examDate, dailyStudyHours, subjects }) {
  const daysLeft = daysUntilDate(examDate);
  const warnings = [];

  // ── EDGE CASE: exam is today or tomorrow ──────────────────────────────────
  if (daysLeft <= 1) {
    const allTopics = flattenTopics(subjects, daysLeft);
    allTopics.sort((a, b) => b.priorityScore - a.priorityScore);
    const top3     = allTopics.slice(0, 3);
    const dropped  = allTopics.slice(3);
    warnings.push('EMERGENCY_MODE: Exam is tomorrow. Showing top 3 priority topics only.');
    return {
      schedule: [{ date: dateOffset(0), phase: 'revision', topics: top3 }],
      droppedTopics: dropped.map((t) => ({ subject: t.subject, topic: t.topic })),
      emergencyMode: true,
      warnings,
      totalTopics: top3.length,
    };
  }

  // ── Normal flow ───────────────────────────────────────────────────────────
  const allWeak  = subjects.length > 0 && subjects.every((s) => s.isWeak);
  const allTopics = flattenTopics(subjects, daysLeft, allWeak);
  allTopics.sort((a, b) => b.priorityScore - a.priorityScore);

  if (allWeak) {
    warnings.push('All subjects marked weak — falling back to urgency-only priority.');
  }

  // ── Time allocation ───────────────────────────────────────────────────────
  const totalMinutes   = daysLeft * dailyStudyHours * 60;
  const planningMinutes = totalMinutes * 0.80; // 20% ring-fenced for mock/revision days
  const dailyCapacity  = dailyStudyHours * 60;

  const sumPS = allTopics.reduce((s, t) => s + t.priorityScore, 0) || 1;

  // Assign proportional duration — bounded between MIN and MAX
  for (const topic of allTopics) {
    topic.duration = Math.min(
      MAX_TOPIC_DURATION,
      Math.max(MIN_TOPIC_DURATION, Math.round((topic.priorityScore / sumPS) * planningMinutes))
    );
  }

  // ── Drop lowest-PS topics if total time exceeds budget ────────────────────
  let runningTotal = 0;
  const schedulable   = [];
  const droppedTopics = [];

  for (const topic of allTopics) { // already sorted PS desc
    if (runningTotal + topic.duration <= planningMinutes) {
      schedulable.push(topic);
      runningTotal += topic.duration;
    } else {
      droppedTopics.push({ subject: topic.subject, topic: topic.topic });
    }
  }

  if (droppedTopics.length > 0) {
    warnings.push(`${droppedTopics.length} topic(s) dropped — not enough time before exam.`);
  }

  // ── Phase boundaries ──────────────────────────────────────────────────────
  const learningDays = Math.max(1, Math.floor(daysLeft * 0.60));
  const revisionDays = Math.max(1, Math.floor(daysLeft * 0.20));
  const mockDays     = daysLeft - learningDays - revisionDays;

  // ── Phase 1: Learning ─────────────────────────────────────────────────────
  const learningQueue = [...schedulable];
  const { schedule: learnSched, nextDayOffset: afterLearn } = fillDays(
    learningQueue, learningDays, dailyCapacity, 'learning', 0
  );

  // ── Phase 2: Revision ─────────────────────────────────────────────────────
  // Only weak or initially-unrated topics (confidence null = unknown risk)
  const revPool = schedulable.filter((t) => t.isWeak);
  // If nothing qualifies, fall back to bottom 30% by PS (lowest confidence)
  const effectiveRevPool =
    revPool.length > 0 ? revPool : schedulable.slice(-Math.ceil(schedulable.length * 0.3));

  // Shorten revision sessions (30 min cap per topic)
  const revQueue = effectiveRevPool.map((t) => ({
    ...t,
    topicId: uuidv4(), // new UUID — this is a separate revision visit
    duration: Math.min(t.duration, 30),
    originalDate: dateOffset(0),
  }));

  const { schedule: revSched, nextDayOffset: afterRev } = fillDays(
    revQueue, revisionDays, dailyCapacity, 'revision', afterLearn
  );

  // ── Phase 3: Mock ─────────────────────────────────────────────────────────
  const mockSchedule = [];
  const mockPerDay   = Math.min(schedulable.length, Math.floor(dailyCapacity / 10));

  for (let d = 0; d < mockDays; d++) {
    const mockTopics = schedulable.slice(0, mockPerDay).map((t) => ({
      ...t,
      topicId: uuidv4(),
      duration: 10, // quick touch-up
      status: 'pending',
    }));
    if (mockTopics.length > 0) {
      mockSchedule.push({ date: dateOffset(afterRev + d), phase: 'mock', topics: mockTopics });
    }
  }

  const schedule = [...learnSched, ...revSched, ...mockSchedule];
  const totalTopics = schedule.reduce((sum, day) => sum + day.topics.length, 0);

  return { schedule, droppedTopics, emergencyMode: false, warnings, totalTopics };
}

module.exports = { generatePlan, computePriorityScore, flattenTopics, WEIGHTS };
