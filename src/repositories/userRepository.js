'use strict';

const User = require('../models/User');

/**
 * userRepository — all DB calls for User documents.
 * Controllers/services never call User.find() directly.
 */

const findByEmail = (email) =>
  User.findOne({ email: email.toLowerCase() }).lean();

const findById = (id) =>
  User.findById(id).lean();

const findByIdWithToken = (id) =>
  User.findById(id).select('+refreshToken');

const create = (data) =>
  User.create(data);

const updateStreak = (userId, streakData) =>
  User.findByIdAndUpdate(userId, { $set: streakData }, { new: true }).lean();

const setRefreshToken = (userId, token) =>
  User.findByIdAndUpdate(userId, { $set: { refreshToken: token } });

const clearRefreshToken = (userId) =>
  User.findByIdAndUpdate(userId, { $set: { refreshToken: null } });

const incrementPlansCreated = (userId) =>
  User.findByIdAndUpdate(userId, { $inc: { 'stats.totalPlansCreated': 1 } });

module.exports = {
  findByEmail,
  findById,
  findByIdWithToken,
  create,
  updateStreak,
  setRefreshToken,
  clearRefreshToken,
  incrementPlansCreated,
};
