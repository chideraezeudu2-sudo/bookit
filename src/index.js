require('dotenv').config();
require('./utils/monitor');

const express = require('express');
const cors = require('cors');
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

// Routes
const webhookRouter = require('./routes/webhook');
const signupRouter = require('./routes/signup');
const bookingRouter = require('./routes/booking');
const stripeRouter = require('./routes/stripe');
const supabase = require('./db/supabase');

// Mount routes
app.use('/webhook', webhookRouter);
app.use('/webhook', stripeRouter); // Stripe webhook at /webhook/stripe
app.use('/api', signupRouter);
app.use('/api/booking', bookingRouter);

// Root route for testing
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Bookit API v2', time: new Date().toISOString() });
});

// Debug endpoint to test Supabase connection
app.get('/debug/supabase', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('contractors')
      .select('id, business_name')
      .eq('id', '11ec789f-2ae4-4249-b95f-d33ceb9d9d52')
      .single();
    res.json({ success: true, data, error });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
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