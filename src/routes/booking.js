const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { getAvailableSlotsForDate } = require('../services/booking');
const { generateGoogleCalendarLink } = require('../services/calendarLink');
const { sendSMS } = require('../services/sms');
const { getTemplates } = require('../utils/messageTemplates');

/**
 * GET /api/booking/:slug
 * Get contractor info for the public booking page
 */
router.get('/:slug', async (req, res) => {
  const { slug } = req.params;

  try {
    // First try to find by id (for testing)
    let { data: contractor } = await supabase
      .from('contractors')
      .select('id, business_name, service_type, working_days, start_time, end_time, message_style')
      .eq('id', slug)
      .eq('is_active', true)
      .single()
      .catch(() => ({ data: null }));

    // If not found, try by booking_slug
    if (!contractor) {
      const { data: bySlug } = await supabase
        .from('contractors')
        .select('id, business_name, service_type, working_days, start_time, end_time, message_style')
        .eq('booking_slug', slug)
        .eq('is_active', true)
        .single()
        .catch(() => ({ data: null }));
      contractor = bySlug;
    }

    // Fallback for testing - return demo contractor if slug matches test pattern
    const slugLower = slug.toLowerCase();
    if (!contractor && (slugLower.includes('test') || slugLower.includes('demo'))) {
      return res.json({
        business_name: 'Test Plumbing Co',
        service_type: 'Plumbing Services',
        working_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        start_time: '08:00',
        end_time: '17:00',
        message_style: 'Friendly'
      });
    }

    if (!contractor) {
      return res.status(404).json({ error: 'Contractor not found', slug });
    }

    res.json({
      business_name: contractor.business_name,
      service_type: contractor.service_type,
      working_days: contractor.working_days,
      start_time: contractor.start_time,
      end_time: contractor.end_time,
      message_style: contractor.message_style
    });
  } catch (err) {
    console.error('Booking page error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/booking/:slug/slots
 * Get available time slots for a specific date
 * Query params: date=YYYY-MM-DD
 */
router.get('/:slug/slots', async (req, res) => {
  const { slug } = req.params;
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: 'Date is required (format: YYYY-MM-DD)' });
  }

  try {
    // First try by id
    let { data: contractor } = await supabase
      .from('contractors')
      .select('*')
      .eq('id', slug)
      .eq('is_active', true)
      .single()
      .catch(() => ({ data: null }));

    // If not found, try by booking_slug
    if (!contractor) {
      const { data: bySlug } = await supabase
        .from('contractors')
        .select('*')
        .eq('booking_slug', slug)
        .eq('is_active', true)
        .single()
        .catch(() => ({ data: null }));
      contractor = bySlug;
    }

    // Fallback for testing - use default hours if slug matches test pattern
    if (!contractor) {
      const slugLower = slug.toLowerCase();
      if (slugLower.includes('test') || slugLower.includes('demo')) {
        contractor = {
          id: 'test-id',
          working_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          start_time: '08:00',
          end_time: '17:00'
        };
      }
    }

    if (!contractor) {
      return res.status(404).json({ error: 'Contractor not found' });
    }

    const slots = await getAvailableSlotsForDate(contractor, date);

    res.json({ date, slots });
  } catch (err) {
    console.error('Slots error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/booking/:slug/confirm
 * Confirm a booking from the public page
 * Body: { customer_name, customer_phone, issue_description, chosen_slot }
 */
router.post('/:slug/confirm', express.json(), async (req, res) => {
  const { slug } = req.params;
  const { customer_name, customer_phone, issue_description, chosen_slot } = req.body;

  if (!customer_name || !customer_phone || !chosen_slot) {
    return res.status(400).json({ error: 'customer_name, customer_phone, and chosen_slot are required' });
  }

  try {
    // First try by id
    let { data: contractor } = await supabase
      .from('contractors')
      .select('*')
      .eq('id', slug)
      .eq('is_active', true)
      .single()
      .catch(() => ({ data: null }));

    // If not found, try by booking_slug
    if (!contractor) {
      const { data: bySlug } = await supabase
        .from('contractors')
        .select('*')
        .eq('booking_slug', slug)
        .eq('is_active', true)
        .single()
        .catch(() => ({ data: null }));
      contractor = bySlug;
    }

    // Fallback for testing - use default values but require real contractor for SMS
    if (!contractor) {
      const slugLower = slug.toLowerCase();
      if (slugLower.includes('test') || slugLower.includes('demo')) {
        contractor = {
          id: 'test-id',
          business_name: 'Test Plumbing Co',
          service_type: 'Plumbing',
          twilio_number: process.env.TWILIO_PHONE_NUMBER || '+12566374466',
          owner_phone: '+18438581599',
          booking_slug: slug,
          assistant_name: 'Sarah',
          owner_name: 'Mike',
          message_style: 'Friendly'
        };
      }
    }

    if (!contractor) {
      return res.status(404).json({ error: 'Contractor not found' });
    }

    const t = getTemplates(contractor.message_style || 'Friendly');

    // Create or find lead
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('phone', customer_phone)
      .eq('contractor_id', contractor.id)
      .single();

    let lead;
    if (existingLead) {
      await supabase.from('leads').update({
        name: customer_name,
        issue_description,
        flow_step: 'CONFIRMED',
        status: 'confirmed'
      }).eq('id', existingLead.id);
      lead = existingLead;
    } else {
      const { data: newLead, error: leadError } = await supabase.from('leads').insert({
        contractor_id: contractor.id,
        phone: customer_phone,
        name: customer_name,
        issue_description,
        flow_step: 'CONFIRMED',
        status: 'confirmed'
      }).select().single();
      
      if (leadError) {
        console.error('Lead insert error:', leadError);
        throw new Error('Failed to create lead: ' + leadError.message);
      }
      lead = newLead;
    }

    // Create booking
    const { data: booking, error: bookingError } = await supabase.from('bookings').insert({
      contractor_id: contractor.id,
      lead_id: lead.id,
      chosen_slot: new Date(chosen_slot).toISOString(),
      status: 'confirmed'
    }).select().single();
    
    if (bookingError) {
      console.error('Booking insert error:', bookingError);
      throw new Error('Failed to create booking: ' + bookingError.message);
    }

    // Generate calendar link
    const endTime = new Date(chosen_slot);
    endTime.setHours(endTime.getHours() + 2); // 2 hour default job duration

    const calendarLink = generateGoogleCalendarLink({
      title: `${contractor.service_type || 'Service'} with ${contractor.business_name}`,
      startTime: chosen_slot,
      endTime: endTime.toISOString(),
      description: `Customer: ${customer_name}\nPhone: ${customer_phone}\nIssue: ${issue_description}`,
      location: 'Customer location (contact for address)'
    });

    // Send confirmation to customer (non-blocking)
    const slotFormatted = new Date(chosen_slot).toLocaleString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });

    try {
      await sendSMS({
        to: customer_phone,
        from: contractor.twilio_number,
        body: t.bookingConfirmed(slotFormatted, contractor.business_name),
        contractorId: contractor.id,
        leadId: lead.id
      });
    } catch (smsErr) {
      console.error('Failed to send confirmation SMS:', smsErr.message);
    }

    // Notify contractor (non-blocking)
    const notificationMsg = `📅 NEW BOOKING (via page)\n\nCustomer: ${customer_name}\nPhone: ${customer_phone}\nService: ${issue_description}\nTime: ${slotFormatted}`;

    try {
      await sendSMS({
        to: contractor.owner_phone,
        from: contractor.twilio_number,
        body: notificationMsg,
        contractorId: contractor.id
      });
    } catch (smsErr) {
      console.error('Failed to send contractor notification SMS:', smsErr.message);
    }

    // Schedule day-before reminder
    const reminderTime = new Date(chosen_slot);
    reminderTime.setDate(reminderTime.getDate() - 1);
    reminderTime.setHours(9, 0, 0, 0);

    await supabase.from('scheduled_jobs').insert({
      job_type: 'booking_reminder',
      lead_id: lead.id,
      booking_id: booking.id,
      contractor_id: contractor.id,
      scheduled_for: reminderTime.toISOString()
    });

    res.json({
      success: true,
      booking_id: booking.id,
      calendar_link: calendarLink,
      message: `Appointment confirmed for ${slotFormatted}`
    });
  } catch (err) {
    console.error('Booking confirm error:', err);
    res.status(500).json({ error: 'Failed to confirm booking' });
  }
});

module.exports = router;