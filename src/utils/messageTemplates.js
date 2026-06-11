function getTemplates() {
  return {
    missedCall: (assistantName, bizName) =>
      `Hey, this is ${assistantName} from ${bizName}. Sorry we missed your call. What's going on? Just tell me a little about what you need help with.`,

    askLocation: () =>
      `Sorry you're dealing with that. What's your address so we can figure out what we're working with?`,

    askUrgency: () =>
      `Got it. Is this an emergency or can it wait a day or two?`,

    quoteAndBook: (quoteLow, quoteHigh, bookingLink) =>
      `Got it. Most jobs like this run between $${quoteLow} and $${quoteHigh} — I can't promise the exact price until our tech sees it but that's the ballpark. Here's a link to pick a time that works for you: ${bookingLink}`,

    bookingConfirmed: (day, time, bizName) =>
      `You're all set for ${day} at ${time}. Someone from ${bizName} will be there. You'll get a reminder the day before. Thanks for trusting us, we'll take good care of you.`,

    bookingReminder: (bizName, time) =>
      `Hey just a heads up, someone from ${bizName} is coming tomorrow at ${time}. See you then!`,

    reviewRequest: () =>
      `Hey hope everything's sorted now. If we did a good job we'd really appreciate a quick Google review, it means a lot to us. Thanks so much for trusting us.`,

    followUp1: (bookingLink) =>
      `Hey just checking in, still need us to come sort that out? You can grab a time here whenever you're ready: ${bookingLink}`,

    followUp2: (bookingLink) =>
      `Hey, don't want you to be stuck with that issue. We still have availability this week: ${bookingLink}`,

    followUp3: () =>
      `Last message from us, we don't want to bother you. Just reply anytime if you'd like us to come sort it out.`,

    leadReady: (issue, location, urgency, quoteLow, quoteHigh) =>
      `NEW LEAD\n\nIssue: ${issue}\nLocation: ${location}\nUrgency: ${urgency}\nAuto quote sent: $${quoteLow}-${quoteHigh}\n\nReply with a different amount to override, or reply APPROVE to confirm.`,

    quoteOverrideConfirm: (amount, bookingLink) =>
      `Hey just to confirm, you're looking at ${amount} all in for that job. Want to lock in a time? ${bookingLink}`,

    bookingViaLink: (customerName, customerPhone, issue, slot) =>
      `NEW BOOKING\n\nCustomer: ${customerName}\nPhone: ${customerPhone}\nIssue: ${issue}\nTime: ${slot}\n\nReply DONE when the job is complete.`,

    newBooking: (customerName, customerPhone, issue, slot) =>
      `NEW BOOKING\n\nCustomer: ${customerName || customerPhone}\nPhone: ${customerPhone}\nIssue: ${issue}\nTime: ${slot}\n\nReply DONE when the job is complete.`,

    timeBlocked: (start, end) =>
      `Got it, blocked off ${start} to ${end}. No bookings will go in during that time.`,

    statsReply: (leads, booked, pending) =>
      `Here are your stats for this month:\n\nLeads: ${leads}\nBooked: ${booked}\nPending quotes: ${pending}`,

    unknownCommand: () =>
      `Hey not sure I got that. You can text me things like:\n\n"Block Friday afternoon"\n"Stats"\n"$350" to send a quote\n"DONE" when a job is complete`,

    limitReached: () =>
      `Hey really sorry, we have hit our message limit for this month. We will be back in touch as soon as it resets.`,

    cancelConfirmed: () =>
      `Your subscription has been cancelled. Really sorry to see you go. If you ever want to come back just sign up again anytime.`,

    refundInitiated: () =>
      `Refund request received. We will process your pro-rated refund within 3 to 5 business days. The $50 setup fee is non-refundable. Sorry for any inconvenience.`,

    onboardingStep1: (bizName) =>
      `Hey! Welcome to Bookit. Before we go live, what would you like to name your AI assistant? Something like Sarah, Alex, or Jake.`,

    onboardingStep2: (assistantName, twilioNumber) =>
      `Love it. Last step: turn on missed call forwarding on your phone to your Bookit number ${twilioNumber}. Done? Reply YES.`,

    onboardingStep3: (assistantName, bookingLink) =>
      `You're live. ${assistantName} handles everything from here. Your booking link: ${bookingLink}. Text me anytime to block time, check your stats, or manage bookings.`,
  };
}

module.exports = { getTemplates };