'use strict';

const mongoose = require('mongoose');

/**
 * PomodoroSession — server-side session state.
 * Enables multi-device support: any device queries /api/pomodoro/active
 * and picks up the running timer from startTime + duration.
 */
const PomodoroSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudyPlan',
      required: true,
    },
    topicId: { type: String, required: true }, // UUID of TopicItem
    topicName: { type: String },
    subjectName: { type: String },
    startTime: { type: Date, required: true },
    duration: { type: Number, default: 25 }, // planned minutes (25 = standard pomodoro)
    status: {
      type: String,
      enum: ['active', 'completed', 'abandoned'],
      default: 'active',
    },
  },
  { timestamps: true }
);

PomodoroSessionSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('PomodoroSession', PomodoroSessionSchema);
