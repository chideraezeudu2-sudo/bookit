require('dotenv').config();

const express = require('express');
const app = express();

const webhookRouter = require('./routes/webhook');
const signupRouter = require('./routes/signup');
const stripeRouter = require('./routes/stripe');
const healthRouter = require('./routes/health');
const { startScheduler } = require('./services/scheduler');
const { alertOwner } = require('./utils/monitor');

// Error monitoring
process.on('uncaughtException', async (err) => {
  console.error('Uncaught exception:', err);
  await alertOwner('Uncaught exception: ' + err.message);
});

process.on('unhandledRejection', async (reason) => {
  console.error('Unhandled rejection:', reason);
  await alertOwner('Unhandled rejection: ' + reason);
});

// Routes
app.use('/webhook', webhookRouter);
app.use('/api', signupRouter);
app.use('/webhook', stripeRouter);
app.use(healthRouter);

// Start scheduler
startScheduler();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Bookit running on port ' + PORT));