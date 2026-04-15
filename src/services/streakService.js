'use strict';

const { toZonedTime, format } = require('date-fns-tz');

/**
 * streakService.js — Timezone-aware streak tracking.
 *
 * Problem: user in IST (UTC+5:30) studying at 11:30 PM local
 * = next day in UTC → breaks streak if compared naively in UTC.
 *
 * Fix: compare dates in the user's local timezone.
 */

/**
 * toLocalDateString
 * Converts a UTC date to a YYYY-MM-DD string in the user's timezone.
 */
function toLocalDateString(date, timezone) {
  const zoned = toZonedTime(date, timezone);
  return format(zoned, 'yyyy-MM-dd', { timeZone: timezone });
}

/**
 * computeStreak
 * Determines new streak value and whether longestStreak should be updated.
 *
 * @param {Date|null} lastStudiedDate - User's lastStudiedDate (UTC)
 * @param {number}    currentStreak   - User's current streak count
 * @param {number}    longestStreak   - User's all-time longest streak
 * @param {string}    timezone        - User's IANA timezone (e.g. 'Asia/Kolkata')
 * @returns {{ newStreak, newLongest, lastStudiedDate }}
 */
function computeStreak(lastStudiedDate, currentStreak, longestStreak, timezone) {
  const todayStr = toLocalDateString(new Date(), timezone);

  if (!lastStudiedDate) {
    // First ever study session
    const newStreak = 1;
    return {
      newStreak,
      newLongest: Math.max(longestStreak, newStreak),
      lastStudiedDate: new Date(),
    };
  }

  const lastStr = toLocalDateString(new Date(lastStudiedDate), timezone);

  if (lastStr === todayStr) {
    // Already studied today — streak unchanged
    return {
      newStreak: currentStreak,
      newLongest: longestStreak,
      lastStudiedDate,
    };
  }

  // Was the last session yesterday (local time)?
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toLocalDateString(yesterday, timezone);

  const newStreak = lastStr === yesterdayStr ? currentStreak + 1 : 1;

  return {
    newStreak,
    newLongest: Math.max(longestStreak, newStreak),
    lastStudiedDate: new Date(),
  };
}

module.exports = { computeStreak, toLocalDateString };
