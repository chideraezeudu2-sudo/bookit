const express = require('express');
const router = express.Router();
const { handleInbound } = require('../services/conversation');

router.post('/sms', express.urlencoded({ extended: false }), async (req, res) => {
  const { From, To, Body } = req.body;
  
  console.log(`📨 SMS RECEIVED — From: ${From}, To: ${To}, Body: "${Body}"`);

  try {
    await handleInbound({ from: From, to: To, body: Body });
    console.log(`✅ SMS handled successfully`);
    res.set('Content-Type', 'text/xml');
    res.send('<Response></Response>');
  } catch (err) {
    console.error(`❌ Webhook error: ${err.message}`);
    console.error(err.stack);
    res.status(500).send('Error');
  }
});

module.exports = router;
