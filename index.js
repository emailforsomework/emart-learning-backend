'use strict';

const app = require('./src/app');
const { connect } = require('./src/config/db');

/**
 * Vercel Serverless Function — Entry Point
 * 
 * Unlike a traditional server, Vercel invokes this function on every request.
 * We ensure the database is connected before handling the request.
 */
let isConnected = false;

module.exports = async (req, res) => {
  if (!isConnected) {
    await connect();
    isConnected = true;
  }
  return app(req, res);
};
