const { addDays, format, parseISO, isBefore, isAfter, startOfDay, endOfDay } = require('date-fns');

function parseHour(timeStr) {
  const lower = (timeStr || '9am').toLowerCase();
  const match = lower.match(/(\d+)(am|pm)/);
  if (!match) return 9;
  let hour = parseInt(match[1]);
  if (match[2] === 'pm' && hour !== 12) hour += 12;
  if (match[2] === 'am' && hour === 12) hour = 0;
  return hour;
}

function generateSlots(contractor) {
  const workingDays = contractor.working_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const startHour = parseHour(contractor.start_time);
  const endHour = parseHour(contractor.end_time);
  
  const slots = [];
  let day = new Date();
  day.setDate(day.getDate() + 1);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  while (slots.length < 3) {
    const dayName = dayNames[day.getDay()];
    if (workingDays.includes(dayName)) {
      // Morning slot
      if (slots.length < 3) {
        const morning = new Date(day);
        morning.setHours(startHour, 0, 0, 0);
        slots.push(morning);
      }
      // Afternoon slot
      if (slots.length < 3 && endHour > startHour + 2) {
        const afternoon = new Date(day);
        const midpoint = Math.floor((startHour + endHour) / 2);
        afternoon.setHours(midpoint, 0, 0, 0);
        slots.push(afternoon);
      }
    }
    day.setDate(day.getDate() + 1);
    if (day.getDate() > new Date().getDate() + 14) break;
  }

  return slots.slice(0, 3);
}

function formatSlot(date) {
  return format(date, "EEEE, MMM d 'at' h:mmaaa");
}

/**
 * Get available time slots for a specific date
 * Respects blocked_times and confirmed bookings
 */
async function getAvailableSlotsForDate(contractor, dateStr) {
  const supabase = require('../db/supabase');
  
  const targetDate = parseISO(dateStr);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const targetDayName = dayNames[targetDate.getDay()];
  
  // Check if contractor works on this day
  const workingDays = contractor.working_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  if (!workingDays.includes(targetDayName)) {
    return [];
  }

  const startHour = parseHour(contractor.start_time);
  const endHour = parseHour(contractor.end_time);
  
  // Generate all possible slots (every 2 hours)
  const slots = [];
  for (let hour = startHour; hour < endHour; hour += 2) {
    const slotTime = new Date(targetDate);
    slotTime.setHours(hour, 0, 0, 0);
    slots.push(slotTime);
  }

  // Get blocked times for this contractor
  const dayStart = startOfDay(targetDate);
  const dayEnd = endOfDay(targetDate);
  
  const { data: blockedTimes } = await supabase
    .from('blocked_times')
    .select('start_time, end_time')
    .eq('contractor_id', contractor.id)
    .or(`start_time.lte.${dayEnd.toISOString()},end_time.gte.${dayStart.toISOString()}`);

  // Get confirmed bookings for this date
  const { data: bookings } = await supabase
    .from('bookings')
    .select('chosen_slot')
    .eq('contractor_id', contractor.id)
    .eq('status', 'confirmed')
    .gte('chosen_slot', dayStart.toISOString())
    .lte('chosen_slot', dayEnd.toISOString());

  // Filter out blocked and booked slots
  const availableSlots = slots.filter(slot => {
    // Check if slot is in the past
    if (isBefore(slot, new Date())) {
      return false;
    }

    // Check blocked times
    if (blockedTimes) {
      for (const block of blockedTimes) {
        const blockStart = parseISO(block.start_time);
        const blockEnd = parseISO(block.end_time);
        if (isAfter(slot, blockStart) && isBefore(slot, blockEnd)) {
          return false;
        }
      }
    }

    // Check existing bookings - block slots within job duration of booked time
    if (bookings) {
      for (const booking of bookings) {
        const bookedSlot = parseISO(booking.chosen_slot);
        // Default job duration is 2 hours - block that window
        const JOB_DURATION_HOURS = 2;
        const slotStart = slot.getTime();
        const slotEnd = slotStart + JOB_DURATION_HOURS * 60 * 60 * 1000;
        const bookingStart = bookedSlot.getTime();
        const bookingEnd = bookingStart + JOB_DURATION_HOURS * 60 * 60 * 1000;
        
        // Check if this slot overlaps with the booked job window
        if (slotStart < bookingEnd && slotEnd > bookingStart) {
          return false;
        }
      }
    }

    return true;
  });

  return availableSlots.map(slot => ({
    value: slot.toISOString(),
    display: formatSlot(slot)
  }));
}

module.exports = { generateSlots, formatSlot, getAvailableSlotsForDate };