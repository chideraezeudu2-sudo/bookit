const { sendSMS } = require('../services/sms');

async function alertOwner(errorMessage) {
  if (!process.env.OWNER_PHONE || !process.env.TWILIO_PHONE_NUMBER) {
    console.log('Owner phone not configured, skipping alert:', errorMessage);
    return;
  }
  
  try {
    await sendSMS({
      to: process.env.OWNER_PHONE,
      from: process.env.TWILIO_PHONE_NUMBER,
      body: `🚨 BOOKIT ERROR\n\n${errorMessage}\n\nCheck Render logs immediately.`,
      contractorId: null
    });
  } catch (err) {
    console.error('Failed to alert owner:', err.message);
  }
}

process.on('uncaughtException', async (err) => {
  console.error('Uncaught exception:', err);
  await alertOwner(`Uncaught exception: ${err.message}`);
});

process.on('unhandledRejection', async (reason) => {
  console.error('Unhandled rejection:', reason);
  await alertOwner(`Unhandled rejection: ${String(reason)}`);
});

module.exports = { alertOwner };
