'use strict';

/**
 * env.js — Validated environment loader.
 * Throws immediately on startup if any required variable is missing.
 * This prevents silent misconfiguration in production.
 */

require('dotenv').config();

const REQUIRED = [
  'MONGO_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'CLIENT_ORIGIN',
];

for (const key of REQUIRED) {
  if (!process.env[key]) {
    throw new Error(
      `[env] Missing required environment variable: ${key}. ` +
      `Check your .env file or deployment config.`
    );
  }
}

module.exports = {
  NODE_ENV:           process.env.NODE_ENV || 'development',
  PORT:               parseInt(process.env.PORT, 10) || 5000,
  MONGO_URI:          process.env.MONGO_URI,
  JWT_ACCESS_SECRET:  process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRY:  process.env.JWT_ACCESS_EXPIRY  || '15m',
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '7d',
  CLIENT_ORIGIN:      process.env.CLIENT_ORIGIN,
};
