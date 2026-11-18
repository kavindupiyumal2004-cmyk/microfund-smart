const MailComposer = require('nodemailer/lib/mail-composer');

function configured() {
  return ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'GMAIL_USER'].every((key) => Boolean(process.env[key]?.trim()));
}

async function accessToken() {
  if (!configured()) throw new Error('Gmail API credentials are not configured.');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', signal: AbortSignal.timeout(10000),
    body: new URLSearchParams({ client_id: process.env.GMAIL_CLIENT_ID.trim(), client_secret: process.env.GMAIL_CLIENT_SECRET.trim(), refresh_token: process.env.GMAIL_REFRESH_TOKEN.trim(), grant_type: 'refresh_token' }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error('Gmail authorization failed. Check OAuth credentials and refresh token.');
  return data.access_token;
}

async function send(message) {
  const token = await accessToken();
  const mime = await new MailComposer({ ...message, from: process.env.GMAIL_USER.trim(), disableFileAccess: true, disableUrlAccess: true }).compile().build();
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST', signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: mime.toString('base64url') }),
  });
  if (!response.ok) throw new Error(`Gmail API rejected the email (${response.status}). Check API access, sender and quota.`);
  return response.json();
}

module.exports = { configured, accessToken, send };
