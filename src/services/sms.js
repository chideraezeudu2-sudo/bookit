const supabase = require('../db/supabase');
require('dotenv').config();

let client = null;
let twilio = null;

function getTwilioClient() {
  if (!twilio) {
    twilio = require('twilio');
  }
  if (!client && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('✅ Twilio client initialized');
  }
  return client;
}

async function sendSMS({ to, from, body, contractorId, leadId }) {
  const twilioClient = getTwilioClient();
  if (!twilioClient) {
    console.warn('SMS send skipped - Twilio not configured');
    return { sid: 'mock-sid', status: 'skipped' };
  }
  try {
    const message = await twilioClient.messages.create({ to, from, body });

    // Log outbound message
    await supabase.from('messages').insert({
      contractor_id: contractorId,
      lead_id: leadId || null,
      direction: 'outbound',
      from_number: from,
      to_number: to,
      body,
      twilio_sid: message.sid,
      status: 'sent'
    });

    // Increment contractor message count
    if (contractorId) {
      try {
        await supabase.rpc('increment_message_count', { contractor_id_input: contractorId });
      } catch (e) {
        // Function might not exist yet, skip
        console.log('Message count increment skipped:', e.message);
      }
    }

    return message;
  } catch (err) {
    console.error('SMS send error:', err.message);
    throw err;
  }
}

module.exports = { sendSMS };