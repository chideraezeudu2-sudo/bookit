const express = require('express');
const router = express.Router();
const { handleInbound } = require('../services/conversation');
const { alertOwner } = require('../utils/monitor');

const normalizePhone = (num) => {
  if (!num) return '';
  const cleaned = num.trim();
  return cleaned.startsWith('+') ? cleaned : '+' + cleaned;
};

// Idempotency protection - prevent duplicate webhook processing
const processedSids = new Set();

router.post('/', express.urlencoded({ extended: false }), async (req, res) => {
  const From = normalizePhone(req.body.From);
  const To = normalizePhone(req.body.To);
  const Body = req.body.Body || '';
  const sid = req.body.MessageSid;

  // Check for duplicate webhook
  if (sid && processedSids.has(sid)) {
    console.log(`Duplicate webhook ignored for SID: ${sid}`);
    res.set('Content-Type', 'text/xml');
    res.send('<Response></Response>');
    return;
  }

  // Track this SID
  if (sid) processedSids.add(sid);
  // Clean up old SIDs every 1000 entries
  if (processedSids.size > 1000) processedSids.clear();

  console.log(`SMS RECEIVED — From: ${From}, To: ${To}, Body: "${Body}"`);

  try {
    await handleInbound({ from: From, to: To, body: Body });
    console.log(`SMS handled successfully`);
    res.set('Content-Type', 'text/xml');
    res.send('<Response></Response>');
  } catch (err) {
    console.error(`Webhook error: ${err.message}`);
    console.error(err.stack);
    try {
      await alertOwner(`Webhook processing failed: ${err.message}`, `From: ${From}, Body: ${Body.slice(0, 100)}`);
    } catch (alertErr) {
      console.error('Alert failed:', alertErr.message);
    }
    // Always return valid Twilio response
    res.set('Content-Type', 'text/xml');
    res.send('<Response></Response>');
  }
});

module.exports = router;
