/**
 * Generate Google Calendar event links (pure URL construction - no API needed)
 */

function generateGoogleCalendarLink({ title, startTime, endTime, description, location }) {
  const formatDateTime = (date) => {
    return date.toISOString().replace(/-|:|\.\d{3}/g, '');
  };

  const start = formatDateTime(new Date(startTime));
  const end = formatDateTime(new Date(endTime));

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title || 'Appointment',
    dates: `${start}/${end}`,
    details: description || '',
    location: location || '',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function generateICSContent({ title, startTime, endTime, description, location }) {
  const formatDateTime = (date) => {
    return new Date(date).toISOString().replace(/-|:|\.\d{3}/g, '');
  };

  const start = formatDateTime(startTime);
  const end = formatDateTime(endTime);
  const now = formatDateTime(new Date());

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Bookit//EN
BEGIN:VEVENT
UID:${now}-bookit@bookit.app
DTSTAMP:${now}
DTSTART:${start}
DTEND:${end}
SUMMARY:${title || 'Appointment'}
DESCRIPTION:${description || ''}
LOCATION:${location || ''}
END:VEVENT
END:VCALENDAR`;
}

module.exports = { generateGoogleCalendarLink, generateICSContent };