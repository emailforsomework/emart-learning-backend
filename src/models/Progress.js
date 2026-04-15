'use strict';

const mongoose = require('mongoose');

/**
 * Progress — append-only audit log of daily study activity.
 *
 * Stores things NOT in StudyPlan:
 *  - actual session duration (may differ from scheduled)
 *  - pomodoro count
 *  - readiness score snapshot (for time-series charts)
 *  - topic status snapshot at time of logging
 *
 * topicsCompleted / topicsPending are NOT stored — they're derived
 * via aggregation on StudyPlan to avoid stale data.
 */
const ProgressSchema = new mongoose.Schema(
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
    date: { type: Date, required: true },
    sessionDurationMinutes: { type: Number, default: 0 }, // actual time spent
    pomodoroCount: { type: Number, default: 0 },
    readinessScore: { type: Number, default: 0 }, // point-in-time snapshot
    topicsSnapshot: [
      {
        topicId: { type: String, required: true },
        status: { type: String, required: true },
        confidence: { type: Number, default: null },
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

// Time-series indexes — critical for chart queries
ProgressSchema.index({ userId: 1, date: -1 });
ProgressSchema.index({ planId: 1, date: -1 });

module.exports = mongoose.model('Progress', ProgressSchema);
