const supabase = require('../db/supabase');
const { sendSMS } = require('./sms');
const { getTemplates } = require('../utils/messageTemplates');

/**
 * Start the onboarding flow after a contractor completes payment
 * This is triggered by the Stripe webhook when checkout.session.completed fires
 */
async function startOnboarding(contractorId) {
  const { data: contractor } = await supabase
    .from('contractors')
    .select('*')
    .eq('id', contractorId)
    .single();

  if (!contractor) {
    console.error('Contractor not found for onboarding:', contractorId);
    return;
  }

  const t = getTemplates(contractor.message_style || 'Friendly');

  // Step 1: Welcome and ask for assistant name
  const welcomeMsg = `🎉 Welcome to Bookit! I'm your new AI booking assistant.\n\nWhat would you like to name me? (e.g. Sarah, Alex, Jake)`;

  await sendSMS({
    to: contractor.owner_phone,
    from: contractor.twilio_number,
    body: welcomeMsg,
    contractorId: contractor.id
  });

  // Update onboarding step
  await supabase.from('contractors').update({ 
    onboarding_step: 'ASK_NAME' 
  }).eq('id', contractorId);
}

/**
 * Handle contractor's response during onboarding
 */
async function handleOnboardingReply({ contractor, body }) {
  const msg = body.trim();
  const t = getTemplates(contractor.message_style || 'Friendly');
  const twilioNumber = contractor.twilio_number;

  switch (contractor.onboarding_step) {
    case 'ASK_NAME': {
      // Save the assistant name
      const assistantName = msg;
      await supabase.from('contractors').update({ 
        assistant_name: assistantName,
        onboarding_step: 'ASK_FORWARDING' 
      }).eq('id', contractor.id);

      // Step 2: Ask about call forwarding
      const forwardingMsg = `Love it! I'll be ${assistantName} from now on 😄\n\nLast step: enable "Call Forwarding" on your phone to forward missed calls to ${twilioNumber}.\n\nOnce done, reply YES and you're live!`;

      await sendSMS({
        to: contractor.owner_phone,
        from: twilioNumber,
        body: forwardingMsg,
        contractorId: contractor.id
      });
      break;
    }

    case 'ASK_FORWARDING': {
      const msgLower = msg.toLowerCase();
      if (msgLower === 'yes' || msgLower === 'y' || msgLower.includes('done') || msgLower.includes('enabled')) {
        // Generate booking slug
        const slug = contractor.business_name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') + '-' + contractor.id.slice(0, 6);

        const baseUrl = process.env.BASE_URL || 'https://quotetext-backend.onrender.com';
        const bookingLink = `${baseUrl}/book/${slug}`;

        // Activate the contractor
        await supabase.from('contractors').update({ 
          is_active: true,
          booking_slug: slug,
          onboarding_step: 'COMPLETED'
        }).eq('id', contractor.id);

        const assistantName = contractor.assistant_name || 'Your assistant';
        const liveMsg = `🚀 You're LIVE, ${contractor.business_name}!\n\n${assistantName} will now handle all your booking inquiries automatically.\n\nYour booking page: ${bookingLink}\n\nShare this link with customers or let them find it from your website!`;

        await sendSMS({
          to: contractor.owner_phone,
          from: twilioNumber,
          body: liveMsg,
          contractorId: contractor.id
        });
      } else {
        // Remind them again
        const assistantName = contractor.assistant_name || 'Your assistant';
        const reminderMsg = `No worries! Just reply YES once you've set up call forwarding to ${twilioNumber}.\n\nNeed help? Your forwarding code is usually *72 followed by the number.`;

        await sendSMS({
          to: contractor.owner_phone,
          from: twilioNumber,
          body: reminderMsg,
          contractorId: contractor.id
        });
      }
      break;
    }

    default:
      // Onboarding already completed or unknown step
      break;
  }
}

/**
 * Send a test SMS to verify setup
 */
async function sendTestMessage(contractorId) {
  const { data: contractor } = await supabase
    .from('contractors')
    .select('*')
    .eq('id', contractorId)
    .single();

  if (!contractor) return;

  const baseUrl = process.env.BASE_URL || 'https://quotetext-backend.onrender.com';
  const bookingLink = `${baseUrl}/book/${contractor.booking_slug || contractor.id}`;

  const testMsg = `🔔 Test message from Bookit!\n\nYour setup is complete.\n\nBooking link: ${bookingLink}`;

  await sendSMS({
    to: contractor.owner_phone,
    from: contractor.twilio_number,
    body: testMsg,
    contractorId: contractor.id
  });
}

module.exports = { startOnboarding, handleOnboardingReply, sendTestMessage };