import { sendAlertEmail } from '../src/utils/email.js';

async function testAlerts() {
  console.log('Testing SendGrid email alerts...');
  
  const htmlBody = `
    <h2>Test Email Alert</h2>
    <p>This is a test email to verify that your SendGrid configuration is working correctly.</p>
    <p>If you received this, the price drop and back-in-stock alerts will work perfectly!</p>
  `;

  const success = await sendAlertEmail('🔔 Price Tracker Alert Test', htmlBody);
  
  if (success) {
    console.log('Test successful! Check your inbox.');
  } else {
    console.log('Test failed. Please ensure SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, and ALERT_TO_EMAIL are set correctly in your .env file.');
  }
  
  process.exit(0);
}

testAlerts();
