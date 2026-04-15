'use strict';

const Progress = require('../models/Progress');

const create = (data) =>
  Progress.create(data);

/**
 * Paginated progress history — prevents dumping 365 entries at once.
 * Default: last 14 days.
 */
const findByUser = (userId, { page = 1, limit = 14 } = {}) =>
  Progress.find({ userId })
    .sort({ date: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

const findByPlan = (planId, { page = 1, limit = 30 } = {}) =>
  Progress.find({ planId })
    .sort({ date: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

// Last N entries for chart (readiness score over time)
const findRecentByUser = (userId, n = 14) =>
  Progress.find({ userId })
    .sort({ date: -1 })
    .limit(n)
    .select('date readinessScore sessionDurationMinutes pomodoroCount')
    .lean();

const countByUser = (userId) =>
  Progress.countDocuments({ userId });

module.exports = {
  create,
  findByUser,
  findByPlan,
  findRecentByUser,
  countByUser,
};
