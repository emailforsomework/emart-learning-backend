'use strict';

const PomodoroSession = require('../models/PomodoroSession');
const planRepository  = require('../repositories/planRepository');

// ─── POST /api/pomodoro/start ──────────────────────────────────────────────────
const startSession = async (req, res, next) => {
  try {
    const { planId, topicId, topicName, subjectName, duration = 25 } = req.body;

    const plan = await planRepository.findByIdAndUser(planId, req.user.id);
    if (!plan) {
      const err = new Error('Plan not found.'); err.statusCode = 404; err.code = 'NOT_FOUND';
      return next(err);
    }

    // Abandon any existing active sessions
    await PomodoroSession.updateMany(
      { userId: req.user.id, status: 'active' },
      { $set: { status: 'abandoned' } }
    );

    const session = await PomodoroSession.create({
      userId: req.user.id,
      planId,
      topicId,
      topicName,
      subjectName,
      startTime: new Date(),
      duration,
      status: 'active',
    });

    res.status(201).json({ success: true, session });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/pomodoro/active ──────────────────────────────────────────────────
// Enables any device to resume the running timer
const getActiveSession = async (req, res, next) => {
  try {
    const session = await PomodoroSession.findOne({
      userId: req.user.id,
      status: 'active',
    }).lean();

    if (!session) return res.json({ success: true, session: null });

    // Compute elapsed and remaining seconds
    const elapsed   = Math.floor((Date.now() - new Date(session.startTime)) / 1000);
    const remaining = Math.max(0, session.duration * 60 - elapsed);

    res.json({ success: true, session: { ...session, elapsed, remaining } });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/pomodoro/:id/complete ─────────────────────────────────────────
const completeSession = async (req, res, next) => {
  try {
    const session = await PomodoroSession.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: { status: 'completed' } },
      { new: true }
    ).lean();

    if (!session) {
      const err = new Error('Session not found.'); err.statusCode = 404; err.code = 'NOT_FOUND';
      return next(err);
    }

    res.json({ success: true, session });
  } catch (err) {
    next(err);
  }
};

module.exports = { startSession, getActiveSession, completeSession };
