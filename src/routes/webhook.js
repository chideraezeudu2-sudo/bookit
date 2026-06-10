const express = require('express');
const router = express.Router();
const { handleInbound } = require('../services/conversation');

const normalizePhone = (num) => {
  if (!num) return '';
  const cleaned = num.trim();
  return cleaned.startsWith('+') ? cleaned : '+' + cleaned;
};

router.post('/', express.urlencoded({ extended: false }), async (req, res) => {
  const From = normalizePhone(req.body.From);
  const To = normalizePhone(req.body.To);
  const Body = req.body.Body || '';
  
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
