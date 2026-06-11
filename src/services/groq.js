const Groq = require('groq-sdk');
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Main conversational AI brain - generates intelligent responses based on flow context
 */
async function generateAIResponse({ message, lead, contractor, flowStep }) {
  const bookingLink = `${process.env.BASE_URL}/book/${contractor.booking_slug}`;
  const assistantName = contractor.assistant_name || 'Sarah';
  const ownerName = contractor.owner_name || 'the team';
  const businessName = contractor.business_name || 'our business';

  // Determine what info we still need
  const needs = [];
  if (!lead.issue_description) needs.push('issue');
  if (!lead.location) needs.push('location');
  if (!lead.urgency) needs.push('urgency');

  const prompt = `You are ${assistantName}, an AI receptionist for ${businessName}.

IMPORTANT - Follow this decision logic:

1. FIRST check if customer's message fits the script (respond with scripted message)
2. ONLY use free-form response if customer says something OFF-SCRIPT

SCRIPT MESSAGES (use these as your default response):
- After missed call, customer replies with issue -> "Sorry you're dealing with that. Let me get a little info about your problem so we can know what we are dealing with"
- Customer mentions address -> "Is this an emergency or can it wait a day or two?"
- Customer mentions urgency/time preference -> Send quote + booking link

OFF-SCRIPT EXAMPLES (only respond freely for these):
- "Do you work weekends?" -> "We're pretty flexible, what's the issue?"
- "How much is a visit?" -> "Depends on the job, most calls run [range]. Tell me what you're dealing with"
- "Are you available tomorrow?" -> "Depends on what you're dealing with, what's the issue?"

NO EM DASHES. Short, casual, like texting a friend.

Current context:
- Flow step: ${flowStep}
- We know: ${lead.issue_description ? 'Issue: ' + lead.issue_description : 'Nothing yet'}
- Needs next: ${needs.length > 0 ? needs.join(', ') : 'Just send booking link'}
- Customer said: "${message}"

Return ONLY valid JSON (no markdown, no em dashes):
{
  "response": "short SMS response",
  "next_step": "ACK_PROBLEM | ASK_LOCATION | ASK_URGENCY | QUOTE_PENDING | QUOTE_SENT | CONFIRMED",
  "is_off_script": true or false,
  "save_data": {
    "issue_description": "extracted or null",
    "location": "extracted or null",
    "urgency": "extracted or null"
  }
}`;

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 300,
    });

    const raw = response.choices[0].message.content;
    const cleaned = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('AI response error:', err.message);
    return generateFallbackResponse(message, lead, needs, bookingLink, assistantName);
  }
}

function generateFallbackResponse(message, lead, needs, bookingLink, assistantName) {
  // Use the personalized script voice as fallback
  if (needs.includes('issue')) {
    return {
      response: `Sorry you're dealing with that. Let me get a little info about your problem so we can know what we are dealing with`,
      next_step: 'ACK_PROBLEM',
      save_data: { issue_description: null, location: null, urgency: null }
    };
  }
  if (needs.includes('location')) {
    return {
      response: `What's your address?`,
      next_step: 'ASK_LOCATION',
      save_data: { issue_description: lead.issue_description, location: null, urgency: null }
    };
  }
  if (needs.includes('urgency')) {
    return {
      response: `Is this an emergency or can it wait a day or two?`,
      next_step: 'ASK_URGENCY',
      save_data: { issue_description: lead.issue_description, location: lead.location, urgency: null }
    };
  }
  // All collected, send booking
  return {
    response: `Awesome. Here's an our booking link for you pick a schedule and a time that works for you. ${bookingLink}`,
    next_step: 'QUOTE_SENT',
    save_data: { issue_description: lead.issue_description, location: lead.location, urgency: lead.urgency }
  };
}

// For interpreting ambiguous LEAD messages (legacy)
async function interpretLeadMessage({ message, context, flowStep }) {
  const prompt = `You are an SMS assistant for a home service business booking system.

Current flow step: ${flowStep}
Context: ${context}
Customer message: "${message}"

Interpret the customer's intent. Return ONLY valid JSON:
{
  "intent": "PROVIDE_INFO | PICK_SLOT_A | PICK_SLOT_B | PICK_SLOT_C | CONFIRM_YES | CONFIRM_NO | STOP | UNCLEAR",
  "extracted_value": "the key info extracted or null",
  "confidence": "high | medium | low"
}`;

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    max_tokens: 150,
  });

  try {
    return JSON.parse(response.choices[0].message.content);
  } catch {
    return { intent: 'UNCLEAR', extracted_value: null, confidence: 'low' };
  }
}

// For interpreting freeform CONTRACTOR commands
async function interpretContractorCommand({ message, assistantName }) {
  const prompt = `You are ${assistantName}, an AI assistant for a home service contractor. The contractor just sent you a text message.

Contractor message: "${message}"

Identify what the contractor wants to do. Return ONLY valid JSON:
{
  "command": "BLOCK_TIME | CANCEL_BOOKING | UPDATE_HOURS | GET_STATS | UNKNOWN",
  "details": {
    "start": "ISO datetime string or null",
    "end": "ISO datetime string or null",
    "description": "human readable summary of what they want"
  }
}

For BLOCK_TIME: extract start and end datetimes from natural language like "Friday afternoon", "next week", "tomorrow morning"
For time ranges without explicit times: morning = 8am-12pm, afternoon = 12pm-5pm, evening = 5pm-8pm
Always use the current year. Today is ${new Date().toDateString()}.`;

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    max_tokens: 300,
  });

  try {
    return JSON.parse(response.choices[0].message.content);
  } catch {
    return { command: 'UNKNOWN', details: { description: message } };
  }
}

// Legacy function for backward compatibility
async function interpretMessage({ message, context, flowStep }) {
  return interpretLeadMessage({ message, context, flowStep });
}

module.exports = { generateAIResponse, interpretLeadMessage, interpretContractorCommand, interpretMessage };
