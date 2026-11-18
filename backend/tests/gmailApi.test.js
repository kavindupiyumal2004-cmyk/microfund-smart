const test = require('node:test');
const assert = require('node:assert/strict');
const gmail = require('../src/services/gmailApi');

test('Gmail sends MIME over HTTPS and never exposes OAuth failure details', async () => {
  const keys = ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'GMAIL_USER'];
  const old = keys.map((key) => process.env[key]); const originalFetch = global.fetch;
  keys.forEach((key) => { process.env[key] = key === 'GMAIL_USER' ? 'sender@example.com' : 'test-only'; });
  try {
    const calls = [];
    global.fetch = async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => url.includes('oauth2') ? { access_token: 'test-access' } : { id: 'message-1' } };
    };
    const result = await gmail.send({ to: 'recipient@example.com', subject: 'Reset password', text: 'Reset link', html: '<p>Reset link</p>' });
    assert.equal(result.id, 'message-1');
    assert.equal(calls[0].options.body.get('grant_type'), 'refresh_token');
    assert.equal(calls[1].url, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
    const mime = Buffer.from(JSON.parse(calls[1].options.body).raw, 'base64url').toString();
    assert.match(mime, /To: recipient@example.com/); assert.match(mime, /From: sender@example.com/);
    assert.match(mime, /multipart\/alternative/);
    global.fetch = async () => ({ ok: false, json: async () => ({ error: 'secret provider response' }) });
    await assert.rejects(gmail.send({}), /Gmail authorization failed/);
  } finally {
    global.fetch = originalFetch;
    keys.forEach((key, i) => { if (old[i] === undefined) delete process.env[key]; else process.env[key] = old[i]; });
  }
});
