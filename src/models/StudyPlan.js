'use strict';

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const TopicItemSchema = new mongoose.Schema(
  {
    topicId: { type: String, default: () => uuidv4() }, // UUID assigned at generation
    subject: { type: String, required: true },
    topic: { type: String, required: true },
    duration: { type: Number, required: true }, // planned minutes
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed', 'skipped'],
      default: 'pending',
    },
    skippedReason: { type: String, default: null },
    confidence: { type: Number, min: 1, max: 5, default: null },
    isRescheduled: { type: Boolean, default: false },
    originalDate: { type: Date, default: null }, // what day was this originally planned
    completedAt: { type: Date, default: null },
    priorityScore: { type: Number, default: 0 }, // stored at generation time
    isWeak: { type: Boolean, default: false },
  },
  { _id: false }
);

const DayBlockSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    phase: {
      type: String,
      enum: ['learning', 'revision', 'mock'],
      required: true,
    },
    topics: [TopicItemSchema],
  },
  { _id: false }
);

// ─── Main schema ──────────────────────────────────────────────────────────────

const StudyPlanSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: { type: String, required: true, trim: true },
    examDate: { type: Date, required: true },
    dailyStudyHours: { type: Number, required: true, min: 1, max: 16 },
    subjects: [
      {
        name: { type: String, required: true },
        isWeak: { type: Boolean, default: false },
        difficultyRating: { type: Number, min: 1, max: 5, default: 3 },
        topics: [{ type: String }], // sub-topics within this subject
        _id: false,
      },
    ],
    goal: {
      targetScore: { type: Number, default: null },
      targetPercentile: { type: Number, default: null },
    },
    status: {
      type: String,
      enum: ['active', 'archived', 'completed'],
      default: 'active',
    },
    isGenerating: { type: Boolean, default: false }, // concurrency lock
    schedule: [DayBlockSchema],
    totalTopics: { type: Number, default: 0 },
    emergencyMode: { type: Boolean, default: false },
    droppedTopics: [
      {
        subject: String,
        topic: String,
        _id: false,
      },
    ],
    warnings: [{ type: String }],
  },
  { timestamps: true }
);

// Compound indexes for most common query patterns
StudyPlanSchema.index({ userId: 1, status: 1 });
StudyPlanSchema.index({ userId: 1, examDate: 1 });

module.exports = mongoose.model('StudyPlan', StudyPlanSchema);
