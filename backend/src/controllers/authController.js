const bcrypt = require('bcryptjs');
const dayjs = require('dayjs');
const { Op } = require('sequelize');
const { User, Role, CustomerProfile, Area, EmailToken } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');
const { createJwt, createOpaqueToken, hashOpaqueToken } = require('../utils/tokens');
const { sendMail, verifySmtp, resetTemplate, mailConfigured } = require('../services/emailService');
const logger = require('../utils/logger');
const { audit } = require('../services/auditService');

const sanitizeUser = (user) => ({
  id: user.id,
  full_name: user.full_name,
  email: user.email,
  role: user.Role?.name,
  is_active: user.is_active,
  email_verified_at: user.email_verified_at,
  profile: user.CustomerProfile || null,
});

async function issueEmailToken(user, type, hours) {
  const { raw, hash } = createOpaqueToken();
  await EmailToken.destroy({ where: { user_id: user.id, type, used_at: null } });
  await EmailToken.create({ user_id: user.id, type, token_hash: hash, expires_at: dayjs().add(hours, 'hour').toDate() });
  return raw;
}

exports.register = asyncHandler(async (req, res) => {
  const role = await Role.findOne({ where: { name: 'CUSTOMER' } });
  if (!role) {
    throw new AppError('System roles are not initialized. Run the seed command.', 500);
  }
  const email = req.body.email.toLowerCase().trim();
  const [existingEmail, existingNic] = await Promise.all([
    User.findOne({ where: { email } }),
    CustomerProfile.findOne({ where: { nic: req.body.nic.trim() } }),
  ]);
  if (existingEmail || existingNic) {
    throw new AppError('An account already exists with this email or NIC.', 409, 'ACCOUNT_EXISTS');
  }
  const area = await Area.findByPk(req.body.area_id);
  if (!area || !area.is_active) {
    throw new AppError('Please select a valid service area.', 422, 'INVALID_AREA');
  }

  const transaction = await User.sequelize.transaction();
  let user;
  try {
    user = await User.create({
      full_name: req.body.full_name.trim(),
      email,
      password_hash: await bcrypt.hash(req.body.password, 12),
      role_id: role.id,
      is_active: true,
    }, { transaction });
    user.CustomerProfile = await CustomerProfile.create({
      user_id: user.id,
      nic: req.body.nic.trim(),
      phone: req.body.phone.trim(),
      address_line1: req.body.address_line1.trim(),
      city: req.body.city.trim(),
      area_id: Number(req.body.area_id),
      occupation: req.body.occupation?.trim() || null,
      monthly_income: req.body.monthly_income ? Number(req.body.monthly_income) : null,
    }, { transaction });

    await transaction.commit();
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }

  await audit(req, 'CUSTOMER_REGISTERED', 'User', user.id, { email: user.email, documents_pending: true });
  res.status(201).json({
    success: true,
    message: 'Your account is ready. Upload your documents before applying for a loan.',
    token: createJwt({ id: user.id, password_hash: user.password_hash, role_name: role.name }),
    user: { ...sanitizeUser(user), role: role.name },
  });
});

exports.login = asyncHandler(async (req, res) => {
  const user = await User.findOne({ where: { email: req.body.email.toLowerCase().trim() }, include: [Role, { model: CustomerProfile, as: 'CustomerProfile' }] });
  if (!user || !(await bcrypt.compare(req.body.password, user.password_hash))) {
    await audit(req, 'LOGIN_FAILED', 'User', user?.id, { email: req.body.email });
    throw new AppError('The email or password is incorrect.', 401, 'INVALID_CREDENTIALS');
  }
  if (!user.is_active) throw new AppError('This account has been disabled.', 403, 'ACCOUNT_DISABLED');
  await user.update({ last_login_at: new Date() });
  await audit(req, 'LOGIN_SUCCESS', 'User', user.id);
  res.json({ success: true, token: createJwt(user), user: sanitizeUser(user) });
});

exports.me = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id, { include: [Role, { model: CustomerProfile, as: 'CustomerProfile', include: [Area] }] });
  res.json({ success: true, user: sanitizeUser(user) });
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  if (!mailConfigured()) throw new AppError('Password reset email is unavailable. Please contact your manager.', 503, 'EMAIL_UNAVAILABLE');
  const user = await User.findOne({ where: { email: req.body.email.toLowerCase().trim() } });
  if (user && user.is_active) {
    const token = await issueEmailToken(user, 'RESET_PASSWORD', Number(process.env.TOKEN_EXPIRY_MINUTES || 30) / 60);
    const frontend = String(process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/$/, '');
    try {
      await sendMail({ to: user.email, ...resetTemplate(user.full_name, frontend + '/reset-password?token=' + token) });
    } catch (_error) {
      await EmailToken.destroy({ where: { token_hash: hashOpaqueToken(token), type: 'RESET_PASSWORD' } });
      logger.error('Password reset email delivery failed. Check mail provider configuration.');
    }
  }
  // Keep the response identical for unknown, disabled and active accounts.
  res.json({ success: true, message: 'If the address belongs to an active account, we will attempt to send a reset link. Check your inbox and spam folder. If it does not arrive, contact your manager.' });
});

exports.changePassword = asyncHandler(async (req, res) => {
  await User.sequelize.transaction(async (transaction) => {
    const user = await User.findByPk(req.user.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user || !user.is_active) throw new AppError('Account unavailable.', 403);
    if (!(await bcrypt.compare(req.body.current_password, user.password_hash))) throw new AppError('Current password is incorrect.', 400, 'INCORRECT_PASSWORD');
    if (await bcrypt.compare(req.body.password, user.password_hash)) throw new AppError('Choose a different new password.', 422);
    await user.update({ password_hash: await bcrypt.hash(req.body.password, 12) }, { transaction });
    await EmailToken.update({ used_at: new Date() }, { where: { user_id: user.id, type: 'RESET_PASSWORD', used_at: null }, transaction });
  });
  req.app?.get('io')?.in('user:' + req.user.id).disconnectSockets(true);
  await audit(req, 'PASSWORD_CHANGED', 'User', req.user.id);
  res.json({ success: true, message: 'Password changed. Please sign in again.' });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const hash = hashOpaqueToken(req.body.token);
  let userId;
  await User.sequelize.transaction(async (transaction) => {
    const candidate = await EmailToken.findOne({ where: { token_hash: hash, type: 'RESET_PASSWORD' }, transaction });
    if (!candidate) throw new AppError('The reset link is invalid or has expired.', 400, 'INVALID_RESET_TOKEN');
    // Lock the user first so reset and authenticated password changes serialize.
    const user = await User.findByPk(candidate.user_id, { transaction, lock: transaction.LOCK.UPDATE });
    const token = await EmailToken.findOne({ where: { id: candidate.id, used_at: null, expires_at: { [Op.gt]: new Date() } }, transaction, lock: transaction.LOCK.UPDATE });
    if (!token || !user || !user.is_active) throw new AppError('The reset link is invalid or has expired.', 400, 'INVALID_RESET_TOKEN');
    await user.update({ password_hash: await bcrypt.hash(req.body.password, 12) }, { transaction });
    await EmailToken.update({ used_at: new Date() }, { where: { user_id: user.id, type: 'RESET_PASSWORD', used_at: null }, transaction });
    userId = user.id;
  });
  req.app?.get('io')?.in('user:' + userId).disconnectSockets(true);
  await audit(req, 'PASSWORD_RESET', 'User', userId);
  res.json({ success: true, message: 'Password changed successfully. Please sign in.' });
});

exports.smtpStatus = asyncHandler(async (_req, res) => {
  const status = await verifySmtp();
  res.status(status.ok ? 200 : 503).json({ success: status.ok, data: status });
});
