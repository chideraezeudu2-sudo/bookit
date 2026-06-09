const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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

  if (!business_name || !owner_phone || !service_type) {
    return res.status(400).json({ error: 'business_name, owner_phone, and service_type are required' });
  }

  try {
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

    const { data: contractor, error } = await supabase
      .from('contractors')
      .insert({
        business_name,
        owner_phone,
        twilio_number: twilioNumber,
        service_type,
        working_days: working_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        start_time: start_time || '8am',
        end_time: end_time || '5pm',
        unavailable_notes,
        message_style: message_style || 'Friendly',
        is_active: false,
        onboarding_step: 'PENDING_PAYMENT'
      })
      .select()
      .single();

    if (error) throw error;

    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      return res.status(500).json({ error: 'Stripe price ID not configured' });
    }

    const baseUrl = process.env.BASE_URL || 'https://quotetext-backend.onrender.com';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: owner_phone + '@bookit.internal',
      metadata: { contractor_id: contractor.id },
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cancel`,
    });

    await supabase.from('contractors').update({
      stripe_customer_id: session.customer
    }).eq('id', contractor.id);

    res.json({ 
      success: true, 
      contractor_id: contractor.id,
      checkout_url: session.url 
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;