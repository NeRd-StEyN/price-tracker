import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';
dotenv.config();

const { SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, ALERT_TO_EMAIL } = process.env;

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

export async function sendAlertEmail(subject, htmlBody) {
  if (!SENDGRID_API_KEY || !SENDGRID_FROM_EMAIL || !ALERT_TO_EMAIL) {
    console.log(`[ALERT SKIPPED] Email alert not sent because SendGrid env vars are missing.`);
    console.log(`[ALERT CONTENT] Subject: ${subject}`);
    return false;
  }

  const msg = {
    to: ALERT_TO_EMAIL,
    from: SENDGRID_FROM_EMAIL,
    subject: subject,
    html: htmlBody,
  };

  try {
    await sgMail.send(msg);
    console.log(`[EMAIL SENT] Alert sent successfully to ${ALERT_TO_EMAIL}`);
    return true;
  } catch (error) {
    console.error(`[EMAIL ERROR] Failed to send email alert:`, error);
    if (error.response) {
      console.error(error.response.body);
    }
    return false;
  }
}
