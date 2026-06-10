const supabase = require('../db/supabase');
const { sendSMS } = require('./sms');
const { interpretMessage } = require('./groq');
const { getTemplates } = require('../utils/messageTemplates');
const { generateSlots, formatSlot } = require('./booking');
const { handleContractorReply } = require('./contractorSMS');
const { handleOnboardingReply } = require('./onboarding');

async function handleInbound({ from, to, body }) {
  console.log(`🔍 Looking up contractor for twilio_number: "${to}"`);
  
  const { data: contractor, error } = await supabase
    .from('contractors')
    .select('*')
    .eq('twilio_number', to)
    .single();

  console.log(`🏢 Contractor found: ${contractor ? contractor.business_name : 'NONE'}, error: ${error?.message || 'none'}`);

  if (!contractor) {
    console.error(`No contractor found for number ${to}`);
    return;
  }

  // 2. Check if this is the CONTRACTOR replying (their own phone number)
  if (from === contractor.owner_phone) {
    // Check if contractor is still in onboarding
    if (contractor.onboarding_step && contractor.onboarding_step !== 'COMPLETED') {
      await handleOnboardingReply({ contractor, body });
      return;
    }
    // Handle contractor commands (YES/NO, quote, DONE, block time, stats)
    await handleContractorReply({ contractor, body, from });
    return;
  }

  // 3. Check message limit (80% warning threshold)
  console.log(`📊 Message count: ${contractor.message_count}/${contractor.message_limit}`);
  if (contractor.message_count >= contractor.message_limit) {
    console.log(`⚠️ Message limit reached for contractor ${contractor.id}`);
    await sendSMS({
      to: from,
      from: to,
      body: getTemplates(contractor.message_style).limitReached(),
      contractorId: contractor.id
    });
    return;
  }
  
  // 3b. Warning at 80% of limit (1200 for 1500 limit)
  const warningThreshold = Math.floor(contractor.message_limit * 0.8);
  console.log(`📊 Warning threshold: ${warningThreshold} (80% of ${contractor.message_limit})`);
  if (contractor.message_count === warningThreshold) {
    const remaining = contractor.message_limit - contractor.message_count;
    await sendSMS({
      to: contractor.owner_phone,
      from: to,
      body: `Heads up — you've used ${contractor.message_count} of your ${contractor.message_limit} monthly messages. You have about ${remaining} left this month. Reply STATS anytime to check your usage.`,
      contractorId: contractor.id
    });
  }

  // 4. Find or create lead
  console.log(`🔍 Looking for lead from ${from}`);
  let { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('phone', from)
    .eq('contractor_id', contractor.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!lead) {
    const { data: newLead } = await supabase
      .from('leads')
      .insert({ contractor_id: contractor.id, phone: from, flow_step: 'INTRO' })
      .select()
      .single();
    lead = newLead;
  }

  // 5. Log inbound message
  await supabase.from('messages').insert({
    contractor_id: contractor.id,
    lead_id: lead.id,
    direction: 'inbound',
    from_number: from,
    to_number: to,
    body
  });

  // Update last_message_at
  await supabase.from('leads').update({ last_message_at: new Date().toISOString() }).eq('id', lead.id);

  // 6. Route to correct step handler
  console.log(`📍 Routing to step: ${lead.flow_step}`);
  await routeStep({ contractor, lead, body, from, to });
  console.log(`✅ Flow step completed`);
}

async function offerBookingSlots({ contractor, lead, from, to, t }) {
  const slots = generateSlots(contractor);

  const slotA = formatSlot(slots[0]);
  const slotB = formatSlot(slots[1]);
  const slotC = formatSlot(slots[2]);

  await supabase.from('bookings').insert({
    contractor_id: contractor.id,
    lead_id: lead.id,
    slot_a: slots[0].toISOString(),
    slot_b: slots[1].toISOString(),
    slot_c: slots[2].toISOString(),
    status: 'pending'
  });

  await supabase.from('leads').update({ flow_step: 'OFFER_SLOTS' }).eq('id', lead.id);

  await sendSMS({
    to: from,
    from: to,
    body: t.offerSlots(slotA, slotB, slotC),
    contractorId: contractor.id,
    leadId: lead.id
  });
}

async function routeStep({ contractor, lead, body, from, to }) {
  const t = getTemplates(contractor.message_style);
  const step = lead.flow_step;
  const msg = body.trim().toLowerCase();

  switch (step) {
    case 'INTRO': {
      await supabase.from('leads').update({
        issue_description: body,
        flow_step: 'ASK_LOCATION'
      }).eq('id', lead.id);

      await sendSMS({ to: from, from: to, body: t.askLocation(), contractorId: contractor.id, leadId: lead.id });
      break;
    }

    case 'ASK_LOCATION': {
      await supabase.from('leads').update({
        location: body,
        flow_step: 'ASK_URGENCY'
      }).eq('id', lead.id);

      await sendSMS({ to: from, from: to, body: t.askUrgency(), contractorId: contractor.id, leadId: lead.id });
      break;
    }

    case 'ASK_URGENCY': {
      await supabase.from('leads').update({
        urgency: body,
        flow_step: 'AWAITING_QUOTE',
        status: 'qualifying'
      }).eq('id', lead.id);

      // Notify contractor to provide a quote
      const summaryMsg = `📋 LEAD READY FOR QUOTE\n\nIssue: ${lead.issue_description}\nLocation: ${lead.location}\nUrgency: ${body}\n\nReply with the quote amount (e.g. "$350") to send it to the customer.`;

      await sendSMS({
        to: contractor.owner_phone,
        from: to,
        body: summaryMsg,
        contractorId: contractor.id,
        leadId: lead.id
      });
      break;
    }

    case 'QUOTE_SENT': {
      const aiResult = await interpretMessage({
        message: body,
        context: 'Lead was sent a quote. Checking if they want to book.',
        flowStep: step
      });

      if (aiResult.intent === 'CONFIRM_YES' || msg.includes('yes') || msg.includes('book') || msg.includes('sure') || msg.includes('ok')) {
        await offerBookingSlots({ contractor, lead, from, to, t });
      } else if (aiResult.intent === 'CONFIRM_NO' || msg.includes('no') || msg.includes('not') || msg.includes('pass')) {
        await supabase.from('leads').update({ status: 'lost' }).eq('id', lead.id);
      } else {
        await sendSMS({ to: from, from: to, body: t.quoteSent(lead.quote_amount), contractorId: contractor.id, leadId: lead.id });
      }
      break;
    }

    case 'OFFER_SLOTS': {
      let chosenSlot = null;

      if (msg.includes('a') || msg === '1') {
        const { data: booking } = await supabase.from('bookings').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(1).single();
        chosenSlot = booking?.slot_a;
      } else if (msg.includes('b') || msg === '2') {
        const { data: booking } = await supabase.from('bookings').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(1).single();
        chosenSlot = booking?.slot_b;
      } else if (msg.includes('c') || msg === '3') {
        const { data: booking } = await supabase.from('bookings').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(1).single();
        chosenSlot = booking?.slot_c;
      } else {
        await offerBookingSlots({ contractor, lead, from, to, t });
        return;
      }

      if (chosenSlot) {
        await supabase.from('bookings').update({ chosen_slot: chosenSlot }).eq('lead_id', lead.id);
        await supabase.from('leads').update({ flow_step: 'AWAITING_CONTRACTOR' }).eq('id', lead.id);

        await sendSMS({ to: from, from: to, body: t.awaitingContractor(), contractorId: contractor.id, leadId: lead.id });

        const details = `Customer: ${lead.phone}\nIssue: ${lead.issue_description}\nLocation: ${lead.location}\nUrgency: ${lead.urgency}`;
        const { data: booking } = await supabase.from('bookings').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(1).single();
        const prompt = t.contractorPrompt(
          details,
          formatSlot(new Date(booking.slot_a)),
          formatSlot(new Date(booking.slot_b)),
          formatSlot(new Date(booking.slot_c))
        );

        await sendSMS({ to: contractor.owner_phone, from: to, body: prompt, contractorId: contractor.id, leadId: lead.id });
      }
      break;
    }

    default:
      console.log('Unknown step:', step);
      break;
  }
}

module.exports = { handleInbound };