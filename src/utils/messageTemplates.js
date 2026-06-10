function getTemplates() {
  return {
    missedCall: (bizName) =>
      `Hey! Sorry we missed your call. What's going on, how can we help?`,

    askLocation: (issue) =>
      `Sorry to hear that! That's something we deal with all the time, we've got you covered. Whereabouts are you located?`,

    askUrgency: () =>
      `Got it. Is this something urgent or can it wait a couple of days?`,

    quoteAndBook: (issue, quoteMsg, bookingLink) =>
      `Okay so for the ${issue} — ${quoteMsg}. Want me to get someone out to you? Pick a time here: ${bookingLink}`,

    followUp1: (bookingLink) =>
      `Hey just checking in, still need us to come sort that out? You can grab a time here whenever you're ready: ${bookingLink}`,

    followUp2: (bookingLink) =>
      `Hey, don't want you to be stuck with that issue! We still have availability this week: ${bookingLink}`,

    followUp3: () =>
      `Last message from us, we don't want to bother you! Just reply anytime if you'd like us to come sort it out 👍`,

    bookingConfirmed: (slot, bizName) =>
      `You're all booked! We'll have someone with you ${slot}. Once again really sorry for the inconvenience, we'll get that sorted out for you no problem 👍`,

    bookingReminder: (slot) =>
      `Hey just a heads up, we've got someone coming to you tomorrow at ${slot}. See you then!`,

    reviewRequest: () =>
      `Hey hope everything's looking good now! If we did a good job we'd really appreciate a quick Google review, it means a lot to us. Thanks so much for trusting us 🙏`,

    limitReached: () =>
      `Hey really sorry, we've hit our message limit for this month. We'll be back in touch as soon as it resets. Sorry for the inconvenience!`,

    leadReady: (issue, location, urgency, quoteLow, quoteHigh) =>
      `NEW LEAD\n\nIssue: ${issue}\nLocation: ${location}\nUrgency: ${urgency}\nAuto quote sent: $${quoteLow}-${quoteHigh}\n\nReply with exact quote amount to override, or reply APPROVE to confirm the auto quote.`,

    bookingViaLink: (customerName, customerPhone, issue, slot) =>
      `NEW BOOKING\n\nCustomer: ${customerName}\nPhone: ${customerPhone}\nIssue: ${issue}\nTime: ${slot}\n\nReply DONE when the job is complete.`,

    newBooking: (customerName, customerPhone, issue, slot) =>
      `NEW BOOKING\n\nCustomer: ${customerName || customerPhone}\nPhone: ${customerPhone}\nIssue: ${issue}\nTime: ${slot}\n\nReply DONE when the job is complete.`,

    timeBlocked: (start, end) =>
      `Got it, blocked off ${start} to ${end}. No bookings will go in during that time 👍`,

    statsReply: (leads, booked, pending) =>
      `Here are your stats for this month:\n\nLeads: ${leads}\nBooked: ${booked}\nPending quotes: ${pending}`,

    unknownCommand: () =>
      `Hey not sure I got that! You can text me things like:\n\n"Block Friday afternoon"\n"How many leads this month?"\n"$350" to send a quote\n"DONE" when a job is complete`,

    cancelConfirmed: () =>
      `Your subscription has been cancelled. Really sorry to see you go! If you ever want to come back just sign up again at any time 👍`,

    refundInitiated: () =>
      `Refund request received! We'll process your pro-rated refund within 3-5 business days. The $50 setup fee is non-refundable. Sorry for any inconvenience!`,
  };
}

module.exports = { getTemplates };