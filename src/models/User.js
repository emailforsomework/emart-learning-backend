'use strict';

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    timezone: { type: String, default: 'Asia/Kolkata' },
    preferences: {
      defaultStudyHours: { type: Number, default: 4, min: 1, max: 16 },
      reminderEnabled: { type: Boolean, default: false },
    },
    stats: {
      totalPlansCreated: { type: Number, default: 0 },
      longestStreak: { type: Number, default: 0 },
    },
    currentStreak: { type: Number, default: 0 },
    lastStudiedDate: { type: Date, default: null },
    refreshToken: { type: String, default: null }, // httpOnly rotation
  },
  { timestamps: true }
);

// Indexes (autoIndex=true by default in Mongoose)

module.exports = mongoose.model('User', UserSchema);
