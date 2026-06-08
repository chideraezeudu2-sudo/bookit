const Groq = require('groq-sdk');
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function interpretMessage({ message, context, flowStep }) {
  const prompt = `You are an SMS assistant for a home service business booking system.

Current flow step: ${flowStep}
Conversation context: ${context}
Customer message: "${message}"

Your job is to interpret what the customer means and return a JSON object with:
- intent: one of [PROVIDE_INFO, PICK_SLOT_A, PICK_SLOT_B, PICK_SLOT_C, CONFIRM_YES, CONFIRM_NO, STOP, QUESTION, UNCLEAR]
- extracted_value: the key piece of info extracted (e.g. their address, description, chosen slot)
- confidence: high | medium | low

Return ONLY valid JSON. No explanation.`;

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 200,
    });

    try {
      return JSON.parse(response.choices[0].message.content);
    } catch {
      return { intent: 'UNCLEAR', extracted_value: null, confidence: 'low' };
    }
  } catch (err) {
    console.error('Groq error:', err.message);
    return { intent: 'UNCLEAR', extracted_value: null, confidence: 'low' };
  }
}

module.exports = { interpretMessage };