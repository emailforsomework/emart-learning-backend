'use strict';

const { v4: uuidv4 } = require('uuid');

const MIN_TOPIC_DURATION = 20; // minutes

/**
 * scheduleService.js — Smart backfill rescheduling algorithm.
 *
 * Unlike a naive "push missed topics to tomorrow" approach,
 * this distributes work across remaining days by available capacity.
 * Termination is guaranteed: loop is bounded by remainingDays × capacity.
 */

function getRemainingDays(schedule) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return schedule.filter((day) => {
    const d = new Date(day.date);
    d.setHours(0, 0, 0, 0);
    return d >= today;
  });
}

/**
 * smartReschedule
 *
 * @param {Object}   plan             - Full StudyPlan document
 * @param {Array}    missedTopics     - Array of TopicItem objects that were missed
 * @param {number}   dailyStudyHours
 * @returns {{ status, schedule, droppedTopics }}
 */
function smartReschedule(plan, missedTopics, dailyStudyHours) {
  const futureDays = getRemainingDays(plan.schedule);

  if (futureDays.length === 0) {
    return {
      status: 'EXAM_TOO_CLOSE',
      schedule: plan.schedule,
      droppedTopics: missedTopics.map((t) => ({ subject: t.subject, topic: t.topic })),
    };
  }

  // Step 1: Deduplicate by topicId (same topic missed multiple times)
  const seen = new Set();
  const deduped = missedTopics.filter((t) => {
    if (seen.has(t.topicId)) return false;
    seen.add(t.topicId);
    return true;
  });

  // Step 2: Sort by priority score descending (highest urgency first)
  const sorted = [...deduped].sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));

  const dailyCapacity = dailyStudyHours * 60;
  const queue = [...sorted];

  // Step 3: Fit missed topics into available capacity of future days
  const updatedSchedule = plan.schedule.map((day) => {
    const dayDate = new Date(day.date);
    dayDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dayDate < today || queue.length === 0) return day;

    const usedMinutes = day.topics.reduce((s, t) => s + (t.duration || 0), 0);
    let available = dailyCapacity - usedMinutes;
    const newTopics = [...day.topics];

    while (queue.length > 0 && available >= MIN_TOPIC_DURATION) {
      const topic = queue[0];
      if (topic.duration <= available) {
        newTopics.push({
          ...topic,
          topicId: uuidv4(),        // fresh UUID for the rescheduled slot
          isRescheduled: true,
          originalDate: topic.originalDate || day.date,
          status: 'pending',
        });
        available -= topic.duration;
        queue.shift();
      } else {
        break; // topic doesn't fit in this day's remaining capacity
      }
    }

    return { ...day, topics: newTopics };
  });

  // Step 4: Anything still in queue could not be placed
  const droppedTopics = queue.map((t) => ({ subject: t.subject, topic: t.topic }));

  return {
    status: droppedTopics.length > 0 ? 'PARTIAL' : 'SUCCESS',
    schedule: updatedSchedule,
    droppedTopics,
  };
}

module.exports = { smartReschedule, getRemainingDays };
