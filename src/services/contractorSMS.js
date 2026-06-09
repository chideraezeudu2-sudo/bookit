const supabase = require('../db/supabase');
const { sendSMS } = require('./sms');
const { getTemplates } = require('../utils/messageTemplates');
const { formatSlot } = require('./booking');
const { generateSlots } = require('./booking');
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Handle contractor replies to lead notifications
 * These are rule-based for common commands, with AI fallback for natural language
 */
async function handleContractorReply({ contractor, body, from }) {
  const msg = body.trim();
  const msgLower = msg.toLowerCase();
  const t = getTemplates(contractor.message_style);

  // Find the most recent lead that needs contractor attention
  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('contractor_id', contractor.id)
    .in('flow_step', ['AWAITING_QUOTE', 'AWAITING_CONTRACTOR', 'QUOTE_SENT'])
    .order('last_message_at', { ascending: false })
    .limit(1)
    .single();

  // Check for rule-based commands first (fast path)
  const commandResult = await checkRuleBasedCommands({
    contractor, lead, msg, msgLower, body, from, t
  });

  if (commandResult.handled) {
    return commandResult.response;
  }

  // Fall back to AI-powered interpretation for natural language
  return await handleAICommand({ contractor, lead, msg, msgLower, body, from, t });
}

async function checkRuleBasedCommands({ contractor, lead, msg, msgLower, body, from, t }) {
  // Handle DONE command - mark most recent booking as complete
  if (msgLower === 'done') {
    const { data: booking } = await supabase
      .from('bookings')
      .select('*, leads(*)')
      .eq('contractor_id', contractor.id)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (booking) {
      await supabase.from('bookings').update({ 
        status: 'completed',
        completed: true 
      }).eq('id', booking.id);

      // Schedule review request for next day
      const reviewTime = new Date();
      reviewTime.setDate(reviewTime.getDate() + 1);
      reviewTime.setHours(10, 0, 0, 0);

      await supabase.from('scheduled_jobs').insert({
        job_type: 'review_request',
        lead_id: booking.lead_id,
        booking_id: booking.id,
        contractor_id: contractor.id,
        scheduled_for: reviewTime.toISOString()
      });

      await sendSMS({
        to: contractor.owner_phone,
        from: contractor.twilio_number,
        body: `✅ Job marked as complete! Review request scheduled for tomorrow.`,
        contractorId: contractor.id
      });

      return { handled: true, response: null };
    }
  }

  // Handle STATS command
  if (msgLower === 'stats' || msgLower === 'stats me' || msgLower === 'how many leads' || msgLower.startsWith('stats')) {
    return await sendStats({ contractor, t });
  }

  // Handle YES/confirm for booking confirmation
  if (msgLower === 'yes' || msgLower === 'confirm' || msgLower === 'y') {
    if (lead && lead.flow_step === 'AWAITING_CONTRACTOR') {
      return await confirmBooking({ contractor, lead, t });
    }
  }

  // Handle NO/decline for booking
  if (msgLower === 'no' || msgLower === 'decline' || msgLower === 'n') {
    if (lead && lead.flow_step === 'AWAITING_CONTRACTOR') {
      return await declineBooking({ contractor, lead, t });
    }
  }

  // Handle quote amounts (e.g., "$350" or "350")
  const quoteMatch = msg.match(/^\$?\s*(\d+)\s*$/);
  if (quoteMatch && lead && lead.flow_step === 'AWAITING_QUOTE') {
    const amount = quoteMatch[1].startsWith('$') ? quoteMatch[1] : `$${quoteMatch[1]}`;
    return await sendQuote({ contractor, lead, amount, t });
  }

  // Handle block time commands
  if (msgLower.includes('block') || msgLower.includes('off') || msgLower.includes('unavailable')) {
    return await handleBlockTime({ contractor, msg, body, t });
  }

  return { handled: false };
}

async function handleAICommand({ contractor, lead, msg, msgLower, body, from, t }) {
  // Use Groq to interpret contractor's natural language command
  const prompt = `You are an assistant for a home service contractor using an SMS booking system.

Contractor message: "${body}"

Available commands you can interpret:
- "block [day/time]" - Block time off (e.g., "block Friday afternoon", "I'm off next week")
- "unblock [day/time]" - Unblock previously blocked time
- "stats" - Get lead/booking statistics
- A dollar amount like "$350" or "350" - Send a quote to the waiting lead
- "yes" or "no" - Confirm or decline a booking
- "done" - Mark a job as complete

Respond with ONLY a JSON object like:
{"command": "block", "details": "Friday afternoon"}
{"command": "quote", "amount": 350}
{"command": "stats"}
{"command": "confirm"}
{"command": "decline"}
{"command": "done"}
{"command": "unknown", "reason": "why it's unclear"}`;

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 200,
    });

    let parsed = { command: 'unknown' };
    try {
      parsed = JSON.parse(response.choices[0].message.content);
    } catch (e) {
      // Default to unknown
    }

    switch (parsed.command) {
      case 'block':
        return await handleBlockTime({ contractor, msg, body, t, parsed });
      case 'stats':
        return await sendStats({ contractor, t });
      case 'quote':
        if (lead && lead.flow_step === 'AWAITING_QUOTE') {
          return await sendQuote({ contractor, lead, amount: `$${parsed.amount}`, t });
        }
        break;
      case 'confirm':
        if (lead && lead.flow_step === 'AWAITING_CONTRACTOR') {
          return await confirmBooking({ contractor, lead, t });
        }
        break;
      case 'decline':
        if (lead && lead.flow_step === 'AWAITING_CONTRACTOR') {
          return await declineBooking({ contractor, lead, t });
        }
        break;
      case 'done':
        // Handled in rule-based commands
        break;
      default:
        await sendSMS({
          to: contractor.owner_phone,
          from: contractor.twilio_number,
          body: `Sorry, I didn't understand that. Try: "Block Friday", "Stats", "$350" to quote, YES/NO to confirm, or DONE when job is complete.`,
          contractorId: contractor.id
        });
    }
  } catch (err) {
    console.error('AI command error:', err.message);
  }

  return { handled: true, response: null };
}

async function sendQuote({ contractor, lead, amount, t }) {
  const baseUrl = process.env.BASE_URL || 'https://quotetext-backend.onrender.com';
  const bookingLink = `${baseUrl}/book/${contractor.booking_slug || contractor.id}`;

  await supabase.from('leads').update({
    quote_amount: amount,
    quote_sent_at: new Date().toISOString(),
    flow_step: 'QUOTE_SENT',
    status: 'quoted'
  }).eq('id', lead.id);

  await sendSMS({
    to: lead.phone,
    from: contractor.twilio_number,
    body: t.quoteSent(amount, bookingLink),
    contractorId: contractor.id,
    leadId: lead.id
  });

  // Schedule follow-ups
  const now = new Date();
  await supabase.from('scheduled_jobs').insert([
    { job_type: 'quote_followup', lead_id: lead.id, contractor_id: contractor.id, scheduled_for: new Date(now.getTime() + 24*60*60*1000).toISOString() },
    { job_type: 'quote_followup', lead_id: lead.id, contractor_id: contractor.id, scheduled_for: new Date(now.getTime() + 3*24*60*60*1000).toISOString() },
    { job_type: 'quote_followup', lead_id: lead.id, contractor_id: contractor.id, scheduled_for: new Date(now.getTime() + 7*24*60*60*1000).toISOString() },
  ]);

  return { handled: true, response: 'Quote sent' };
}

async function confirmBooking({ contractor, lead, t }) {
  const { data: booking } = await supabase
    .from('bookings')
    .select('*')
    .eq('lead_id', lead.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (booking) {
    const slotStr = formatSlot(new Date(booking.chosen_slot));

    await supabase.from('bookings').update({ 
      contractor_confirmed: true, 
      status: 'confirmed' 
    }).eq('id', booking.id);
    await supabase.from('leads').update({ 
      flow_step: 'CONFIRMED', 
      status: 'confirmed' 
    }).eq('id', lead.id);

    await sendSMS({
      to: lead.phone,
      from: contractor.twilio_number,
      body: t.bookingConfirmed(slotStr),
      contractorId: contractor.id,
      leadId: lead.id
    });

    // Schedule day-before reminder
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

    await sendSMS({
      to: contractor.owner_phone,
      from: contractor.twilio_number,
      body: `✅ Booking confirmed for ${slotStr}`,
      contractorId: contractor.id
    });
  }

  return { handled: true, response: 'Booking confirmed' };
}

async function declineBooking({ contractor, lead, t }) {
  const slots = generateSlots(contractor);

  await supabase.from('bookings').update({
    slot_a: slots[0].toISOString(),
    slot_b: slots[1].toISOString(),
    slot_c: slots[2].toISOString(),
    status: 'pending'
  }).eq('lead_id', lead.id);

  await supabase.from('leads').update({ flow_step: 'OFFER_SLOTS' }).eq('id', lead.id);

  await sendSMS({
    to: lead.phone,
    from: contractor.twilio_number,
    body: t.newSlotsOffer(formatSlot(slots[0]), formatSlot(slots[1]), formatSlot(slots[2])),
    contractorId: contractor.id,
    leadId: lead.id
  });

  return { handled: true, response: 'New slots sent' };
}

async function handleBlockTime({ contractor, msg, body, t, parsed }) {
  // Parse the time block from the message
  let startDate, endDate;

  const msgLower = msg.toLowerCase();

  // Handle "off next week" or "off [day]"
  if (msgLower.includes('next week')) {
    const now = new Date();
    const nextWeekStart = new Date(now);
    nextWeekStart.setDate(now.getDate() + (7 - now.getDay() + 1) % 7 + 1);
    startDate = nextWeekStart;
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 7);
  } else if (msgLower.includes('tomorrow')) {
    startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate);
    endDate.setHours(23, 59, 59, 999);
  } else if (msgLower.includes('today')) {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
  } else if (msgLower.includes('friday')) {
    const dayIndex = 5; // Friday
    startDate = getNextDayOfWeek(dayIndex);
    endDate = new Date(startDate);
    endDate.setHours(23, 59, 59, 999);
  } else if (msgLower.includes('monday')) {
    const dayIndex = 1;
    startDate = getNextDayOfWeek(dayIndex);
    endDate = new Date(startDate);
    endDate.setHours(23, 59, 59, 999);
  } else if (msgLower.includes('afternoon') || msgLower.includes('morning') || msgLower.includes('evening')) {
    // Block specific time of day
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    let targetDay = new Date();
    targetDay.setDate(targetDay.getDate() + 1); // Default to tomorrow

    for (const day of dayNames) {
      if (msgLower.includes(day)) {
        targetDay = getNextDayOfWeek(dayNames.indexOf(day));
        break;
      }
    }

    startDate = new Date(targetDay);
    endDate = new Date(targetDay);

    if (msgLower.includes('morning')) {
      startDate.setHours(6, 0, 0, 0);
      endDate.setHours(12, 0, 0, 0);
    } else if (msgLower.includes('afternoon')) {
      startDate.setHours(12, 0, 0, 0);
      endDate.setHours(18, 0, 0, 0);
    } else if (msgLower.includes('evening')) {
      startDate.setHours(18, 0, 0, 0);
      endDate.setHours(22, 0, 0, 0);
    } else {
      // Default to full day
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    }
  } else {
    // Default: block tomorrow
    startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate);
    endDate.setHours(23, 59, 59, 999);
  }

  // Check if blocked_times table exists, if not skip insertion
  try {
    const { error } = await supabase.from('blocked_times').insert({
      contractor_id: contractor.id,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      reason: body
    });

    if (error && error.code !== '42P01') { // Table might not exist
      console.error('Block time insert error:', error);
    }
  } catch (e) {
    console.log('Blocked times table may not exist:', e.message);
  }

  const startStr = startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const endStr = endDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  await sendSMS({
    to: contractor.owner_phone,
    from: contractor.twilio_number,
    body: `✅ Time blocked: ${startStr}${endDate.getDate() !== startDate.getDate() ? ' - ' + endStr : ''}. You'll be shown as unavailable during this period.`,
    contractorId: contractor.id
  });

  return { handled: true, response: 'Time blocked' };
}

function getNextDayOfWeek(dayIndex) {
  const result = new Date();
  const currentDay = result.getDay();
  const daysUntilTarget = (dayIndex - currentDay + 7) % 7 || 7;
  result.setDate(result.getDate() + daysUntilTarget);
  result.setHours(0, 0, 0, 0);
  return result;
}

async function sendStats({ contractor, t }) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [leadsResult, bookingsResult, pendingResult] = await Promise.all([
    supabase.from('leads').select('id', { count: 'exact' }).eq('contractor_id', contractor.id).gte('created_at', startOfMonth),
    supabase.from('bookings').select('id', { count: 'exact' }).eq('contractor_id', contractor.id).eq('status', 'confirmed').gte('created_at', startOfMonth),
    supabase.from('leads').select('id', { count: 'exact' }).eq('contractor_id', contractor.id).in('status', ['qualifying', 'quoted'])
  ]);

  const leads = leadsResult.count || 0;
  const booked = bookingsResult.count || 0;
  const pending = pendingResult.count || 0;

  await sendSMS({
    to: contractor.owner_phone,
    from: contractor.twilio_number,
    body: `📊 This Month's Stats\n\nLeads: ${leads}\nBooked: ${booked}\nPending: ${pending}`,
    contractorId: contractor.id
  });

  return { handled: true, response: 'Stats sent' };
}

module.exports = { handleContractorReply };