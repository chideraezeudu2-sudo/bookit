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
  const booking = job.bookings;
  const t = getTemplates();
  const bookingLink = `${process.env.BASE_URL}/book/${contractor.booking_slug}`;

  if (job.job_type === 'quote_followup') {
    if (lead.flow_step !== 'QUOTE_SENT') {
      await supabase.from('scheduled_jobs').update({ cancelled: true }).eq('id', job.id);
      return;
    }

    const followUpNum = (lead.follow_up_count || 0) + 1;
    let msg;
    if (followUpNum === 1) msg = t.followUp1(bookingLink);
    else if (followUpNum === 2) msg = t.followUp2(bookingLink);
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

  if (job.job_type === 'booking_reminder' && booking?.chosen_slot) {
    const slotStr = formatSlot(new Date(booking.chosen_slot));
    await sendSMS({
      to: lead.phone,
      from: contractor.twilio_number,
      body: t.bookingReminder(slotStr),
      contractorId: contractor.id,
      leadId: lead.id
    });
    await supabase.from('bookings').update({ reminder_sent: true }).eq('id', booking.id);
  }

  if (job.job_type === 'review_request') {
    await sendSMS({
      to: lead.phone,
      from: contractor.twilio_number,
      body: t.reviewRequest(),
      contractorId: contractor.id,
      leadId: lead.id
    });
    await supabase.from('bookings').update({ review_requested: true }).eq('id', job.booking_id);
  }
}

module.exports = { startScheduler };
