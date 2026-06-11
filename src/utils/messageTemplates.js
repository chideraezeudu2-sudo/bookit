function getTemplates() {
  return {
    missedCall: (assistantName, ownerName) =>
      `Hey this is ${assistantName} I work with ${ownerName} sorry we missed your call what's your problem you need fixed`,

    askLocation: () =>
      `What's your address?`,

    askUrgency: () =>
      `Is this an emergency or can it wait a day or two?`,

    ackProblem: () =>
      `Sorry you're dealing with that. Let me get a little info about your problem so we can know what we are dealing with`,

    roughQuote: (amountLow, amountHigh) =>
      `Got it. I ran the numbers on what you told me, most jobs like this run between $${amountLow} and $${amountHigh}. I can't promise the exact price until we see it in person, but that's the ballpark. Sound okay?`,

    quoteAndBook: (quoteMsg, bookingLink, ownerName) =>
      `Awesome. Here's an our booking link for you pick a schedule and a time that works for you. It's shows when ${ownerName} is available. ${bookingLink}`,

    followUp1: (bookingLink) =>
      `Hey just checking in, still need us to come sort that out? You can grab a time here whenever you're ready: ${bookingLink}`,

    followUp2: (bookingLink) =>
      `Hey, don't want you to be stuck with that issue! We still have availability this week: ${bookingLink}`,

    followUp3: () =>
      `Last message from us, we don't want to bother you! Just reply anytime if you'd like us to come sort it out 👍`,

    bookingConfirmed: (slot, bizName) =>
      `You're all set for ${slot}. Someone from ${bizName} will be there. You'll get a reminder the day before. Thanks for trusting us – we'll take good care of you.`,

    bookingConfirmedAlt: (slot, ownerName) =>
      `Perfect. You're booked for ${slot}. I'll let ${ownerName} know and we'll send someone there. Thank you`,

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