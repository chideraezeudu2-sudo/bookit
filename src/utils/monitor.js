require('dotenv').config();

let twilioClient = null;
let alertCooldowns = {};
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between same error alerts

function getClient() {
  if (!twilioClient) {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

async function alertOwner(errorMessage, context = '') {
  if (!process.env.OWNER_PHONE) {
    console.log('No OWNER_PHONE set, skipping alert');
    return;
  }

  const key = errorMessage.slice(0, 50);
  const now = Date.now();

  // Cooldown check - don't spam the same error
  if (alertCooldowns[key] && now - alertCooldowns[key] < COOLDOWN_MS) {
    console.log(`Alert cooldown active for: ${key}`);
    return;
  }

  alertCooldowns[key] = now;

  const body = `BOOKIT ERROR\n\n${errorMessage}${context ? '\n\nContext: ' + context : ''}\n\nCheck Render logs immediately.`;

  try {
    const client = getClient();
    await client.messages.create({
      to: process.env.OWNER_PHONE,
      from: process.env.TWILIO_PHONE_NUMBER,
      body: body.slice(0, 1600)
    });
    console.log('Alert sent to owner');
  } catch (err) {
    console.error('Failed to send alert to owner:', err.message);
  }
}

function setupErrorHandlers() {
  process.on('uncaughtException', async (err) => {
    console.error('UNCAUGHT EXCEPTION:', err.message);
    console.error(err.stack);
    await alertOwner(`Uncaught exception: ${err.message}`);
  });

  process.on('unhandledRejection', async (reason, promise) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    console.error('UNHANDLED REJECTION:', message);
    await alertOwner(`Unhandled rejection: ${message}`);
  });

  // Heartbeat - confirms system is alive every hour
  setInterval(async () => {
    console.log(`Bookit heartbeat - ${new Date().toISOString()} - system running`);
  }, 60 * 60 * 1000);
}

module.exports = { alertOwner, setupErrorHandlers };
