const twilio = require('twilio');
const supabase = require('../db/supabase');
require('dotenv').config();

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function sendSMS({ to, from, body, contractorId, leadId }) {
  try {
    const message = await client.messages.create({ to, from, body });

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