const Groq = require('groq-sdk');
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function generateAutoQuote({ issueDescription, location, contractor }) {
  const callout = contractor.callout_fee || 75;
  const hourly = contractor.hourly_rate || 95;
  const markup = contractor.parts_markup || 20;
  const minimum = contractor.job_minimum || 150;

  const prompt = `You are a pricing assistant for a home service business.

A customer has described their issue as: "${issueDescription}"
Their location is: "${location}"
The contractor's rates are:
- Callout/service fee: $${callout}
- Hourly rate: $${hourly}/hr
- Parts markup: ${markup}%
- Job minimum: $${minimum}

Based on the issue described, estimate:
1. How many hours this job typically takes (be realistic)
2. Rough parts cost if any
3. A low and high total price estimate applying the contractor's rates

Return ONLY valid JSON, no explanation:
{
  "job_type": "short name of the job e.g. Burst Pipe Repair",
  "hours_low": 1,
  "hours_high": 2,
  "parts_low": 50,
  "parts_high": 150,
  "total_low": 245,
  "total_high": 395,
  "quote_message": "a single natural casual sentence describing the price range e.g. you're probably looking at $245-395 all in, that covers labor and parts"
}`;

  try {
    const response = await groq.chat.completions.create({
      model: 'llama3-70b-8192',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 300,
    });

    const raw = response.choices[0].message.content;
    const cleaned = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('Auto quote error:', err.message);
    // Fallback to a generic range using contractor minimums
    return {
      job_type: 'Service Call',
      total_low: minimum,
      total_high: minimum * 3,
      quote_message: `you're probably looking at $${minimum}-${minimum * 3} all in depending on what we find`
    };
  }
}

module.exports = { generateAutoQuote };