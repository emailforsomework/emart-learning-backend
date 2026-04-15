'use strict';

const { PORT } = require('./config/env');
const { connect } = require('./config/db');
const app = require('./app');

let isConnected = false;

async function connectToMongoDB() {
  try {
    await connect();
    isConnected = true;
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  }
}

// add middleware
app.use((req, res, next) => {
  if (!isConnected) {
    connectToMongoDB();
  }
  next();
});

// const serverPort = PORT || 5000;
// app.listen(serverPort, () => {
//   console.log(`[server] Listening on port ${serverPort}`);
// });

// do not use app.listen() in vercel
module.exports = app;
