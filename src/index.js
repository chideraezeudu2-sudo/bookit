require('dotenv').config();

const express = require('express');
const app = express();

// Debug logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

const webhookRouter = require('./routes/webhook');
const signupRouter = require('./routes/signup');
const stripeRouter = require('./routes/stripe');
const healthRouter = require('./routes/health');
const { startScheduler } = require('./services/scheduler');
const { alertOwner } = require('./utils/monitor');

// Root route for testing
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Bookit API', time: new Date().toISOString() });
});

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

// Start scheduler (disabled for testing)
if (process.env.ENABLE_SCHEDULER === 'true') {
  startScheduler();
  console.log('Scheduler started');
} else {
  console.log('Scheduler disabled (set ENABLE_SCHEDULER=true to enable)');
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Bookit running on port ' + PORT));