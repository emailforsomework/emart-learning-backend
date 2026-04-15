'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const { CLIENT_ORIGIN } = require('./config/env');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ─── Security headers ────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS — credentials required for httpOnly cookie flow ────────────────────
app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,               // Allow cookies to be sent cross-origin
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Rate limiting — auth endpoints only ─────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'RATE_LIMITED',
    message: 'Too many requests. Please try again in 15 minutes.',
  },
});
app.use('/api/auth', authLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
// Mounted in server.js after DB connection confirmed
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/plans', require('./routes/planRoutes'));
app.use('/api/progress', require('./routes/progressRoutes'));
app.use('/api/pomodoro', require('./routes/pomodoroRoutes'));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'Smart Learning Planner API is running' });
});

// ─── 404 handler (must be after all routes) ───────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    message: 'The requested endpoint does not exist.',
  });
});

// ─── Centralized error handler (must be last) ─────────────────────────────────
app.use(errorHandler);

module.exports = app;
