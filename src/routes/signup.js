const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');

router.post('/', express.json(), async (req, res) => {
  const {
    business_name,
    owner_phone,
    service_type,
    working_days,
    start_time,
    end_time,
    unavailable_notes,
    message_style
  } = req.body;

  try {
    // Use trial Twilio number for now
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

    // Create contractor in DB
    const { data: contractor, error } = await supabase
      .from('contractors')
      .insert({
        business_name,
        owner_phone,
        twilio_number: twilioNumber,
        service_type,
        working_days,
        start_time,
        end_time,
        unavailable_notes,
        message_style: message_style || 'Friendly',
        is_active: false // Activates after payment
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, contractor_id: contractor.id });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;