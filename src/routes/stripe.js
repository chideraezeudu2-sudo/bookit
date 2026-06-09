const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../db/supabase');
const { startOnboarding } = require('../services/onboarding');

router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send('Webhook Error: ' + err.message);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const contractorId = session.metadata.contractor_id;

    await supabase.from('contractors').update({
      stripe_customer_id: session.customer,
      stripe_subscription_id: session.subscription,
      subscription_status: 'active'
    }).eq('id', contractorId);

    // Trigger onboarding SMS flow
    await startOnboarding(contractorId);
  }

  if (event.type === 'customer.subscription.deleted' || event.type === 'invoice.payment_failed') {
    const obj = event.data.object;
    const customerId = obj.customer;

    await supabase.from('contractors').update({
      subscription_status: event.type === 'invoice.payment_failed' ? 'past_due' : 'cancelled',
      is_active: false
    }).eq('stripe_customer_id', customerId);
  }

  res.json({ received: true });
});

module.exports = router;