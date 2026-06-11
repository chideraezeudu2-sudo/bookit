const supabase = require('../db/supabase');
const { sendSMS } = require('./sms');
const { interpretLeadMessage, interpretContractorCommand } = require('./groq');
const { getTemplates } = require('../utils/messageTemplates');
const { generateAutoQuote } = require('./autoQuote');
const { formatSlot } = require('./booking');

async function handleInbound({ from, to, body }) {
  console.log(`📨 SMS RECEIVED — From: ${from}, To: ${to}, Body: "${body}"`);

  const normalizePhone = (num) => {
    const cleaned = (num || '').trim();
    return cleaned.startsWith('+') ? cleaned : '+' + cleaned;
  };

  const fromNum = normalizePhone(from);
  const toNum = normalizePhone(to);

  console.log(`🔍 Looking up contractor for twilio_number: "${toNum}"`);

  const { data: contractor, error } = await supabase
    .from('contractors')
    .select('*')
    .eq('twilio_number', toNum)
    .single();

  console.log(`🏢 Contractor found: ${contractor ? contractor.business_name : 'NONE'}, error: ${error?.message || 'none'}`);

  if (!contractor) {
    console.error(`No contractor found for number ${toNum}`);
    return;
  }

  await supabase.from('messages').insert({
    contractor_id: contractor.id,
    direction: 'inbound',
    from_number: fromNum,
    to_number: toNum,
    body
  });

  if (fromNum === contractor.owner_phone) {
    await handleContractorMessage({ contractor, body, to: toNum });
    return;
  }

  console.log(`📊 Message count: ${contractor.message_count}/${contractor.message_limit}`);
  if (contractor.message_count >= contractor.message_limit) {
    const t = getTemplates();
    await sendSMS({
      to: fromNum,
      from: toNum,
      body: t.limitReached(),
      contractorId: contractor.id
    });
    return;
  }

  if (!contractor.is_active) {
    console.log('Contractor not active, ignoring');
    return;
  }

  console.log(`🔍 Looking for lead from ${fromNum}`);
  let { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('phone', fromNum)
    .eq('contractor_id', contractor.id)
    .not('status', 'in', '("completed","lost","blocked")')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!lead) {
    const { data: newLead } = await supabase
      .from('leads')
      .insert({ contractor_id: contractor.id, phone: fromNum, flow_step: 'INTRO' })
      .select()
      .single();
    lead = newLead;
  }

  await supabase.from('leads').update({ last_message_at: new Date() }).eq('id', lead.id);

  console.log(`📍 Routing to step: ${lead.flow_step}`);
  await routeLeadStep({ contractor, lead, body, from: fromNum, to: toNum });
  console.log(`✅ Flow step completed`);
}

async function routeLeadStep({ contractor, lead, body, from, to }) {
  const t = getTemplates();

  switch (lead.flow_step) {
    case 'INTRO': {
      await supabase.from('leads').update({
        issue_description: body,
        flow_step: 'ASK_LOCATION'
      }).eq('id', lead.id);

      await sendSMS({
        to: from,
        from: to,
        body: t.askLocation(),
        contractorId: contractor.id,
        leadId: lead.id
      });
      break;
    }

    case 'ASK_LOCATION': {
      await supabase.from('leads').update({
        location: body,
        flow_step: 'ASK_URGENCY'
      }).eq('id', lead.id);

      await sendSMS({
        to: from,
        from: to,
        body: t.askUrgency(),
        contractorId: contractor.id,
        leadId: lead.id
      });
      break;
    }

    case 'ASK_URGENCY': {
      await supabase.from('leads').update({
        urgency: body,
        flow_step: 'QUOTE_SENT',
        status: 'qualifying'
      }).eq('id', lead.id);

      const { data: updatedLead } = await supabase
        .from('leads').select('*').eq('id', lead.id).single();

      console.log('💰 Generating auto quote...');
      const quote = await generateAutoQuote({
        issueDescription: updatedLead.issue_description,
        location: updatedLead.location,
        contractor
      });

      console.log(`💰 Quote generated: $${quote.total_low}-${quote.total_high}`);

      const quoteAmount = `$${quote.total_low}-${quote.total_high}`;
      await supabase.from('leads').update({
        quote_amount: quoteAmount,
        quote_sent_at: new Date()
      }).eq('id', lead.id);

      const bookingLink = `${process.env.BASE_URL}/book/${contractor.booking_slug}`;
      await sendSMS({
        to: from,
        from: to,
        body: t.quoteAndBook(quote.quote_message, bookingLink),
        contractorId: contractor.id,
        leadId: lead.id
      });

      await sendSMS({
        to: contractor.owner_phone,
        from: to,
        body: t.leadReady(
          updatedLead.issue_description,
          updatedLead.location,
          updatedLead.urgency,
          quote.total_low,
          quote.total_high
        ),
        contractorId: contractor.id,
        leadId: lead.id
      });

      const now = new Date();
      await supabase.from('scheduled_jobs').insert([
        { job_type: 'quote_followup', lead_id: lead.id, contractor_id: contractor.id, scheduled_for: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
        { job_type: 'quote_followup', lead_id: lead.id, contractor_id: contractor.id, scheduled_for: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) },
        { job_type: 'quote_followup', lead_id: lead.id, contractor_id: contractor.id, scheduled_for: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
      ]);
      break;
    }

    case 'QUOTE_SENT': {
      const bookingLink = `${process.env.BASE_URL}/book/${contractor.booking_slug}`;
      await sendSMS({
        to: from,
        from: to,
        body: `Hey just use this link to pick a time that works for you: ${bookingLink}`,
        contractorId: contractor.id,
        leadId: lead.id
      });
      break;
    }

    case 'CONFIRMED': {
      await sendSMS({
        to: from,
        from: to,
        body: `Hey you're already booked in! We'll see you at your scheduled time. Reply CANCEL if you need to reschedule 👍`,
        contractorId: contractor.id,
        leadId: lead.id
      });
      break;
    }

    default: {
      console.log(`Unknown step: ${lead.flow_step}`);
      break;
    }
  }
}

async function handleContractorMessage({ contractor, body, to }) {
  const t = getTemplates();
  const msg = body.trim().toLowerCase();

  if (msg === 'cancel' || msg.includes('cancel subscription')) {
    await supabase.from('contractors').update({
      is_active: false,
      subscription_status: 'cancelled'
    }).eq('id', contractor.id);

    await sendSMS({
      to: contractor.owner_phone,
      from: to,
      body: t.cancelConfirmed(),
      contractorId: contractor.id
    });
    return;
  }

  if (msg === 'refund' || msg.includes('refund')) {
    await sendSMS({
      to: contractor.owner_phone,
      from: to,
      body: t.refundInitiated(),
      contractorId: contractor.id
    });
    return;
  }

  if (msg === 'done' || msg.includes('job done') || msg.includes('completed')) {
    await handleJobDone({ contractor, to });
    return;
  }

  if (msg.includes('stat') || msg.includes('how many') || msg.includes('leads')) {
    await handleStatsRequest({ contractor, to, t });
    return;
  }

  const quoteMatch = body.trim().match(/^\$?(\d+)$/);
  if (quoteMatch || msg === 'approve') {
    await handleQuoteReply({ contractor, body: body.trim(), to, t });
    return;
  }

  await sendSMS({
    to: contractor.owner_phone,
    from: to,
    body: t.unknownCommand(),
    contractorId: contractor.id
  });
}

async function handleQuoteReply({ contractor, body, to, t }) {
  const msg = body.toLowerCase();

  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('contractor_id', contractor.id)
    .eq('flow_step', 'QUOTE_SENT')
    .order('last_message_at', { ascending: false })
    .limit(1)
    .single();

  if (!lead) return;

  const bookingLink = `${process.env.BASE_URL}/book/${contractor.booking_slug}`;

  let finalAmount;
  if (msg === 'approve') {
    finalAmount = lead.quote_amount;
  } else {
    const match = body.trim().match(/^\$?(\d+)$/);
    finalAmount = match ? `$${match[1]}` : lead.quote_amount;
  }

  await supabase.from('leads').update({
    quote_amount: finalAmount
  }).eq('id', lead.id);

  await sendSMS({
    to: lead.phone,
    from: to,
    body: `Hey just to confirm, you're looking at ${finalAmount} all in for that job. Want to lock in a time? ${bookingLink}`,
    contractorId: contractor.id,
    leadId: lead.id
  });
}

async function handleJobDone({ contractor, to }) {
  const { data: booking } = await supabase
    .from('bookings')
    .select('*, leads(*)')
    .eq('contractor_id', contractor.id)
    .eq('status', 'confirmed')
    .order('chosen_slot', { ascending: false })
    .limit(1)
    .single();

  if (!booking) return;

  await supabase.from('bookings').update({ completed: true, status: 'completed' }).eq('id', booking.id);
  await supabase.from('leads').update({ status: 'completed', flow_step: 'COMPLETED' }).eq('id', booking.lead_id);

  const reviewTime = new Date();
  reviewTime.setDate(reviewTime.getDate() + 1);
  reviewTime.setHours(10, 0, 0, 0);

  await supabase.from('scheduled_jobs').insert({
    job_type: 'review_request',
    lead_id: booking.lead_id,
    booking_id: booking.id,
    contractor_id: contractor.id,
    scheduled_for: reviewTime
  });
}

async function handleStatsRequest({ contractor, to, t }) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count: leadCount } = await supabase
    .from('leads').select('*', { count: 'exact', head: true })
    .eq('contractor_id', contractor.id)
    .gte('created_at', startOfMonth.toISOString());

  const { count: bookedCount } = await supabase
    .from('leads').select('*', { count: 'exact', head: true })
    .eq('contractor_id', contractor.id)
    .eq('status', 'confirmed')
    .gte('created_at', startOfMonth.toISOString());

  const { count: pendingCount } = await supabase
    .from('leads').select('*', { count: 'exact', head: true })
    .eq('contractor_id', contractor.id)
    .eq('flow_step', 'QUOTE_SENT')
    .gte('created_at', startOfMonth.toISOString());

  await sendSMS({
    to: contractor.owner_phone,
    from: to,
    body: t.statsReply(leadCount || 0, bookedCount || 0, pendingCount || 0),
    contractorId: contractor.id
  });
}

module.exports = { handleInbound };