'use strict';

const { validationResult, body, param, query } = require('express-validator');

/**
 * validate.js — express-validator rule sets.
 * Usage: router.post('/path', validate.register, validate.run, handler)
 */

// ─── Run all rules and respond with 400 on failure ────────────────────────────
const run = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// ─── Auth rules ───────────────────────────────────────────────────────────────
const register = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
];

const login = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required'),
];

// ─── Plan rules ───────────────────────────────────────────────────────────────
const createPlan = [
  body('title').trim().notEmpty().withMessage('Plan title is required'),
  body('examDate')
    .isISO8601()
    .withMessage('examDate must be a valid ISO date')
    .custom((val) => {
      if (new Date(val) <= new Date()) {
        throw new Error('Exam date must be in the future');
      }
      return true;
    }),
  body('dailyStudyHours')
    .isFloat({ min: 1, max: 16 })
    .withMessage('dailyStudyHours must be between 1 and 16'),
  body('subjects')
    .isArray({ min: 1 })
    .withMessage('At least one subject is required'),
  body('subjects.*.name').trim().notEmpty().withMessage('Subject name required'),
  body('subjects.*.difficultyRating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('difficultyRating must be 1–5'),
];

const updateTopic = [
  param('planId').isMongoId().withMessage('Invalid planId'),
  param('topicId').notEmpty().withMessage('topicId is required'),
  body('status')
    .optional()
    .isIn(['pending', 'in-progress', 'completed', 'skipped'])
    .withMessage('Invalid status value'),
  body('confidence')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Confidence must be 1–5'),
];

const paginationQuery = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

module.exports = { run, register, login, createPlan, updateTopic, paginationQuery };
