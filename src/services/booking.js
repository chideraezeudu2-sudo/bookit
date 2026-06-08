const { addDays, format } = require('date-fns');

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

module.exports = { generateSlots, formatSlot };