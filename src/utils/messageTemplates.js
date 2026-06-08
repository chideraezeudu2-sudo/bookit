function getTemplates(style = 'Friendly') {
  const templates = {
    Friendly: {
      missedCall: (bizName) => `Hey! Sorry we missed your call at ${bizName} 👋 What do you need help with today?`,
      askLocation: () => `Got it! What's the address or area where you need the work done?`,
      askUrgency: () => `Thanks! Is this urgent (needs fixing today/tomorrow) or can it wait a few days?`,
      quoteSent: (amount) => `Based on what you described, our estimate is around ${amount}. Want to book an appointment?`,
      followUp1: () => `Hey, just checking in — still interested in booking? Happy to help! 😊`,
      followUp2: () => `One more follow up — our schedule is filling up. Want to lock in a time?`,
      followUp3: () => `Last message from us — if you'd like to book anytime, just reply and we'll get you sorted!`,
      offerSlots: (a, b, c) => `Great! Here are 3 available times:\n\nA) ${a}\nB) ${b}\nC) ${c}\n\nReply A, B, or C to pick one!`,
      awaitingContractor: () => `Perfect! Let me confirm that time with the team and I'll get right back to you 🙌`,
      contractorPrompt: (details, slotA, slotB, slotC) => `📲 NEW BOOKING REQUEST\n\n${details}\n\nSlots offered:\nA) ${slotA}\nB) ${slotB}\nC) ${slotC}\n\nReply YES to confirm or NO if you're unavailable`,
      bookingConfirmed: (slot) => `You're all set! ✅ Your appointment is confirmed for ${slot}. We'll send a reminder the day before!`,
      bookingReminder: (slot) => `Just a reminder — your appointment is tomorrow at ${slot}. See you then! 👷`,
      reviewRequest: () => `Hope the job went well! 🌟 We'd really appreciate a quick Google review if you have a moment. Thank you!`,
      limitReached: () => `We've reached our message limit for this month. Service resumes next billing cycle.`,
      newSlotsOffer: (a, b, c) => `Sorry about that! Here are some new available times:\n\nA) ${a}\nB) ${b}\nC) ${c}\n\nReply A, B, or C!`,
    },
    Professional: {
      missedCall: (bizName) => `Thank you for contacting ${bizName}. We missed your call. How can we assist you today?`,
      askLocation: () => `Thank you. Could you please provide the address or area where the work is needed?`,
      askUrgency: () => `Understood. Is this an urgent matter requiring immediate attention, or is scheduling flexible?`,
      quoteSent: (amount) => `Based on the information provided, our estimated quote is ${amount}. Would you like to schedule an appointment?`,
      followUp1: () => `We wanted to follow up regarding your recent inquiry. Are you still interested in scheduling service?`,
      followUp2: () => `A reminder that your quote is still available. Please reply to schedule at your convenience.`,
      followUp3: () => `This is our final follow-up. We remain available should you wish to proceed.`,
      offerSlots: (a, b, c) => `We have the following availability:\n\nA) ${a}\nB) ${b}\nC) ${c}\n\nPlease reply A, B, or C to confirm your preferred time.`,
      awaitingContractor: () => `Thank you. We are confirming availability with our team and will respond shortly.`,
      contractorPrompt: (details, slotA, slotB, slotC) => `NEW BOOKING REQUEST\n\n${details}\n\nSlots:\nA) ${slotA}\nB) ${slotB}\nC) ${slotC}\n\nReply YES to confirm or NO if unavailable.`,
      bookingConfirmed: (slot) => `Your appointment has been confirmed for ${slot}. You will receive a reminder the day prior.`,
      bookingReminder: (slot) => `This is a reminder of your appointment scheduled for tomorrow at ${slot}.`,
      reviewRequest: () => `We hope your service experience was satisfactory. We would appreciate a Google review at your convenience.`,
      limitReached: () => `Monthly message limit reached. Service will resume on the next billing date.`,
      newSlotsOffer: (a, b, c) => `We apologize for the inconvenience. New available times:\n\nA) ${a}\nB) ${b}\nC) ${c}\n\nPlease reply A, B, or C.`,
    },
    Direct: {
      missedCall: (bizName) => `Missed your call — ${bizName} here. What do you need?`,
      askLocation: () => `What's the address?`,
      askUrgency: () => `Urgent or can it wait?`,
      quoteSent: (amount) => `Quote: ${amount}. Want to book?`,
      followUp1: () => `Still need that job done? Reply to book.`,
      followUp2: () => `Schedule filling up. Still want to book?`,
      followUp3: () => `Last follow up. Reply anytime to schedule.`,
      offerSlots: (a, b, c) => `Pick a time:\nA) ${a}\nB) ${b}\nC) ${c}\nReply A, B, or C`,
      awaitingContractor: () => `Checking availability now. Back to you shortly.`,
      contractorPrompt: (details, slotA, slotB, slotC) => `NEW JOB\n${details}\nA) ${slotA}\nB) ${slotB}\nC) ${slotC}\nYES to confirm, NO if busy`,
      bookingConfirmed: (slot) => `Booked. ${slot}. Reminder sent day before.`,
      bookingReminder: (slot) => `Tomorrow: ${slot}. See you then.`,
      reviewRequest: () => `Job done! Leave us a Google review? Takes 1 min. Thanks.`,
      limitReached: () => `Message limit hit. Resets next month.`,
      newSlotsOffer: (a, b, c) => `New times:\nA) ${a}\nB) ${b}\nC) ${c}\nReply A, B or C`,
    }
  };
  return templates[style] || templates['Friendly'];
}

module.exports = { getTemplates };