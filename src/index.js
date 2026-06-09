require('dotenv').config();

const express = require('express');
const app = express();

// Simple debug logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const webhookRouter = require('./routes/webhook');
const signupRouter = require('./routes/signup');
const bookingRouter = require('./routes/booking');
const stripeRouter = require('./routes/stripe');

// Mount routes
app.use('/webhook', webhookRouter);
app.use('/webhook', stripeRouter); // Stripe webhook at /webhook/stripe
app.use('/api', signupRouter);
app.use('/api', bookingRouter);

// Root route for testing
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Bookit API v2', time: new Date().toISOString() });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Start the scheduler
const { startScheduler } = require('./services/scheduler');
startScheduler();

// Error handling
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // In production, would alert via SMS
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Bookit running on port ' + PORT));