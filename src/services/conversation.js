const supabase = require('../db/supabase');
const { sendSMS } = require('./sms');
const { interpretMessage } = require('./groq');
const { getTemplates } = require('../utils/messageTemplates');
const { generateSlots, formatSlot } = require('./booking');

async function handleInbound({ from, to, body }) {
  console.log('Inbound SMS from', from, 'to', to, ':', body);

  // 1. Find contractor by Twilio number
  const { data: contractor } = await supabase
    .from('contractors')
    .select('*')
    .eq('twilio_number', to)
    .single();

  if (!contractor) {
    console.error('No contractor found for number', to);
    return;
  }

  // 2. Check if this is the CONTRACTOR replying (their own phone number)
  if (from === contractor.owner_phone) {
    await handleContractorReply({ contractor, body });
    return;
  }

  // 3. Check message limit
  if (contractor.message_count >= contractor.message_limit) {
    await sendSMS({
      to: from,
      from: to,
      body: getTemplates(contractor.message_style).limitReached(),
      contractorId: contractor.id
    });
    return;
  }

  // 4. Find or create lead
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
  await routeStep({ contractor, lead, body, from, to });
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

async function handleContractorReply({ contractor, body }) {
  const msg = body.trim().toLowerCase();

  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('contractor_id', contractor.id)
    .in('flow_step', ['AWAITING_QUOTE', 'AWAITING_CONTRACTOR'])
    .order('last_message_at', { ascending: false })
    .limit(1)
    .single();

  if (!lead) return;

  const t = getTemplates(contractor.message_style);

  if (lead.flow_step === 'AWAITING_QUOTE') {
    const quoteMatch = body.match(/\$?\d+/);
    if (quoteMatch) {
      const amount = quoteMatch[0].startsWith('$') ? quoteMatch[0] : `$${quoteMatch[0]}`;
      await supabase.from('leads').update({
        quote_amount: amount,
        quote_sent_at: new Date().toISOString(),
        flow_step: 'QUOTE_SENT',
        status: 'quoted'
      }).eq('id', lead.id);

      await sendSMS({
        to: lead.phone,
        from: contractor.twilio_number,
        body: t.quoteSent(amount),
        contractorId: contractor.id,
        leadId: lead.id
      });

      // Schedule 3 follow-ups if no response
      const now = new Date();
      await supabase.from('scheduled_jobs').insert([
        { job_type: 'quote_followup', lead_id: lead.id, contractor_id: contractor.id, scheduled_for: new Date(now.getTime() + 24*60*60*1000).toISOString() },
        { job_type: 'quote_followup', lead_id: lead.id, contractor_id: contractor.id, scheduled_for: new Date(now.getTime() + 3*24*60*60*1000).toISOString() },
        { job_type: 'quote_followup', lead_id: lead.id, contractor_id: contractor.id, scheduled_for: new Date(now.getTime() + 7*24*60*60*1000).toISOString() },
      ]);
    }
    return;
  }

  if (lead.flow_step === 'AWAITING_CONTRACTOR') {
    const { data: booking } = await supabase
      .from('bookings')
      .select('*')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (msg === 'yes' || msg.includes('yes') || msg.includes('confirm')) {
      await supabase.from('bookings').update({ contractor_confirmed: true, status: 'confirmed' }).eq('id', booking.id);
      await supabase.from('leads').update({ flow_step: 'CONFIRMED', status: 'confirmed' }).eq('id', lead.id);

      const slotStr = formatSlot(new Date(booking.chosen_slot));
      await sendSMS({
        to: lead.phone,
        from: contractor.twilio_number,
        body: t.bookingConfirmed(slotStr),
        contractorId: contractor.id,
        leadId: lead.id
      });

      // Schedule reminder day before
      const reminderTime = new Date(booking.chosen_slot);
      reminderTime.setDate(reminderTime.getDate() - 1);
      reminderTime.setHours(9, 0, 0, 0);
      await supabase.from('scheduled_jobs').insert({
        job_type: 'booking_reminder',
        lead_id: lead.id,
        booking_id: booking.id,
        contractor_id: contractor.id,
        scheduled_for: reminderTime.toISOString()
      });

    } else if (msg === 'no' || msg.includes('no') || msg.includes('busy')) {
      const slots = generateSlots(contractor);
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
        to: lead.phone,
        from: contractor.twilio_number,
        body: t.newSlotsOffer(formatSlot(slots[0]), formatSlot(slots[1]), formatSlot(slots[2])),
        contractorId: contractor.id,
        leadId: lead.id
      });
    }
  }
}

async function offerBookingSlots({ contractor, lead, from, to, t }) {
  const slots = generateSlots(contractor);
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
    body: t.offerSlots(formatSlot(slots[0]), formatSlot(slots[1]), formatSlot(slots[2])),
    contractorId: contractor.id,
    leadId: lead.id
  });
}

module.exports = { handleInbound };