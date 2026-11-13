const dayjs = require('dayjs');
const { Op } = require('sequelize');
const {
  User, LoanApplication, FieldVisit, Loan, RepaymentSchedule, Payment,
  Notification, CustomerDocument, OnlinePaymentSubmission, CollectionCase,
} = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { refreshOverdueCases } = require('../services/collectionService');

exports.summary = asyncHandler(async (req, res) => {
  const role = req.user.Role.name;
  const todayStart = dayjs().startOf('day').toDate();
  const todayEnd = dayjs().endOf('day').toDate();
  const monthStart = dayjs().startOf('month').toDate();
  const cards = [];
  let recent = [];

  await refreshOverdueCases();

  if (role === 'OWNER') {
    const totalDisbursed = await Loan.sum('principal') || 0;
    const outstanding = await Loan.sum('remaining_balance', { where: { status: 'ACTIVE' } }) || 0;
    const totalCollected = await Payment.sum('amount') || 0;
    const monthCollected = await Payment.sum('amount', { where: { paid_at: { [Op.between]: [monthStart, todayEnd] } } }) || 0;
    cards.push(
      { label: 'Total customers', value: await User.count({ include: [{ model: require('../models').Role, where: { name: 'CUSTOMER' } }] }), icon: 'users' },
      { label: 'Total disbursed', value: Number(totalDisbursed), money: true, icon: 'wallet' },
      { label: 'Outstanding portfolio', value: Number(outstanding), money: true, icon: 'alert' },
      { label: 'Total collected', value: Number(totalCollected), money: true, icon: 'cash' },
      { label: 'This month collected', value: Number(monthCollected), money: true, icon: 'chart' },
      { label: 'Active loans', value: await Loan.count({ where: { status: 'ACTIVE' } }), icon: 'wallet' },
      { label: 'Overdue installments', value: await RepaymentSchedule.count({ where: { status: 'OVERDUE' } }), icon: 'alert' },
      { label: 'Open collection cases', value: await CollectionCase.count({ where: { status: { [Op.ne]: 'RESOLVED' } } }), icon: 'clock' },
    );
    recent = await Payment.findAll({ include: [{ model: User, as: 'RecordedBy', attributes: ['full_name'] }, { model: Loan, attributes: ['loan_no'] }], order: [['paid_at', 'DESC']], limit: 8 });
  } else if (role === 'MANAGER') {
    const todayTotal = await Payment.sum('amount', { where: { paid_at: { [Op.between]: [todayStart, todayEnd] } } }) || 0;
    cards.push(
      { label: 'Applications awaiting action', value: await LoanApplication.count({ where: { status: { [Op.in]: ['SUBMITTED', 'VERIFICATION_COMPLETED', 'DOCUMENT_REVIEW', 'CREDIT_REVIEW'] } } }), icon: 'file' },
      { label: 'Documents pending review', value: await CustomerDocument.count({ where: { status: 'PENDING', is_current: true } }), icon: 'check' },
      { label: 'Unresolved payment slips', value: await OnlinePaymentSubmission.count({ where: { status: { [Op.in]: ['SUBMITTED', 'ASSIGNED', 'UNDER_REVIEW', 'NEEDS_CLARIFICATION'] } } }), icon: 'cash' },
      { label: 'Overdue installments', value: await RepaymentSchedule.count({ where: { status: 'OVERDUE' } }), icon: 'alert' },
      { label: "Today's collection", value: Number(todayTotal), money: true, icon: 'chart' },
      { label: 'Open collection cases', value: await CollectionCase.count({ where: { status: { [Op.ne]: 'RESOLVED' } } }), icon: 'clock' },
    );
    recent = await LoanApplication.findAll({ include: [{ model: User, as: 'Customer', attributes: ['full_name'] }], order: [['created_at', 'DESC']], limit: 8 });
  } else if (role === 'AGENT') {
    cards.push(
      { label: "Today's visits", value: await FieldVisit.count({ where: { agent_id: req.user.id, scheduled_at: { [Op.between]: [todayStart, todayEnd] } } }), icon: 'map' },
      { label: 'Pending visits', value: await FieldVisit.count({ where: { agent_id: req.user.id, status: { [Op.in]: ['SCHEDULED', 'RESCHEDULED', 'IN_PROGRESS'] } } }), icon: 'clock' },
      { label: 'Completed visits', value: await FieldVisit.count({ where: { agent_id: req.user.id, status: 'COMPLETED' } }), icon: 'check' },
      { label: 'Collection follow-ups', value: await CollectionCase.count({ where: { assigned_agent_id: req.user.id, status: { [Op.ne]: 'RESOLVED' } } }), icon: 'alert' },
      { label: 'Promise-to-pay cases', value: await CollectionCase.count({ where: { assigned_agent_id: req.user.id, status: 'PROMISE_TO_PAY' } }), icon: 'cash' },
    );
    recent = await FieldVisit.findAll({ where: { agent_id: req.user.id }, include: [{ model: LoanApplication, include: [{ model: User, as: 'Customer', attributes: ['full_name'] }] }], order: [['scheduled_at', 'ASC']], limit: 8 });
  } else if (role === 'CASHIER') {
    const todayTotal = await Payment.sum('amount', { where: { recorded_by: req.user.id, paid_at: { [Op.between]: [todayStart, todayEnd] } } }) || 0;
    const monthTotal = await Payment.sum('amount', { where: { recorded_by: req.user.id, paid_at: { [Op.between]: [monthStart, todayEnd] } } }) || 0;
    cards.push(
      { label: "Today's collection", value: Number(todayTotal), money: true, icon: 'cash' },
      { label: 'Monthly collection', value: Number(monthTotal), money: true, icon: 'chart' },
      { label: 'Assigned slip reviews', value: await OnlinePaymentSubmission.count({ where: { assigned_cashier_id: req.user.id, status: { [Op.in]: ['ASSIGNED', 'UNDER_REVIEW', 'NEEDS_CLARIFICATION'] } } }), icon: 'file' },
      { label: 'Overdue installments', value: await RepaymentSchedule.count({ where: { status: 'OVERDUE' } }), icon: 'alert' },
    );
    recent = await OnlinePaymentSubmission.findAll({ where: { assigned_cashier_id: req.user.id }, include: [{ model: User, as: 'Customer', attributes: ['full_name'] }], attributes: { exclude: ['slip_path'] }, order: [['submitted_at', 'DESC']], limit: 8 });
  } else {
    cards.push(
      { label: 'Applications', value: await LoanApplication.count({ where: { customer_id: req.user.id } }), icon: 'file' },
      { label: 'Active loans', value: await Loan.count({ where: { customer_id: req.user.id, status: 'ACTIVE' } }), icon: 'wallet' },
      { label: 'Documents needing action', value: await CustomerDocument.count({ where: { user_id: req.user.id, is_current: true, status: { [Op.in]: ['REJECTED', 'REUPLOAD_REQUIRED'] } } }), icon: 'check' },
      { label: 'Payment slips under review', value: await OnlinePaymentSubmission.count({ where: { customer_id: req.user.id, status: { [Op.in]: ['SUBMITTED', 'ASSIGNED', 'UNDER_REVIEW', 'NEEDS_CLARIFICATION'] } } }), icon: 'cash' },
    );
    recent = await LoanApplication.findAll({ where: { customer_id: req.user.id }, order: [['created_at', 'DESC']], limit: 8 });
  }
  const unread = await Notification.count({ where: { user_id: req.user.id, read_at: null } });
  res.json({ success: true, data: { cards, recent, unread } });
});
