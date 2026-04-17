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
      lastTick: new Date(),
      duration,
      remainingSeconds: duration * 60,
      isRunning: true,
      status: 'active',
    });

    res.status(201).json({ success: true, session });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/pomodoro/active ──────────────────────────────────────────────────
const getActiveSession = async (req, res, next) => {
  try {
    const session = await PomodoroSession.findOne({
      userId: req.user.id,
      status: 'active',
    }).lean();

    if (!session) return res.json({ success: true, session: null });

    let remaining = session.remainingSeconds;
    if (session.isRunning) {
      const elapsedSinceLastTick = Math.floor((Date.now() - new Date(session.lastTick)) / 1000);
      remaining = Math.max(0, session.remainingSeconds - elapsedSinceLastTick);
    }

    res.json({ success: true, session: { ...session, remaining } });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/pomodoro/:id/toggle ───────────────────────────────────────────
const toggleSession = async (req, res, next) => {
  try {
    const { isRunning, remainingSeconds } = req.body;
    const session = await PomodoroSession.findOne({ _id: req.params.id, userId: req.user.id });

    if (!session) {
      const err = new Error('Session not found.'); err.statusCode = 404; err.code = 'NOT_FOUND';
      return next(err);
    }

    session.isRunning = isRunning;
    session.remainingSeconds = remainingSeconds;
    session.lastTick = new Date();
    await session.save();

    res.json({ success: true, session });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/pomodoro/:id/complete ─────────────────────────────────────────
const completeSession = async (req, res, next) => {
  try {
    const session = await PomodoroSession.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: { status: 'completed', isRunning: false, remainingSeconds: 0 } },
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

module.exports = { startSession, getActiveSession, toggleSession, completeSession };
