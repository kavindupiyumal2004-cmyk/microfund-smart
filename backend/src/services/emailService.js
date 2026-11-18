const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const gmailApi = require('./gmailApi');
const useGmailApi = () => process.env.MAIL_PROVIDER === 'gmail-api';
const mailConfigured = () => useGmailApi() ? gmailApi.configured() : Boolean(smtpConfig());
let transporter;

function smtpConfig() {
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').replace(/\s+/g, '');
  if (!user || !pass) return null;
  return {
    host: String(process.env.SMTP_HOST || 'smtp.gmail.com').trim(),
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true').toLowerCase() === 'true',
    auth: { user, pass },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  };
}

function getTransporter() {
  if (transporter) return transporter;
  const config = smtpConfig();
  if (!config) return null;
  transporter = nodemailer.createTransport(config);
  return transporter;
}

async function verifySmtp() {
  if (useGmailApi()) {
    try { await gmailApi.accessToken(); return { configured: true, ok: true, message: 'Gmail authorization works. Send a reset request to verify delivery.' }; }
    catch (_error) { return { configured: gmailApi.configured(), ok: false, message: 'Gmail authorization failed. Check OAuth settings.' }; }
  }
  const smtp = getTransporter();
  if (!smtp) return { configured: false, ok: false, message: 'SMTP is not configured.' };
  try {
    await smtp.verify();
    return { configured: true, ok: true, message: 'SMTP connection is working.' };
  } catch (error) {
    logger.error('SMTP verification failed', { message: error.message, code: error.code });
    return { configured: true, ok: false, message: error.message, code: error.code };
  }
}

async function sendMail({ to, subject, html, text }) {
  if (useGmailApi()) return gmailApi.send({ to, subject, html, text });
  const smtp = getTransporter();
  if (!smtp) {
    logger.warn('SMTP is not configured. Email skipped.', { to, subject });
    throw new Error('Email is not configured.');
  }
  try {
    return await smtp.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
      text,
    });
  } catch (error) {
    logger.error('Email sending failed', { to, subject, message: error.message, code: error.code });
    error.code = error.code || 'SMTP_SEND_FAILED';
    throw error;
  }
}

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const money = (value) => `LKR ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const frontendBase = () => String(process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].replace(/\/$/, '');
const appLink = (path = '/dashboard') => `${frontendBase()}${path.startsWith('/') ? path : `/${path}`}`;

const toneMap = {
  success: { start: '#075f48', end: '#0ba879', soft: '#e9fbf4', ink: '#087154', icon: '&#10003;' },
  info: { start: '#0849a3', end: '#2388ff', soft: '#eaf3ff', ink: '#0c5fc4', icon: '&#9679;' },
  warning: { start: '#a24d05', end: '#f29b32', soft: '#fff5e8', ink: '#a95b0c', icon: '!' },
  danger: { start: '#9f2332', end: '#e45261', soft: '#fff0f2', ink: '#b52e3d', icon: '&#10005;' },
};

function detailsRows(details = []) {
  return details.filter((item) => item && item.value !== undefined && item.value !== null && item.value !== '').map((item) => `
    <tr>
      <td style="padding:11px 12px;color:#6b7b90;font-size:12px;border-bottom:1px solid #edf2f7;width:42%;">${escapeHtml(item.label)}</td>
      <td style="padding:11px 12px;color:#13233a;font-size:13px;font-weight:700;text-align:right;border-bottom:1px solid #edf2f7;overflow-wrap:anywhere;">${escapeHtml(item.value)}</td>
    </tr>`).join('');
}

function polishedTemplate({ name, subject, preheader, heading, message, status, tone = 'info', details = [], note, actionLabel = 'Open MicroFund', actionUrl = appLink('/dashboard') }) {
  const colors = toneMap[tone] || toneMap.info;
  const safeName = escapeHtml(name || 'Customer');
  const safeHeading = escapeHtml(heading);
  const safeMessage = escapeHtml(message);
  const safeStatus = escapeHtml(status || 'Update');
  const rows = detailsRows(details);
  const safeNote = note ? escapeHtml(note) : '';
  const plainDetails = details.filter((item) => item?.value !== undefined && item?.value !== null && item?.value !== '').map((item) => `${item.label}: ${item.value}`).join('\n');

  return {
    subject,
    text: `${heading}\n\nHello ${name || 'Customer'},\n${message}\n\n${plainDetails}${note ? `\n\nNote: ${note}` : ''}\n\nOpen MicroFund: ${actionUrl}`,
    html: `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><style>@media(max-width:620px){.mf-card{border-radius:0!important}.mf-pad{padding-left:20px!important;padding-right:20px!important}.mf-title{font-size:26px!important}.mf-button{display:block!important;text-align:center!important}}</style></head>
<body style="margin:0;padding:0;background:#edf3fa;font-family:Arial,'Helvetica Neue',sans-serif;color:#13233a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader || message)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#edf3fa;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="mf-card" style="max-width:640px;background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 18px 55px rgba(8,34,72,.14);">
        <tr><td style="height:7px;background:linear-gradient(90deg,${colors.start},${colors.end});font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td class="mf-pad" style="padding:26px 34px 18px;background:#ffffff;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
            <td style="vertical-align:middle;"><div style="font-size:22px;font-weight:800;color:#071c3a;letter-spacing:-.4px;">&#9670; MicroFund</div><div style="font-size:11px;color:#718096;margin-top:4px;letter-spacing:.8px;text-transform:uppercase;">Smart microfinance processing</div></td>
            <td align="right" style="vertical-align:middle;"><span style="display:inline-block;background:${colors.soft};color:${colors.ink};font-size:11px;font-weight:800;padding:8px 12px;border-radius:999px;text-transform:uppercase;letter-spacing:.5px;">${safeStatus}</span></td>
          </tr></table>
        </td></tr>
        <tr><td class="mf-pad" style="padding:15px 34px 32px;">
          <div style="width:54px;height:54px;line-height:54px;text-align:center;border-radius:16px;background:linear-gradient(135deg,${colors.start},${colors.end});color:#fff;font-size:25px;font-weight:800;margin-bottom:20px;">${colors.icon}</div>
          <div style="font-size:14px;color:#53647a;margin-bottom:7px;">Hello ${safeName},</div>
          <h1 class="mf-title" style="margin:0 0 13px;font-size:31px;line-height:1.18;color:#071c3a;letter-spacing:-.8px;">${safeHeading}</h1>
          <p style="margin:0;color:#53647a;font-size:15px;line-height:1.75;">${safeMessage}</p>
          ${rows ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:23px;border:1px solid #e4ebf4;border-radius:14px;border-collapse:separate;border-spacing:0;overflow:hidden;background:#fbfdff;">${rows}</table>` : ''}
          ${safeNote ? `<div style="margin-top:20px;padding:14px 16px;border-left:4px solid ${colors.end};background:${colors.soft};border-radius:0 10px 10px 0;color:#44556b;font-size:13px;line-height:1.6;"><strong style="color:${colors.ink};">Note:</strong> ${safeNote}</div>` : ''}
          <div style="margin-top:27px;"><a class="mf-button" href="${escapeHtml(actionUrl)}" style="display:inline-block;background:linear-gradient(135deg,${colors.start},${colors.end});color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:11px;font-size:14px;font-weight:800;box-shadow:0 10px 24px rgba(18,103,229,.20);">${escapeHtml(actionLabel)}</a></div>
          <p style="margin:25px 0 0;color:#8795a8;font-size:11px;line-height:1.6;">For your security, sign in only through the official MicroFund application. Never share your password or Gmail App Password with anyone.</p>
        </td></tr>
        <tr><td class="mf-pad" style="padding:18px 34px;background:#071c3a;color:#b7c7da;font-size:11px;line-height:1.6;">
          <strong style="color:#ffffff;">MicroFund</strong><br>Automated account notification &middot; Please do not reply to this email.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  };
}

function importantEventTemplate(name, config = {}) {
  const data = config.data || {};
  const date = (value) => value ? new Date(value).toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' }) : '';
  switch (config.kind) {
    case 'APPLICATION_SUBMITTED':
      return polishedTemplate({ name, subject: `Application received - ${data.application_no}`, heading: 'Your loan application was submitted', message: 'We have securely received your application. The management team will review it and arrange field verification when required.', status: 'Submitted', tone: 'info', details: [{ label: 'Application number', value: data.application_no }, { label: 'Loan type', value: data.loan_type }, { label: 'Requested amount', value: money(data.amount) }, { label: 'Submitted', value: date(data.submitted_at) }], actionLabel: 'Track application', actionUrl: appLink('/dashboard/my-applications') });
    case 'FIELD_VISIT_ASSIGNED_CUSTOMER':
      return polishedTemplate({ name, subject: `Field visit scheduled - ${data.application_no}`, heading: 'Your field verification visit is scheduled', message: 'An agent has been assigned to verify the information related to your loan application.', status: 'Visit scheduled', tone: 'info', details: [{ label: 'Application number', value: data.application_no }, { label: 'Agent', value: data.officer_name }, { label: 'Visit date and time', value: date(data.scheduled_at) }], note: data.instructions, actionLabel: 'View application', actionUrl: appLink('/dashboard/my-applications') });
    case 'FIELD_VISIT_ASSIGNED_OFFICER':
      return polishedTemplate({ name, subject: `New field visit - ${data.application_no}`, heading: 'A new verification visit was assigned to you', message: 'Please review the customer and application details before attending the scheduled visit.', status: 'Assigned', tone: 'info', details: [{ label: 'Application number', value: data.application_no }, { label: 'Customer', value: data.customer_name }, { label: 'Visit date and time', value: date(data.scheduled_at) }, { label: 'Priority', value: data.priority || 'NORMAL' }], note: data.instructions, actionLabel: 'Open field visits', actionUrl: appLink('/dashboard/visits') });
    case 'FIELD_VISIT_UPDATED':
      return polishedTemplate({ name, subject: `Field visit update - ${data.application_no}`, heading: 'Your field visit status was updated', message: 'There is an important update to the field verification visit for your application.', status: String(data.status || 'Updated').replaceAll('_', ' '), tone: data.status === 'CANCELLED' ? 'danger' : 'warning', details: [{ label: 'Application number', value: data.application_no }, { label: 'New status', value: String(data.status || '').replaceAll('_', ' ') }, { label: 'Scheduled date', value: date(data.scheduled_at) }, { label: 'Updated by', value: data.officer_name }], actionLabel: 'View application', actionUrl: appLink('/dashboard/my-applications') });
    case 'VERIFICATION_COMPLETED':
      return polishedTemplate({ name, subject: `Verification completed - ${data.application_no}`, heading: 'Field verification has been completed', message: 'The agent has submitted the verification report. Your application will now continue to document review and the final decision stage.', status: 'Verified', tone: 'success', details: [{ label: 'Application number', value: data.application_no }, { label: 'Completed', value: date(data.completed_at) }], actionLabel: 'Check progress', actionUrl: appLink('/dashboard/my-applications') });
    case 'DOCUMENT_REVIEWED':
      return polishedTemplate({ name, subject: `Document review - ${data.document_title}`, heading: `Your document was ${String(data.decision || 'reviewed').replaceAll('_', ' ').toLowerCase()}`, message: data.decision === 'ACCEPTED' ? 'The document passed the management review.' : 'The management team needs you to check the review note and take the requested action.', status: String(data.decision || 'Reviewed').replaceAll('_', ' '), tone: data.decision === 'ACCEPTED' ? 'success' : (data.decision === 'REJECTED' ? 'danger' : 'warning'), details: [{ label: 'Document', value: data.document_title }, { label: 'Decision', value: String(data.decision || '').replaceAll('_', ' ') }, { label: 'Reviewed', value: date(data.reviewed_at) }], note: data.note, actionLabel: data.decision === 'ACCEPTED' ? 'View documents' : 'Review or re-upload', actionUrl: appLink('/dashboard/documents') });
    case 'LOAN_APPROVED':
      return polishedTemplate({ name, subject: `Loan approved - ${data.loan_no}`, heading: 'Congratulations, your loan was approved', message: 'Your loan account and repayment schedule have been created successfully. Please review the installment dates and amounts carefully.', status: 'Approved', tone: 'success', details: [{ label: 'Loan number', value: data.loan_no }, { label: 'Application number', value: data.application_no }, { label: 'Approved principal', value: money(data.principal) }, { label: `${data.repayment_frequency === 'WEEKLY' ? 'Weekly' : 'Monthly'} installment`, value: money(data.monthly_installment) }, { label: 'Total payable', value: money(data.total_payable) }, { label: 'First installment date', value: data.start_date }, { label: 'Final installment date', value: data.end_date }], note: data.admin_note, actionLabel: 'View loan schedule', actionUrl: appLink('/dashboard/my-loans') });
    case 'LOAN_REJECTED':
      return polishedTemplate({ name, subject: `Application decision - ${data.application_no}`, heading: 'Your loan application was not approved', message: 'The administration team has completed the review and recorded a decision on your application.', status: 'Not approved', tone: 'danger', details: [{ label: 'Application number', value: data.application_no }, { label: 'Decision date', value: date(data.decided_at) }], note: data.reason, actionLabel: 'View application', actionUrl: appLink('/dashboard/my-applications') });
    case 'PAYMENT_SLIP_SUBMITTED':
      return polishedTemplate({ name, subject: `Payment slip received - ${data.submission_no}`, heading: 'Your payment slip was received', message: 'The uploaded slip is waiting for cashier verification. It will only be added to your loan after it is accepted.', status: 'Under verification', tone: 'info', details: [{ label: 'Submission number', value: data.submission_no }, { label: 'Loan number', value: data.loan_no }, { label: 'Amount', value: money(data.amount) }, { label: 'Bank reference', value: data.reference_no }, { label: 'Submitted', value: date(data.submitted_at) }], actionLabel: 'Track payment slip', actionUrl: appLink('/dashboard/payment-slips') });
    case 'PAYMENT_SLIP_ACCEPTED':
      return polishedTemplate({ name, subject: `Payment accepted - ${data.receipt_no}`, heading: data.loan_completed ? 'Payment accepted and your loan is fully settled' : 'Your payment has been accepted', message: data.loan_completed ? 'Thank you. The verified payment has cleared the final outstanding balance on your loan.' : 'The cashier verified your bank slip and the payment has now been added to your loan account.', status: data.loan_completed ? 'Loan completed' : 'Payment accepted', tone: 'success', details: [{ label: 'Receipt number', value: data.receipt_no }, { label: 'Submission number', value: data.submission_no }, { label: 'Loan number', value: data.loan_no }, { label: 'Amount paid', value: money(data.amount) }, { label: 'Remaining balance', value: money(data.remaining_balance) }, { label: 'Payment date', value: date(data.paid_at) }], actionLabel: 'View payment history', actionUrl: appLink('/dashboard/my-loans') });
    case 'PAYMENT_SLIP_REJECTED':
      return polishedTemplate({ name, subject: `Payment slip rejected - ${data.submission_no}`, heading: 'Your payment slip could not be accepted', message: 'The uploaded evidence did not pass cashier verification. No payment was added to the loan.', status: 'Rejected', tone: 'danger', details: [{ label: 'Submission number', value: data.submission_no }, { label: 'Loan number', value: data.loan_no }, { label: 'Amount', value: money(data.amount) }], note: data.note, actionLabel: 'Review and submit again', actionUrl: appLink('/dashboard/payment-slips') });
    case 'PAYMENT_CLARIFICATION_REQUIRED':
      return polishedTemplate({ name, subject: `More payment details required - ${data.submission_no}`, heading: 'The cashier needs more information', message: 'Please read the cashier note and provide the requested clarification or a clearer payment slip.', status: 'Action required', tone: 'warning', details: [{ label: 'Submission number', value: data.submission_no }, { label: 'Loan number', value: data.loan_no }, { label: 'Amount', value: money(data.amount) }], note: data.note, actionLabel: 'Respond to cashier', actionUrl: appLink('/dashboard/payment-slips') });
    case 'PAYMENT_RECEIVED':
      return polishedTemplate({ name, subject: `${data.loan_completed ? 'Loan settled' : 'Payment received'} - ${data.receipt_no}`, heading: data.loan_completed ? 'Your loan has been fully settled' : 'Your installment payment was recorded', message: data.loan_completed ? 'Thank you. This payment cleared the remaining balance and the loan status is now completed.' : 'A cashier recorded your payment successfully and updated the repayment schedule.', status: data.loan_completed ? 'Loan completed' : 'Paid', tone: 'success', details: [{ label: 'Receipt number', value: data.receipt_no }, { label: 'Loan number', value: data.loan_no }, { label: 'Amount paid', value: money(data.amount) }, { label: 'Payment method', value: String(data.method || '').replaceAll('_', ' ') }, { label: 'Remaining balance', value: money(data.remaining_balance) }, { label: 'Payment date', value: date(data.paid_at) }], actionLabel: 'View loan and receipt', actionUrl: appLink('/dashboard/my-loans') });
    default:
      return polishedTemplate({ name, subject: config.subject || 'Important MicroFund update', heading: config.heading || 'Important account update', message: config.message || 'There is a new update related to your MicroFund account.', status: config.status || 'Update', tone: config.tone || 'info', details: config.details || [], note: config.note, actionLabel: config.actionLabel, actionUrl: config.actionUrl || appLink('/dashboard') });
  }
}


const resetTemplate = (name, url) => polishedTemplate({ name, subject: 'Reset your MicroFund password', heading: 'Create a new password', message: 'We received a request to reset the password for your MicroFund account. Use the secure button below to continue.', status: 'Security request', tone: 'warning', details: [{ label: 'Link expiry', value: `${process.env.TOKEN_EXPIRY_MINUTES || 30} minutes` }], note: 'If you did not request this change, do not open the link. Your current password remains unchanged.', actionLabel: 'Reset password', actionUrl: url });

module.exports = { mailConfigured, sendMail, verifySmtp, resetTemplate, importantEventTemplate };
