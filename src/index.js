require('dotenv').config();
require('./utils/monitor');

const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());

// Simple debug logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static public files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
const webhookRouter = require('./routes/webhook');
const signupRouter = require('./routes/signup');
const bookingRouter = require('./routes/booking');
const stripeRouter = require('./routes/stripe');

// Mount routes
app.use('/webhook/sms', webhookRouter); // NOTE: route is /webhook/sms/sms  // Twilio SMS webhook → /webhook/sms
app.use('/webhook/stripe', stripeRouter); // Stripe webhook → /webhook/stripe
app.use('/api', signupRouter);
app.use('/api/booking', bookingRouter);

// Booking page — serve HTML for /book/:slug
app.get('/book/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'booking.html'));
});

// Success and cancel pages
app.get('/success', (req, res) => {
  res.send('<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f5f5f5"><div style="background:white;padding:40px;border-radius:16px;text-align:center;max-width:400px"><h2 style="color:#065f46">✓ Payment Successful!</h2><p style="color:#374151;margin:16px 0">Your Bookit account is now active. You\'ll receive a text shortly to set up your assistant.</p><a href="/" style="color:#2563eb">Back to home</a></div></body></html>');
});

app.get('/cancel', (req, res) => {
  res.send('<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f5f5f5"><div style="background:white;padding:40px;border-radius:16px;text-align:center;max-width:400px"><h2 style="color:#991b1b">Payment Cancelled</h2><p style="color:#374151;margin:16px 0">No worries. Your account has not been charged. You can sign up again anytime.</p><a href="/" style="color:#2563eb">Back to home</a></div></body></html>');
});

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Bookit running on port ' + PORT));