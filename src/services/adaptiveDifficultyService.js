'use strict';

/**
 * adaptiveDifficultyService.js
 *
 * Rule-based spaced repetition — no ML, no third-party library.
 * Based on Ebbinghaus forgetting curve: weaker topics reviewed sooner.
 *
 * When a user rates confidence after completing a topic, this service
 * returns how many revision sessions to schedule and when.
 */

const REVISION_RULES = {
  1: { sessions: 3, durationMinutes: 45, delayDays: 2 },  // very weak
  2: { sessions: 2, durationMinutes: 30, delayDays: 2 },  // weak
  3: { sessions: 1, durationMinutes: 20, delayDays: 5 },  // average
  4: { sessions: 1, durationMinutes: 10, delayDays: 10 }, // strong
  5: { sessions: 0, durationMinutes: 0,  delayDays: 0 },  // mastered — skip
};

/**
 * getRevisionPlan
 * Returns the revision schedule rule for a given confidence level.
 *
 * @param {number} confidence - 1 to 5
 * @returns {{ sessions, durationMinutes, delayDays }}
 */
function getRevisionPlan(confidence) {
  const level = Math.round(Math.max(1, Math.min(5, confidence)));
  return REVISION_RULES[level];
}

/**
 * buildRevisionSlots
 * Given a topic and confidence rating, returns an array of revision TopicItems
 * to be inserted into future days.
 *
 * @param {Object} topic      - Original TopicItem (with subject, topic, topicId, etc.)
 * @param {number} confidence - 1 to 5
 * @param {Date}   fromDate   - Start date to offset revision from (usually today)
 * @returns {Array}           - Array of TopicItem-shaped objects
 */
function buildRevisionSlots(topic, confidence, fromDate = new Date()) {
  const { sessions, durationMinutes, delayDays } = getRevisionPlan(confidence);
  if (sessions === 0) return []; // mastered — no revision needed

  const slots = [];
  for (let i = 0; i < sessions; i++) {
    const revDate = new Date(fromDate);
    revDate.setDate(revDate.getDate() + delayDays * (i + 1)); // spaced gaps
    revDate.setHours(0, 0, 0, 0);

    slots.push({
      subject: topic.subject,
      topic: topic.topic,
      isWeak: confidence <= 2,
      difficultyRating: topic.difficultyRating || 3,
      confidence: null, // reset — user will re-rate after revision
      duration: durationMinutes,
      status: 'pending',
      isRescheduled: true,
      originalDate: revDate,
      completedAt: null,
      priorityScore: topic.priorityScore || 0,
    });
  }

  return slots;
}

module.exports = { getRevisionPlan, buildRevisionSlots, REVISION_RULES };
