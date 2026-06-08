const cron = require('node-cron');
const supabase = require('../db/supabase');
const { sendSMS } = require('./sms');
const { getTemplates } = require('../utils/messageTemplates');
const { formatSlot } = require('./booking');

function startScheduler() {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = new Date().toISOString();

      const { data: jobs } = await supabase
        .from('scheduled_jobs')
        .select('*, contractors(*), leads(*), bookings(*)')
        .lte('scheduled_for', now)
        .eq('executed', false)
        .eq('cancelled', false)
        .limit(20);

      if (!jobs || jobs.length === 0) return;

      for (const job of jobs) {
        try {
          await processJob(job);
          await supabase.from('scheduled_jobs').update({ executed: true, executed_at: new Date().toISOString() }).eq('id', job.id);
        } catch (err) {
          console.error('Job', job.id, 'failed:', err.message);
        }
      }
    } catch (err) {
      console.error('Scheduler error:', err.message);
    }
  });

  console.log('Scheduler started');
}

async function processJob(job) {
  const contractor = job.contractors;
  const lead = job.leads;
  const t = getTemplates(contractor.message_style);

  if (job.job_type === 'quote_followup') {
    if (lead.flow_step !== 'QUOTE_SENT') {
      await supabase.from('scheduled_jobs').update({ cancelled: true }).eq('id', job.id);
      return;
    }

    const followUpNum = (lead.follow_up_count || 0) + 1;
    let msg;
    if (followUpNum === 1) msg = t.followUp1();
    else if (followUpNum === 2) msg = t.followUp2();
    else msg = t.followUp3();

    await sendSMS({
      to: lead.phone,
      from: contractor.twilio_number,
      body: msg,
      contractorId: contractor.id,
      leadId: lead.id
    });

    await supabase.from('leads').update({ follow_up_count: followUpNum }).eq('id', lead.id);
  }

  if (job.job_type === 'booking_reminder') {
    const booking = job.bookings;
    if (!booking || !booking.chosen_slot) return;
    const slotStr = formatSlot(new Date(booking.chosen_slot));

    await sendSMS({
      to: lead.phone,
      from: contractor.twilio_number,
      body: t.bookingReminder(slotStr),
      contractorId: contractor.id,
      leadId: lead.id
    });

    await supabase.from('bookings').update({ reminder_sent: true }).eq('id', booking.id);

    // Schedule review request for day after appointment
    const reviewTime = new Date(booking.chosen_slot);
    reviewTime.setDate(reviewTime.getDate() + 1);
    reviewTime.setHours(10, 0, 0, 0);
    await supabase.from('scheduled_jobs').insert({
      job_type: 'review_request',
      lead_id: lead.id,
      booking_id: booking.id,
      contractor_id: contractor.id,
      scheduled_for: reviewTime.toISOString()
    });
  }

  if (job.job_type === 'review_request') {
    await sendSMS({
      to: lead.phone,
      from: contractor.twilio_number,
      body: t.reviewRequest(),
      contractorId: contractor.id,
      leadId: lead.id
    });
    await supabase.from('bookings').update({ review_requested: true, completed: true, status: 'completed' }).eq('id', job.booking_id);
    await supabase.from('leads').update({ status: 'completed', flow_step: 'COMPLETED' }).eq('id', lead.id);
  }
}

module.exports = { startScheduler };