require('dotenv').config();

const express = require('express');
const app = express();

// Simple debug logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

const webhookRouter = require('./routes/webhook');

// Root route for testing
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Bookit API', time: new Date().toISOString() });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Routes
app.use('/webhook', webhookRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Bookit running on port ' + PORT));