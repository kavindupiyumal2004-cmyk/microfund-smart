const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const {
  Role, User, Area, CustomerProfile, CashierProfile, CustomerDocument, AgentArea,
  LoanType, LoanApplication, Loan, Payment, FieldVisit, AuditLog, OnlinePaymentSubmission,
} = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');
const { notifyUser } = require('../services/notificationService');
const { audit } = require('../services/auditService');

const userInclude = [
  Role,
  { model: CustomerProfile, as: 'CustomerProfile', required: false, include: [Area] },
  { model: CustomerDocument, as: 'CustomerDocuments', required: false, where: { is_current: true }, attributes: { exclude: ['file_path'] }, include: [{ model: User, as: 'ReviewedBy', attributes: ['id', 'full_name'] }] },
  { model: Area, as: 'ServiceAreas', through: { attributes: [] } },
  { model: CashierProfile, as: 'CashierProfile', required: false },
];

exports.userSummary = asyncHandler(async (_req, res) => {
  const roles = await Role.findAll();
  const roleMap = Object.fromEntries(roles.map((role) => [role.name, role.id]));
  const counts = {
    ALL: await User.count(),
    CUSTOMER: await User.count({ where: { role_id: roleMap.CUSTOMER } }),
    AGENT: await User.count({ where: { role_id: roleMap.AGENT } }),
    CASHIER: await User.count({ where: { role_id: roleMap.CASHIER } }),
    OWNER: await User.count({ where: { role_id: roleMap.OWNER } }),
    MANAGER: await User.count({ where: { role_id: roleMap.MANAGER } }),
    INACTIVE: await User.count({ where: { is_active: false } }),
  };
  res.json({ success: true, data: counts });
});

exports.users = asyncHandler(async (req, res) => {
  const where = {};
  const profileWhere = {};
  const category = req.query.category || req.query.role;
  if (category && ['OWNER', 'MANAGER', 'CASHIER', 'AGENT', 'CUSTOMER'].includes(category)) {
    const role = await Role.findOne({ where: { name: category } });
    where.role_id = role.id;
  } else if (category === 'INACTIVE') {
    where.is_active = false;
  }
  if (req.query.status === 'active') where.is_active = true;
  if (req.query.status === 'inactive') where.is_active = false;
  if (req.query.area_id) profileWhere.area_id = Number(req.query.area_id);
  if (req.query.search) {
    const search = req.query.search.trim();
    where[Op.or] = [
      { full_name: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
      { '$CustomerProfile.nic$': { [Op.like]: `%${search}%` } },
      { '$CustomerProfile.phone$': { [Op.like]: `%${search}%` } },
      { '$CustomerProfile.Area.name$': { [Op.like]: `%${search}%` } },
    ];
  }
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 25), 1), 100);
  const include = [
    Role,
    { model: CustomerProfile, as: 'CustomerProfile', required: Boolean(Object.keys(profileWhere).length), where: Object.keys(profileWhere).length ? profileWhere : undefined, include: [Area] },
    { model: CustomerDocument, as: 'CustomerDocuments', required: false, where: { is_current: true }, separate: true, attributes: { exclude: ['file_path'] }, include: [{ model: User, as: 'ReviewedBy', attributes: ['id', 'full_name'] }] },
    { model: Area, as: 'ServiceAreas', through: { attributes: [] } },
    { model: CashierProfile, as: 'CashierProfile', required: false },
  ];
  const { rows, count } = await User.findAndCountAll({
    where,
    include,
    attributes: { exclude: ['password_hash'] },
    order: [['created_at', 'DESC']],
    distinct: true,
    subQuery: false,
    limit,
    offset: (page - 1) * limit,
  });
  res.json({ success: true, data: rows, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
});

exports.userDetails = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id, { include: userInclude, attributes: { exclude: ['password_hash'] } });
  if (!user) throw new AppError('User not found.', 404);
  const role = user.Role.name;
  let activity = {};
  if (role === 'CUSTOMER') {
    activity = {
      applications: await LoanApplication.findAll({ where: { customer_id: user.id }, include: [LoanType, { model: Loan, as: 'Loan' }], order: [['created_at', 'DESC']] }),
      loans: await Loan.findAll({ where: { customer_id: user.id }, order: [['created_at', 'DESC']] }),
      payments: await Payment.findAll({ where: { customer_id: user.id }, order: [['paid_at', 'DESC']], limit: 50 }),
      payment_submissions: await OnlinePaymentSubmission.findAll({ where: { customer_id: user.id }, order: [['submitted_at', 'DESC']], limit: 50, attributes: { exclude: ['slip_path'] } }),
    };
  } else if (role === 'AGENT') {
    activity = {
      pending_visits: await FieldVisit.count({ where: { agent_id: user.id, status: { [Op.in]: ['SCHEDULED', 'IN_PROGRESS', 'RESCHEDULED'] } } }),
      completed_visits: await FieldVisit.count({ where: { agent_id: user.id, status: 'COMPLETED' } }),
      recent_visits: await FieldVisit.findAll({ where: { agent_id: user.id }, include: [{ model: LoanApplication, include: [{ model: User, as: 'Customer', attributes: ['full_name'] }] }], order: [['scheduled_at', 'DESC']], limit: 20 }),
    };
  } else if (role === 'CASHIER') {
    activity = {
      payments_recorded: await Payment.count({ where: { recorded_by: user.id } }),
      pending_slips: await OnlinePaymentSubmission.count({ where: { assigned_cashier_id: user.id, status: { [Op.in]: ['ASSIGNED', 'UNDER_REVIEW', 'NEEDS_CLARIFICATION'] } } }),
      recent_payments: await Payment.findAll({ where: { recorded_by: user.id }, order: [['paid_at', 'DESC']], limit: 20 }),
    };
  }
  res.json({ success: true, data: { user, activity } });
});

exports.createStaff = asyncHandler(async (req, res) => {
  if (!['MANAGER', 'CASHIER', 'AGENT'].includes(req.body.role)) throw new AppError('Invalid staff role.', 422);
  const existing = await User.findOne({ where: { email: req.body.email.toLowerCase().trim() } });
  if (existing) throw new AppError('A user already exists with this email.', 409, 'EMAIL_EXISTS');
  const role = await Role.findOne({ where: { name: req.body.role } });
  const transaction = await User.sequelize.transaction();
  try {
    const user = await User.create({
      full_name: req.body.full_name.trim(), email: req.body.email.toLowerCase().trim(),
      password_hash: await bcrypt.hash(req.body.password, 12), role_id: role.id,
      email_verified_at: new Date(), is_active: true,
    }, { transaction });
    if (req.body.role === 'AGENT' && Array.isArray(req.body.area_ids)) {
      await AgentArea.bulkCreate(req.body.area_ids.map((area_id) => ({ user_id: user.id, area_id })), { ignoreDuplicates: true, transaction });
    }
    if (req.body.role === 'CASHIER') {
      await CashierProfile.create({ user_id: user.id, branch_name: req.body.branch_name || null, is_available: true, max_pending_reviews: req.body.max_pending_reviews || 50 }, { transaction });
    }
    await notifyUser(user.id, { title: 'Staff account created', message: `Your ${req.body.role.replace('_', ' ').toLowerCase()} account is ready.`, type: 'SUCCESS', link: '/dashboard' }, transaction);
    await transaction.commit();
    await audit(req, 'STAFF_USER_CREATED', 'User', user.id, { role: req.body.role });
    res.status(201).json({ success: true, data: { id: user.id, full_name: user.full_name, email: user.email, role: req.body.role } });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

exports.toggleUser = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) throw new AppError('User not found.', 404);
  const targetRole = await Role.findByPk(user.role_id);
  if (targetRole?.name === 'OWNER') throw new AppError('The owner account cannot be disabled by a manager.', 403);
  if (user.id === req.user.id) throw new AppError('You cannot disable your own account.', 409);
  await user.update({ is_active: Boolean(req.body.is_active) });
  await audit(req, 'USER_STATUS_CHANGED', 'User', user.id, { is_active: user.is_active });
  res.json({ success: true, data: { id: user.id, is_active: user.is_active } });
});

exports.setAgentAreas = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id, { include: Role });
  if (!user || user.Role.name !== 'AGENT') throw new AppError('Agent not found.', 404);
  await AgentArea.destroy({ where: { user_id: user.id } });
  await AgentArea.bulkCreate((req.body.area_ids || []).map((area_id) => ({ user_id: user.id, area_id })), { ignoreDuplicates: true });
  await audit(req, 'AGENT_AREAS_UPDATED', 'User', user.id, { area_ids: req.body.area_ids });
  res.json({ success: true, message: 'Service areas updated.' });
});

exports.updateCashierProfile = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id, { include: Role });
  if (!user || user.Role.name !== 'CASHIER') throw new AppError('Cashier not found.', 404);
  const [profile] = await CashierProfile.findOrCreate({ where: { user_id: user.id }, defaults: {} });
  await profile.update({
    branch_name: req.body.branch_name ?? profile.branch_name,
    is_available: req.body.is_available ?? profile.is_available,
    max_pending_reviews: req.body.max_pending_reviews ?? profile.max_pending_reviews,
  });
  await audit(req, 'CASHIER_PROFILE_UPDATED', 'CashierProfile', profile.id, req.body);
  res.json({ success: true, data: profile });
});

exports.cashiers = asyncHandler(async (_req, res) => {
  const role = await Role.findOne({ where: { name: 'CASHIER' } });
  const rows = await User.findAll({ where: { role_id: role.id, is_active: true }, include: [{ model: CashierProfile, as: 'CashierProfile', required: false }], attributes: ['id', 'full_name', 'email'] });
  const data = [];
  for (const user of rows) {
    data.push({
      ...user.toJSON(),
      pending_reviews: await OnlinePaymentSubmission.count({ where: { assigned_cashier_id: user.id, status: { [Op.in]: ['ASSIGNED', 'UNDER_REVIEW', 'NEEDS_CLARIFICATION'] } } }),
    });
  }
  res.json({ success: true, data });
});

exports.areas = asyncHandler(async (_req, res) => res.json({ success: true, data: await Area.findAll({ order: [['district', 'ASC'], ['name', 'ASC']] }) }));
exports.createArea = asyncHandler(async (req, res) => { const data = await Area.create(req.body); await audit(req, 'AREA_CREATED', 'Area', data.id); res.status(201).json({ success: true, data }); });
exports.updateArea = asyncHandler(async (req, res) => { const data = await Area.findByPk(req.params.id); if (!data) throw new AppError('Area not found.', 404); await data.update(req.body); await audit(req, 'AREA_UPDATED', 'Area', data.id); res.json({ success: true, data }); });
exports.deleteArea = asyncHandler(async (req, res) => { const data = await Area.findByPk(req.params.id); if (!data) throw new AppError('Area not found.', 404); await data.update({ is_active: false }); await audit(req, 'AREA_DEACTIVATED', 'Area', data.id); res.json({ success: true, message: 'Area deactivated.' }); });

exports.loanTypes = asyncHandler(async (_req, res) => res.json({ success: true, data: await LoanType.findAll({ order: [['name', 'ASC']] }) }));
exports.createLoanType = asyncHandler(async (req, res) => { const data = await LoanType.create(req.body); await audit(req, 'LOAN_TYPE_CREATED', 'LoanType', data.id); res.status(201).json({ success: true, data }); });
exports.updateLoanType = asyncHandler(async (req, res) => { const data = await LoanType.findByPk(req.params.id); if (!data) throw new AppError('Loan type not found.', 404); await data.update(req.body); await audit(req, 'LOAN_TYPE_UPDATED', 'LoanType', data.id); res.json({ success: true, data }); });
exports.deleteLoanType = asyncHandler(async (req, res) => { const data = await LoanType.findByPk(req.params.id); if (!data) throw new AppError('Loan type not found.', 404); await data.update({ is_active: false }); await audit(req, 'LOAN_TYPE_DEACTIVATED', 'LoanType', data.id); res.json({ success: true, message: 'Loan type deactivated.' }); });

exports.auditLogs = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 100), 500);
  const data = await AuditLog.findAll({ include: [{ model: User, attributes: ['id', 'full_name', 'email'] }], order: [['created_at', 'DESC']], limit });
  res.json({ success: true, data });
});
