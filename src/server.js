'use strict';

const { PORT } = require('./config/env');
const { connect } = require('./config/db');
const app = require('./app');

/**
 * server.js — Entry point.
 * DB must connect before the HTTP server begins accepting requests.
 */
const start = async () => {
  await connect();    // Hard-exits on failure (see db.js)

  app.listen(PORT, () => {
    console.log(`[server] Listening on port ${PORT}`);
  });
};

start();
