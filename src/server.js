'use strict';

const { PORT } = require('./config/env');
const { connect } = require('./config/db');
const app = require('./app');

let isConnected = false;

// add middleware
app.use(async (req, res, next) => {
  if (!isConnected) {
    try {
      await connect();
      isConnected = true;
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('Error connecting to MongoDB:', error);
      return next(error);
    }
  }
  next();
});

// const serverPort = PORT || 5000;
// app.listen(serverPort, () => {
//   console.log(`[server] Listening on port ${serverPort}`);
// });

// do not use app.listen() in vercel
module.exports = app;
