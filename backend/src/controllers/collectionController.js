const dayjs = require('dayjs');
const { Op } = require('sequelize');
const {
  User, Role, Loan, LoanApplication, RepaymentSchedule,
  CollectionCase, CollectionActivity,
} = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');
const { audit } = require('../services/auditService');
const { notifyUser } = require('../services/notificationService');
const { refreshOverdueCases } = require('../services/collectionService');

const include = [
  { model: User, as: 'Customer', attributes: ['id', 'full_name', 'email'] },
  { model: User, as: 'AssignedAgent', attributes: ['id', 'full_name', 'email'] },
  { model: RepaymentSchedule, as: 'Installment' },
  { model: Loan, include: [{ model: LoanApplication, include: [{ model: User, as: 'Customer', attributes: ['id', 'full_name'] }] }] },
  { model: CollectionActivity, as: 'Activities', separate: true, include: [{ model: User, as: 'Actor', attributes: ['id', 'full_name'] }], order: [['created_at', 'DESC']] },
];

async function findAccessible(req, id) {
  await refreshOverdueCases();
  const item = await CollectionCase.findByPk(id, { include });
  if (!item) throw new AppError('Collection case not found.', 404);
  if (req.user.Role.name === 'AGENT' && item.assigned_agent_id !== req.user.id) throw new AppError('Access denied.', 403);
  return item;
}

exports.list = asyncHandler(async (req, res) => {
  await refreshOverdueCases();
  const where = {};
  const role = req.user.Role.name;
  if (role === 'AGENT') where.assigned_agent_id = req.user.id;
  if (req.query.status) where.status = req.query.status;
  if (req.query.priority) where.priority = req.query.priority;
  if (req.query.search) {
    const search = req.query.search.trim();
    where[Op.or] = [
      { case_no: { [Op.like]: `%${search}%` } },
      { '$Loan.loan_no$': { [Op.like]: `%${search}%` } },
      { '$Customer.full_name$': { [Op.like]: `%${search}%` } },
    ];
  }
  const rows = await CollectionCase.findAll({ where, include, order: [['priority', 'DESC'], ['days_overdue', 'DESC'], ['created_at', 'DESC']], subQuery: false });
  res.json({ success: true, data: rows });
});

exports.getOne = asyncHandler(async (req, res) => {
  const item = await findAccessible(req, req.params.id);
  res.json({ success: true, data: item });
});

exports.agents = asyncHandler(async (_req, res) => {
  const role = await Role.findOne({ where: { name: 'AGENT' } });
  const agents = await User.findAll({ where: { role_id: role.id, is_active: true }, attributes: ['id', 'full_name', 'email'], order: [['full_name', 'ASC']] });
  res.json({ success: true, data: agents });
});

exports.assign = asyncHandler(async (req, res) => {
  const item = await CollectionCase.findByPk(req.params.id);
  if (!item) throw new AppError('Collection case not found.', 404);
  const agent = await User.findByPk(req.body.agent_id, { include: [Role] });
  if (!agent || agent.Role.name !== 'AGENT' || !agent.is_active) throw new AppError('Select an active agent.', 422);
  await item.update({ assigned_agent_id: agent.id, next_followup_date: req.body.next_followup_date || item.next_followup_date, manager_note: req.body.manager_note ?? item.manager_note });
  await CollectionActivity.create({ case_id: item.id, actor_id: req.user.id, action_type: 'NOTE', note: `Case assigned to ${agent.full_name}.${req.body.manager_note ? ` ${req.body.manager_note}` : ''}` });
  await notifyUser(agent.id, { title: 'Collection follow-up assigned', message: `${item.case_no} has been assigned to you.`, type: 'COLLECTION', link: '/dashboard/collections' });
  await audit(req, 'COLLECTION_CASE_ASSIGNED', 'CollectionCase', item.id, { agent_id: agent.id });
  res.json({ success: true, message: 'Collection case assigned.' });
});

exports.addActivity = asyncHandler(async (req, res) => {
  const item = await findAccessible(req, req.params.id);
  if (item.status === 'RESOLVED') throw new AppError('This collection case is already resolved.', 409);
  const actionType = req.body.action_type;
  const activity = await CollectionActivity.create({
    case_id: item.id,
    actor_id: req.user.id,
    action_type: actionType,
    note: req.body.note.trim(),
    promise_amount: req.body.promise_amount || null,
    promise_date: req.body.promise_date || null,
  });
  const patch = {};
  if (actionType === 'PROMISE') {
    patch.status = 'PROMISE_TO_PAY';
    patch.promise_amount = req.body.promise_amount || null;
    patch.promise_date = req.body.promise_date || null;
    patch.next_followup_date = req.body.promise_date || null;
  } else if (actionType === 'ESCALATION') {
    patch.status = 'ESCALATED';
  } else if (item.status === 'OPEN') {
    patch.status = 'CONTACTED';
  }
  if (req.body.next_followup_date) patch.next_followup_date = req.body.next_followup_date;
  if (Object.keys(patch).length) await item.update(patch);
  await audit(req, 'COLLECTION_ACTIVITY_ADDED', 'CollectionCase', item.id, { action_type: actionType });
  res.status(201).json({ success: true, data: activity });
});

exports.resolve = asyncHandler(async (req, res) => {
  const item = await CollectionCase.findByPk(req.params.id);
  if (!item) throw new AppError('Collection case not found.', 404);
  await item.update({ status: 'RESOLVED', resolved_at: new Date(), manager_note: req.body.note || item.manager_note });
  await CollectionActivity.create({ case_id: item.id, actor_id: req.user.id, action_type: 'RESOLUTION', note: req.body.note || 'Case resolved by manager.' });
  await audit(req, 'COLLECTION_CASE_RESOLVED', 'CollectionCase', item.id, { note: req.body.note || null });
  res.json({ success: true, message: 'Collection case resolved.' });
});

exports.summary = asyncHandler(async (req, res) => {
  await refreshOverdueCases();
  const where = req.user.Role.name === 'AGENT' ? { assigned_agent_id: req.user.id } : {};
  const rows = await CollectionCase.findAll({ where, attributes: ['status', 'priority', 'overdue_amount', 'days_overdue', 'promise_date'] });
  const data = {
    total_cases: rows.length,
    open_cases: rows.filter((x) => x.status !== 'RESOLVED').length,
    promise_to_pay: rows.filter((x) => x.status === 'PROMISE_TO_PAY').length,
    escalated: rows.filter((x) => x.status === 'ESCALATED').length,
    critical: rows.filter((x) => x.priority === 'CRITICAL' && x.status !== 'RESOLVED').length,
    overdue_amount: rows.filter((x) => x.status !== 'RESOLVED').reduce((sum, x) => sum + Number(x.overdue_amount || 0), 0),
    promises_due_today: rows.filter((x) => x.promise_date && dayjs(x.promise_date).isSame(dayjs(), 'day') && x.status !== 'RESOLVED').length,
  };
  res.json({ success: true, data });
});
