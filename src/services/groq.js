const Groq = require('groq-sdk');
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// For interpreting ambiguous LEAD messages
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

module.exports = { interpretLeadMessage, interpretContractorCommand, interpretMessage };
