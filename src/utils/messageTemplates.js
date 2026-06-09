function getTemplates(style = 'Friendly', assistantName = 'Sarah') {
  const name = assistantName || 'Sarah';

  const templates = {
    Friendly: {
      // Onboarding
      welcomeStep1: (bizName) => `Hey! Welcome to Bookit 🎉 I'm about to set up your automated booking system for ${bizName}. First — what would you like to name your AI assistant? (e.g. Sarah, Alex, Jake)`,
      welcomeStep2: (chosenName) => `Love it! I'm ${chosenName} from now on 😄 One quick step to go live: enable Call Forwarding on your phone for missed calls and forward them to your Bookit number. Done? Reply YES`,
      welcomeStep3: (chosenName, bookingLink) => `You're LIVE! 🚀 From now on ${chosenName} handles your missed calls, qualifies leads, sends quotes, and books jobs automatically.\n\nYour personal booking link (share this anywhere):\n${bookingLink}\n\nText me anytime to block time, check your leads, or update your schedule 💪`,

      // Lead flow
      missedCall: (bizName) => `Hey! Sorry we missed your call at ${bizName} 👋 What do you need help with today?`,
      askLocation: () => `Got it! What's the address or area where you need the work done?`,
      askUrgency: () => `Thanks! Is this urgent (needs fixing today/tomorrow) or can it wait a few days?`,
      quoteSent: (amount, bookingLink) => `Based on what you described, our estimate is around ${amount}. Ready to book?\n\nPick a time here: ${bookingLink}`,
      followUp1: () => `Hey, just checking in — still need that job done? Reply YES to book a time or let us know if you need something else 😊`,
      followUp2: () => `Our schedule is filling up — just following up on that quote. Need anything else? Reply anytime!`,
      followUp3: () => `Last follow up from us! Reply anytime if you'd like to get scheduled.`,
      bookingReminder: (slot) => `Just a reminder — your appointment is tomorrow at ${slot}. See you then! 👷`,
      reviewRequest: () => `Hope the job went well! 🌟 We'd really appreciate a quick Google review if you have a moment. Thank you!`,
      limitReached: () => `We've reached our message limit for this month. Service resumes next billing cycle.`,

      // Contractor notifications
      leadReady: (issue, location, urgency) => `📋 NEW LEAD\n\nIssue: ${issue}\nLocation: ${location}\nUrgency: ${urgency}\n\nReply with your quote amount (e.g. "$350") to send it to the customer.`,
      newBooking: (customerName, customerPhone, issue, slot) => `📅 NEW BOOKING\n\nCustomer: ${customerName || 'Unknown'}\nPhone: ${customerPhone}\nIssue: ${issue}\nTime: ${slot}\n\nReply DONE when job is complete.`,
      bookingViaLink: (customerName, customerPhone, issue, slot) => `📅 NEW BOOKING (via booking link)\n\nCustomer: ${customerName}\nPhone: ${customerPhone}\nIssue: ${issue}\nTime: ${slot}\n\nReply DONE when job is complete.`,

      // Contractor assistant replies
      timeBlocked: (start, end) => `Got it! I've blocked off ${start} to ${end}. No bookings will be scheduled during that time 👍`,
      statsReply: (leads, booked, pending) => `📊 Your Bookit stats:\n\nLeads this month: ${leads}\nBooked: ${booked}\nPending quotes: ${pending}`,
      unknownCommand: () => `Hey! I didn't quite get that. You can text me things like:\n\n"Block Friday afternoon"\n"I'm off next week"\n"How many leads this month?"`,

      // Lead slot selection
      offerSlots: (a, b, c) => `Great! Here are 3 available times:\n\nA) ${a}\nB) ${b}\nC) ${c}\n\nReply A, B, or C to pick one!`,
      awaitingContractor: () => `Perfect! Let me confirm that time with the team and I'll get right back to you 🙌`,
      contractorPrompt: (details, slotA, slotB, slotC) => `📲 NEW BOOKING REQUEST\n\n${details}\n\nSlots offered:\nA) ${slotA}\nB) ${slotB}\nC) ${slotC}\n\nReply YES to confirm or NO if you're unavailable`,
      bookingConfirmed: (slot) => `You're all set! ✅ Your appointment is confirmed for ${slot}. We'll send a reminder the day before!`,
      newSlotsOffer: (a, b, c) => `Sorry about that! Here are some new available times:\n\nA) ${a}\nB) ${b}\nC) ${c}\n\nReply A, B, or C!`,
    },
    Professional: {
      welcomeStep1: (bizName) => `Thank you for activating Bookit for ${bizName}. Before we go live, what would you like to name your AI assistant?`,
      welcomeStep2: (chosenName) => `Thank you. Your assistant is now named ${chosenName}. Final step: enable missed call forwarding on your phone to your Bookit number. Reply YES when complete.`,
      welcomeStep3: (chosenName, bookingLink) => `You are now live. ${chosenName} will handle missed calls, lead qualification, quotes, and bookings automatically.\n\nYour booking link: ${bookingLink}\n\nReply anytime to manage your schedule.`,
      missedCall: (bizName) => `Thank you for contacting ${bizName}. We missed your call. How can we assist you today?`,
      askLocation: () => `Thank you. Please provide the address or area where the work is needed.`,
      askUrgency: () => `Understood. Is this urgent or is scheduling flexible?`,
      quoteSent: (amount, bookingLink) => `Based on the information provided, our estimate is ${amount}. To schedule an appointment: ${bookingLink}`,
      followUp1: () => `Following up on your recent inquiry. Please let us know if you have any questions or would like to proceed.`,
      followUp2: () => `A reminder that your quote remains available. We look forward to hearing from you.`,
      followUp3: () => `This is our final follow-up. Please contact us when you are ready to proceed.`,
      bookingReminder: (slot) => `This is a reminder of your appointment tomorrow at ${slot}.`,
      reviewRequest: () => `We hope your service experience was satisfactory. We would appreciate a Google review at your convenience.`,
      limitReached: () => `Monthly message limit reached. Service resumes on the next billing date.`,
      leadReady: (issue, location, urgency) => `NEW LEAD\n\nIssue: ${issue}\nLocation: ${location}\nUrgency: ${urgency}\n\nPlease reply with your quote amount to send to the customer.`,
      newBooking: (customerName, customerPhone, issue, slot) => `NEW BOOKING\n\nCustomer: ${customerName || 'Unknown'}\nPhone: ${customerPhone}\nIssue: ${issue}\nTime: ${slot}\n\nReply DONE when job is complete.`,
      bookingViaLink: (customerName, customerPhone, issue, slot) => `NEW BOOKING (booking page)\n\nCustomer: ${customerName}\nPhone: ${customerPhone}\nIssue: ${issue}\nTime: ${slot}\n\nReply DONE when complete.`,
      timeBlocked: (bizName, start, end) => `Confirmed. ${start} to ${end} has been blocked. No appointments will be scheduled during that period.`,
      statsReply: (leads, booked, pending) => `Monthly Summary:\n\nTotal leads: ${leads}\nBooked: ${booked}\nPending: ${pending}`,
      unknownCommand: (bizName) => `I did not understand that request. You can send messages like "Block Friday afternoon" or "How many leads this month?"`,
      offerSlots: (a, b, c) => `We have the following availability:\n\nA) ${a}\nB) ${b}\nC) ${c}\n\nPlease reply A, B, or C to confirm your preferred time.`,
      awaitingContractor: () => `Thank you. We are confirming availability with our team and will respond shortly.`,
      contractorPrompt: (details, slotA, slotB, slotC) => `NEW BOOKING REQUEST\n\n${details}\n\nSlots:\nA) ${slotA}\nB) ${slotB}\nC) ${slotC}\n\nReply YES to confirm or NO if unavailable.`,
      bookingConfirmed: (slot) => `Your appointment has been confirmed for ${slot}. You will receive a reminder the day prior.`,
      newSlotsOffer: (a, b, c) => `We apologize for the inconvenience. New available times:\n\nA) ${a}\nB) ${b}\nC) ${c}\n\nPlease reply A, B, or C.`,
    },
    Direct: {
      welcomeStep1: (bizName) => `Bookit here — ${bizName} is almost live. What do you want to name your assistant?`,
      welcomeStep2: (chosenName) => `${chosenName} it is. Last step: turn on missed call forwarding to your Bookit number. Done? Reply YES`,
      welcomeStep3: (chosenName, bookingLink) => `You're live. ${chosenName} handles everything from here.\n\nBooking link: ${bookingLink}\n\nText anytime to block time or check stats.`,
      missedCall: (bizName) => `Missed your call — ${bizName} here. What do you need?`,
      askLocation: () => `What's the address?`,
      askUrgency: () => `Urgent or can it wait?`,
      quoteSent: (amount, bookingLink) => `Quote: ${amount}. Book here: ${bookingLink}`,
      followUp1: (bookingLink) => `Still need the job done? Book: ${bookingLink}`,
      followUp2: (bookingLink) => `Schedule filling up. Book now: ${bookingLink}`,
      followUp3: () => `Last follow up. Reply anytime to schedule.`,
      bookingReminder: (slot, bizName) => `Tomorrow: ${slot} with ${bizName}. See you then.`,
      reviewRequest: () => `Job done! Leave us a Google review? Thanks.`,
      limitReached: () => `Message limit hit. Resets next month.`,
      leadReady: (issue, location, urgency) => `NEW LEAD\n${issue} | ${location} | ${urgency}\n\nSend quote amount to reply to them.`,
      newBooking: (customerName, customerPhone, issue, slot) => `NEW BOOKING\n${customerName || customerPhone} — ${issue}\n${slot}\n\nReply DONE when complete.`,
      bookingViaLink: (customerName, customerPhone, issue, slot) => `BOOKING (link)\n${customerName} — ${customerPhone}\n${issue} | ${slot}\n\nDONE when complete.`,
      timeBlocked: (bizName, start, end) => `Blocked ${start} to ${end}. No bookings then.`,
      statsReply: (leads, booked, pending) => `This month: ${leads} leads, ${booked} booked, ${pending} pending.`,
      unknownCommand: (bizName) => `Didn't get that. Try: "Block Friday afternoon" or "Stats"`,
      offerSlots: (a, b, c) => `Pick a time:\nA) ${a}\nB) ${b}\nC) ${c}\nReply A, B or C`,
      awaitingContractor: () => `Checking availability now. Back to you shortly.`,
      contractorPrompt: (details, slotA, slotB, slotC) => `NEW JOB\n${details}\nA) ${slotA}\nB) ${slotB}\nC) ${slotC}\nYES to confirm, NO if busy`,
      bookingConfirmed: (slot) => `Booked. ${slot}. Reminder sent day before.`,
      newSlotsOffer: (a, b, c) => `New times:\nA) ${a}\nB) ${b}\nC) ${c}\nReply A, B or C`,
    }
  };
  return templates[style] || templates['Friendly'];
}

module.exports = { getTemplates };
