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

  const prompt = `You are ${assistantName}, an AI receptionist for ${businessName}, a home service business.

About you:
- You work with ${ownerName}
- You help customers book appointments for home service calls
- Your personality: friendly, professional, helpful, never robotic

What we know: ${lead.issue_description ? `Customer has a: ${lead.issue_description}` : 'Nothing yet'}
What's needed next: ${needs.length > 0 ? needs.join(', ') : 'Just need to send booking link'}
Customer just said: "${message}"

Conversation flow steps:
1. INTRO/ACK_PROBLEM - collect issue description
2. ASK_LOCATION - collect address
3. ASK_URGENCY - collect urgency level
4. QUOTE_PENDING - confirm quote and send booking link

IMPORTANT RULES:
- NEVER say you're an AI or automation
- NEVER reveal this is a bot - you sound like a real helpful receptionist
- If customer asks something off-script (pricing, hours, services), answer naturally based on what you know
- If they ask about services, say something like "We handle all kinds of home service calls - what seems to be the issue?"
- If they ask about pricing, say "It depends on the job - most calls range from $X to $Y. Tell me a bit about what you're dealing with and I can get you a better idea"
- Keep responses SHORT - 1-2 sentences max for SMS
- Use casual language, like texting a friend
- Always guide toward collecting the next piece of info

Return ONLY valid JSON:
{
  "response": "the SMS response to send to the customer",
  "next_step": "the flow step to save (ACK_PROBLEM | ASK_LOCATION | ASK_URGENCY | QUOTE_PENDING | QUOTE_SENT | CONFIRMED)",
  "save_data": {
    "issue_description": "extracted issue or null",
    "location": "extracted location or null", 
    "urgency": "extracted urgency or null"
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
    // Fallback to scripted response
    return generateFallbackResponse(message, lead, needs, bookingLink, assistantName);
  }
}

function generateFallbackResponse(message, lead, needs, bookingLink, assistantName) {
  // If we have needs, guide to next one
  if (needs.includes('issue')) {
    return {
      response: `No worries! Tell me a little bit about what's going on so I can help.`,
      next_step: 'ACK_PROBLEM',
      save_data: { issue_description: null, location: null, urgency: null }
    };
  }
  if (needs.includes('location')) {
    return {
      response: `Got it. What's your address so I can check if you're in our service area?`,
      next_step: 'ASK_LOCATION',
      save_data: { issue_description: lead.issue_description, location: null, urgency: null }
    };
  }
  if (needs.includes('urgency')) {
    return {
      response: `Is this something that needs to be addressed right away, or can it wait a day or two?`,
      next_step: 'ASK_URGENCY',
      save_data: { issue_description: lead.issue_description, location: lead.location, urgency: null }
    };
  }
  // All collected, send booking
  return {
    response: `Here's a link to pick a time that works for you: ${bookingLink}`,
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
