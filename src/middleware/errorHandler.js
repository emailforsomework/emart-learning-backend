'use strict';

const { NODE_ENV } = require('../config/env');

/**
 * errorHandler.js — Centralized Express error middleware.
 *
 * Distinguishes operational errors (user's fault, 4xx) from
 * programmer errors (bugs, 5xx).
 *
 * Usage in controllers:
 *   const err = new Error('Exam date must be in the future');
 *   err.statusCode = 400;
 *   err.code = 'INVALID_DATE';
 *   return next(err);
 *
 * Contract: all error responses follow the shape:
 *   { success: false, code: string, message: string }
 */

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const code       = err.code       || 'INTERNAL_ERROR';
  const message    = err.message    || 'An unexpected error occurred.';

  // Only expose stack trace in dev
  const response = {
    success: false,
    code,
    message,
    ...(NODE_ENV === 'development' && { stack: err.stack }),
  };

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
