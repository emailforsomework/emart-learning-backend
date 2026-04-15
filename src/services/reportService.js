'use strict';

/**
 * reportService.js — Computes readiness score and weekly reports.
 *
 * Readiness score is DERIVED on read (not stored) to avoid stale data.
 * Progress.readinessScore stores a snapshot at session-log time for charts.
 */

/**
 * computeReadinessScore
 *
 * Formula:
 *  completionRate = completedTopics / totalTopics
 *  avgConfidence  = mean(confidence of completed topics) — 0 if unrated
 *  urgencyPenalty = daysUntilExam ≤ 3 ? 0.85 : 1.0
 *  score = (completionRate × 50 + avgConfidence/5 × 50) × urgencyPenalty
 *
 * Max = 100 (completionRate=1, avgConfidence=5, no urgency penalty)
 *
 * @param {Object} plan - StudyPlan document (with schedule)
 * @returns {number} score 0–100
 */
function computeReadinessScore(plan) {
  if (!plan || !plan.schedule || plan.schedule.length === 0) return 0;

  // Flatten all topics
  const allTopics       = plan.schedule.flatMap((day) => day.topics);
  const totalTopics     = allTopics.length;
  if (totalTopics === 0) return 0;

  const completedTopics = allTopics.filter((t) => t.status === 'completed');
  const completionRate  = completedTopics.length / totalTopics;

  // Average confidence only of completed+rated topics
  const ratedTopics    = completedTopics.filter((t) => t.confidence !== null);
  const avgConfidence  = ratedTopics.length > 0
    ? ratedTopics.reduce((s, t) => s + t.confidence, 0) / ratedTopics.length
    : 0;

  // Urgency penalty: if exam is ≤3 days away, incomplete topics hurt more
  const daysLeft      = Math.max(0, Math.ceil((new Date(plan.examDate) - new Date()) / 86400000));
  const urgencyFactor = daysLeft <= 3 ? 0.85 : 1.0;

  const score = (completionRate * 50 + (avgConfidence / 5) * 50) * urgencyFactor;
  return Math.round(Math.min(100, Math.max(0, score)));
}

/**
 * getPlanStats
 * Returns counts derived on read — never stored (avoids stale data).
 */
function getPlanStats(plan) {
  if (!plan || !plan.schedule) {
    return { total: 0, completed: 0, pending: 0, inProgress: 0, skipped: 0 };
  }

  const allTopics = plan.schedule.flatMap((day) => day.topics);

  return {
    total:      allTopics.length,
    completed:  allTopics.filter((t) => t.status === 'completed').length,
    pending:    allTopics.filter((t) => t.status === 'pending').length,
    inProgress: allTopics.filter((t) => t.status === 'in-progress').length,
    skipped:    allTopics.filter((t) => t.status === 'skipped').length,
  };
}

/**
 * getDaysUntilExam
 */
function getDaysUntilExam(examDate) {
  return Math.max(0, Math.ceil((new Date(examDate) - new Date()) / 86400000));
}

module.exports = { computeReadinessScore, getPlanStats, getDaysUntilExam };
