const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * POST /api/create-checkout-session
 * Creates a Stripe Checkout session for the frontend to redirect to
 */
router.post('/create-checkout-session', express.json(), async (req, res) => {
  const { business_name, email } = req.body;

  if (!business_name || !email) {
    return res.status(400).json({ error: 'business_name and email are required' });
  }

  try {
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      return res.status(500).json({ error: 'STRIPE_PRICE_ID not configured' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'https://quotetext-backend.onrender.com';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      success_url: `${frontendUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/cancel`,
      metadata: { business_name }
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Create checkout session error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/signup
 * Finalizes contractor signup after Stripe payment is complete
 */
router.post('/signup', express.json(), async (req, res) => {
  const {
    business_name,
    owner_name,
    phone,
    service_type,
    working_days,
    start_time,
    end_time,
    message_style,
    stripe_session_id
  } = req.body;

  // Validate required fields
  if (!business_name || !owner_name || !phone || !service_type || !stripe_session_id) {
    return res.status(400).json({ 
      error: 'business_name, owner_name, phone, service_type, and stripe_session_id are required' 
    });
  }

  try {
    // 1. Verify Stripe session is valid and paid
    const session = await stripe.checkout.sessions.retrieve(stripe_session_id);
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // 2. Provision a Twilio phone number
    const areaCode = phone.replace(/\D/g, '').substring(0, 3);
    let twilioNumber;
    
    try {
      const twilioClient = require('twilio')(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      const availableNumbers = await twilioClient.availablePhoneNumbers('US').local.list({ 
        areaCode: areaCode.length === 3 ? areaCode : '212', 
        limit: 1 
      });
      
      if (availableNumbers.length > 0) {
        const purchased = await twilioClient.incomingPhoneNumbers.create({ 
          phoneNumber: availableNumbers[0].phoneNumber 
        });
        twilioNumber = purchased.phoneNumber;
      } else {
        // Fallback to default Twilio number if no number available in area code
        twilioNumber = process.env.TWILIO_PHONE_NUMBER;
      }
    } catch (twilioErr) {
      console.error('Twilio number provisioning error:', twilioErr.message);
      twilioNumber = process.env.TWILIO_PHONE_NUMBER;
    }

    // 3. Generate unique booking_slug
    let baseSlug = business_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    
    // Check if slug exists and add random suffix if needed
    const { data: existingSlug } = await supabase
      .from('contractors')
      .select('booking_slug')
      .like('booking_slug', `${baseSlug}%`)
      .limit(10);

    let bookingSlug = baseSlug;
    if (existingSlug && existingSlug.some(c => c.booking_slug === baseSlug)) {
      const suffix = Math.random().toString(36).substring(2, 6);
      bookingSlug = `${baseSlug}-${suffix}`;
    }

    // 4. Get subscription ID from Stripe
    let stripeSubscriptionId = session.subscription;
    
    // 5. Insert contractor into database
    const { data: contractor, error } = await supabase
      .from('contractors')
      .insert({
        business_name,
        owner_name,
        owner_phone: phone,
        twilio_number: twilioNumber,
        service_type,
        working_days: working_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        start_time: start_time || '08:00',
        end_time: end_time || '17:00',
        message_style: message_style || 'friendly',
        booking_slug: bookingSlug,
        stripe_customer_id: session.customer,
        stripe_subscription_id: stripeSubscriptionId,
        message_limit: 1500,
        message_count: 0,
        is_active: true,
        status: 'active',
        onboarding_step: 'START'
      })
      .select()
      .single();

    if (error) throw error;

    // 6. Send welcome SMS to contractor
    const welcomeMsg = `Hey ${owner_name}! Welcome to Bookit 🎉 Your dedicated booking number is ${twilioNumber}. Quick question before we get you live — what would you like to name your AI assistant? (e.g. Sarah, Alex, Jake)`;
    
    try {
      const twilioClient = require('twilio')(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      await twilioClient.messages.create({
        to: phone,
        from: twilioNumber,
        body: welcomeMsg
      });
    } catch (smsErr) {
      console.error('Welcome SMS error:', smsErr.message);
    }

    // 7. Return success response
    const baseUrl = process.env.BASE_URL || 'https://quotetext-backend.onrender.com';
    res.json({
      success: true,
      booking_url: `${baseUrl}/book/${bookingSlug}`,
      twilio_number: twilioNumber,
      message: 'Account created successfully'
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;