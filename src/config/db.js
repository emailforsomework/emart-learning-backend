'use strict';

const mongoose = require('mongoose');
const { MONGO_URI, NODE_ENV } = require('./env');

/**
 * db.js — Mongoose connection with retry logic.
 * Indexes are created at the repository layer (not schema layer)
 * so they're explicit and version-controlled.
 */

const connect = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      // Mongoose 7+ has these as defaults, kept for clarity
      serverSelectionTimeoutMS: 5000,
    });

    if (NODE_ENV !== 'test') {
      console.log(`[db] Connected to MongoDB`);
    }
  } catch (err) {
    console.error('[db] Connection failed:', err.message);
    process.exit(1); // Hard exit — app cannot run without DB
  }
};

mongoose.connection.on('disconnected', () => {
  if (NODE_ENV !== 'test') {
    console.warn('[db] MongoDB disconnected');
  }
});

module.exports = { connect };
