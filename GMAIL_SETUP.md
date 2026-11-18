# Gmail and password security setup

All roles can use Dashboard > Account security or the profile menu > Change password. They must enter the current password and a different new password. Password changes and resets invalidate existing JWT sessions and unused reset links. Deployment of this update also requires existing users to sign in again. No database migration is required.

## Render Free: Gmail API over HTTPS

Render Free blocks outbound SMTP ports 25, 465 and 587. A Gmail app password cannot remove this restriction. Use the Gmail API option below. Credentials belong only in Render's backend environment, never in Vercel variables, source control or chat.

1. Open https://console.cloud.google.com/ and create/select a project for MicroFund.
2. Under APIs & Services > Library, enable Gmail API.
3. Configure Google Auth Platform / OAuth consent: app name, support email, audience, contact email. For initial testing, add the Gmail sender account as a test user. Add the scope `https://www.googleapis.com/auth/gmail.send` (send only).
4. Create an OAuth client of type Web application. Add this authorized redirect URI: `https://developers.google.com/oauthplayground`.
5. Open https://developers.google.com/oauthplayground/. In settings, select **Use your own OAuth credentials**, enter that client ID and secret, and use Offline access with consent prompting. Do not use the Playground's default credentials.
6. Enter the scope `https://www.googleapis.com/auth/gmail.send`, authorize using the Gmail account that will send MicroFund mail, then exchange the authorization code for tokens. Copy the refresh token privately.
7. Render Dashboard > microfund-smart > Environment > Edit: add the values below, then Save and redeploy.

```dotenv
MAIL_PROVIDER=gmail-api
GMAIL_USER=your-sender@gmail.com
GMAIL_CLIENT_ID=your-client-id
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REFRESH_TOKEN=your-refresh-token
FRONTEND_URL=https://microfund-smart.vercel.app
TOKEN_EXPIRY_MINUTES=30
```

Use the same Gmail account in GMAIL_USER and the authorization step. The implementation sends from GMAIL_USER. SMTP_USER/SMTP_PASS are not used when MAIL_PROVIDER=gmail-api. All existing email notifications use the selected provider too.

**Long-term operation:** External OAuth apps in Testing issue Gmail refresh tokens that expire after 7 days. Before relying on recovery, move the consent app to Production and follow Google's verification requirements applicable to your app, then authorize again and replace the refresh token. Password changes on the sender Google account or revoked consent can invalidate Gmail refresh tokens. Reauthorize if necessary; do not merely rotate an SMTP app password for Gmail API mode.

## Gmail SMTP: local development or a host allowing SMTP

Enable 2-Step Verification in the sending Google account, then visit https://myaccount.google.com/apppasswords. Revoke the old app password if replacing it and create one named MicroFund. Put its generated value in `SMTP_PASS` in backend/.env for local development, or Render > service > Environment on an SMTP-capable paid instance. Do not use your normal Google password.

```dotenv
MAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-sender@gmail.com
SMTP_PASS=your-generated-app-password
MAIL_FROM=MicroFund <your-sender@gmail.com>
FRONTEND_URL=https://microfund-smart.vercel.app
TOKEN_EXPIRY_MINUTES=30
```

This SMTP configuration will not work on Render Free. Changing the Google account password revokes app passwords; generate a replacement and update SMTP_PASS.

## Verify after configuring

1. Use an active MicroFund account with a real deliverable email address. Seed accounts ending in `@microfund.local` cannot receive public email.
2. Open Forgot password, enter that address, and check Inbox/Spam. The public response deliberately does not reveal whether an account exists or expose a reset token.
3. Open the link, set a new password, then sign in. The link must fail if used again. The old password and old sessions must fail.
4. Try Account security with an incorrect current password (must fail), then the correct current password (must save and sign out).
5. If no email arrives, check Render logs for `Password reset email delivery failed` and Google API credentials/quotas. Authenticated Managers can GET `/api/auth/smtp-status` with their bearer token to check provider authorization; a successful authorization check alone does not prove inbox delivery.

Automated tests mock Google endpoints and database writes. Real Google authorization and delivery must be checked after deployment. No real emails are sent by the tests.

References: https://render.com/docs/free ; https://developers.google.com/workspace/gmail/api/guides/sending ; https://developers.google.com/identity/protocols/oauth2 ; https://support.google.com/accounts/answer/185833
