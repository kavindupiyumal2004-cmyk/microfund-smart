const bcrypt = require('bcryptjs');
const dayjs = require('dayjs');
const { Op } = require('sequelize');
const path = require('path');
const { User, Role, CustomerProfile, CustomerDocument, Area, EmailToken } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');
const { createJwt, createOpaqueToken, hashOpaqueToken } = require('../utils/tokens');
const { sendMail, verifySmtp, resetTemplate } = require('../services/emailService');
const { audit } = require('../services/auditService');
const { sha256File, cleanupMulterFiles } = require('../utils/files');

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

function fileRecord(userId, type, file, title) {
  return sha256File(file.path).then((file_hash) => ({
    user_id: userId,
    document_type: type,
    title,
    file_path: file.path,
    original_name: file.originalname,
    mime_type: file.mimetype,
    size_bytes: file.size,
    file_hash,
    status: 'PENDING',
  }));
}

exports.register = asyncHandler(async (req, res) => {
  const requiredFiles = ['nic_front', 'nic_back', 'residence_proof'];
  const missing = requiredFiles.filter((name) => !req.files?.[name]?.[0]);
  if (missing.length) {
    cleanupMulterFiles(req.files);
    throw new AppError(`Required documents missing: ${missing.join(', ')}.`, 422, 'REQUIRED_DOCUMENTS_MISSING');
  }

  const role = await Role.findOne({ where: { name: 'CUSTOMER' } });
  if (!role) {
    cleanupMulterFiles(req.files);
    throw new AppError('System roles are not initialized. Run the seed command.', 500);
  }
  const email = req.body.email.toLowerCase().trim();
  const [existingEmail, existingNic] = await Promise.all([
    User.findOne({ where: { email } }),
    CustomerProfile.findOne({ where: { nic: req.body.nic.trim() } }),
  ]);
  if (existingEmail || existingNic) {
    cleanupMulterFiles(req.files);
    throw new AppError('An account already exists with this email or NIC.', 409, 'ACCOUNT_EXISTS');
  }
  const area = await Area.findByPk(req.body.area_id);
  if (!area || !area.is_active) {
    cleanupMulterFiles(req.files);
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
    await CustomerProfile.create({
      user_id: user.id,
      nic: req.body.nic.trim(),
      phone: req.body.phone.trim(),
      address_line1: req.body.address_line1.trim(),
      city: req.body.city.trim(),
      area_id: Number(req.body.area_id),
      occupation: req.body.occupation?.trim() || null,
      monthly_income: req.body.monthly_income ? Number(req.body.monthly_income) : null,
    }, { transaction });

    const files = [
      ['NIC_FRONT', req.files.nic_front[0], 'National ID card - front'],
      ['NIC_BACK', req.files.nic_back[0], 'National ID card - back'],
      ['RESIDENCE_PROOF', req.files.residence_proof[0], 'Residence confirmation'],
    ];
    if (req.files.income_proof?.[0]) files.push(['INCOME_PROOF', req.files.income_proof[0], 'Income proof']);
    const records = await Promise.all(files.map(([type, file, title]) => fileRecord(user.id, type, file, title)));
    await CustomerDocument.bulkCreate(records, { transaction });
    await transaction.commit();
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    cleanupMulterFiles(req.files);
    throw error;
  }

  await audit(req, 'CUSTOMER_REGISTERED', 'User', user.id, { email: user.email, documents: Object.keys(req.files || {}) });
  res.status(201).json({
    success: true,
    message: 'Registration successful. You can now sign in.',
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
  const user = await User.findOne({ where: { email: req.body.email.toLowerCase().trim() } });
  let devResetUrl;
  let warning;
  if (user && user.is_active) {
    const token = await issueEmailToken(user, 'RESET_PASSWORD', Number(process.env.TOKEN_EXPIRY_MINUTES || 30) / 60);
    const frontend = String(process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0];
    devResetUrl = `${frontend}/reset-password?token=${token}`;
    try {
      const result = await sendMail({ to: user.email, ...resetTemplate(user.full_name, devResetUrl) });
      if (result?.skipped) warning = 'SMTP is not configured.';
    } catch (error) {
      warning = error.message;
    }
  }
  res.json({
    success: true,
    message: 'If an active account exists, a reset request was created.',
    warning,
    dev_reset_url: process.env.NODE_ENV === 'development' ? devResetUrl : undefined,
  });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const hash = hashOpaqueToken(req.body.token);
  const token = await EmailToken.findOne({ where: { token_hash: hash, type: 'RESET_PASSWORD', used_at: null, expires_at: { [Op.gt]: new Date() } } });
  if (!token) throw new AppError('The reset link is invalid or has expired.', 400, 'INVALID_RESET_TOKEN');
  const user = await User.findByPk(token.user_id);
  await user.update({ password_hash: await bcrypt.hash(req.body.password, 12) });
  await token.update({ used_at: new Date() });
  await EmailToken.update({ used_at: new Date() }, { where: { user_id: user.id, type: 'RESET_PASSWORD', used_at: null } });
  res.json({ success: true, message: 'Password changed successfully. Please sign in.' });
});

exports.smtpStatus = asyncHandler(async (_req, res) => {
  const status = await verifySmtp();
  res.status(status.ok ? 200 : 503).json({ success: status.ok, data: status });
});
