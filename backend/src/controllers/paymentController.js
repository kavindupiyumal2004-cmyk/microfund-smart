const dayjs = require('dayjs');
const { Op } = require('sequelize');
const { sequelize, Loan, LoanApplication, RepaymentSchedule, Payment, User, CustomerProfile } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');
const { notifyUser, notifyRole } = require('../services/notificationService');
const { audit } = require('../services/auditService');
const { allocatePayment } = require('../services/paymentAllocationService');
const { refreshOverdueCases } = require('../services/collectionService');

const includeLoan = [
  { model: User, as: 'Customer', attributes: ['id', 'full_name', 'email'], include: [{ model: CustomerProfile, as: 'CustomerProfile' }] },
  { model: RepaymentSchedule, as: 'Schedules' },
  { model: LoanApplication, attributes: ['id', 'application_no'] },
];

async function refreshOverdue(loanId, transaction) {
  await RepaymentSchedule.update({ status: 'OVERDUE' }, {
    where: { loan_id: loanId, due_date: { [Op.lt]: dayjs().format('YYYY-MM-DD') }, status: { [Op.in]: ['PENDING', 'PARTIAL'] } }, transaction,
  });
}

exports.searchLoans = asyncHandler(async (req, res) => {
  const query = req.query.query?.trim();
  if (!query) throw new AppError('Enter a loan number, customer name, NIC, phone, email or application number.', 422);
  const rows = await Loan.findAll({
    where: {
      [Op.or]: [
        { loan_no: { [Op.like]: `%${query}%` } },
        { '$Customer.full_name$': { [Op.like]: `%${query}%` } },
        { '$Customer.email$': { [Op.like]: `%${query}%` } },
        { '$Customer.CustomerProfile.nic$': { [Op.like]: `%${query}%` } },
        { '$Customer.CustomerProfile.phone$': { [Op.like]: `%${query}%` } },
        { '$LoanApplication.application_no$': { [Op.like]: `%${query}%` } },
      ],
    },
    include: includeLoan,
    order: [['created_at', 'DESC']],
    limit: 30,
    subQuery: false,
  });
  for (const loan of rows) await refreshOverdue(loan.id);
  res.json({ success: true, data: rows });
});

exports.getLoan = asyncHandler(async (req, res) => {
  const loan = await Loan.findByPk(req.params.id, { include: includeLoan });
  if (!loan) throw new AppError('Loan not found.', 404);
  if (req.user.Role.name === 'CUSTOMER' && loan.customer_id !== req.user.id) throw new AppError('Access denied.', 403);
  await refreshOverdue(loan.id);
  await loan.reload({ include: includeLoan });
  res.json({ success: true, data: loan });
});

exports.record = asyncHandler(async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const result = await allocatePayment({
      loanId: req.body.loan_id,
      amount: req.body.amount,
      recordedBy: req.user.id,
      method: req.body.method || 'CASH',
      paidAt: req.body.paid_at || new Date(),
      notes: req.body.notes || null,
      transaction,
    });
    await notifyUser(result.loan.customer_id, {
      title: result.newBalance <= 0 ? 'Loan fully settled' : 'Payment received',
      message: `${result.payment.receipt_no}: LKR ${Number(result.payment.amount).toFixed(2)} was recorded. Remaining balance: LKR ${result.newBalance.toFixed(2)}.`,
      type: 'PAYMENT', link: '/dashboard/my-loans',
      email: { kind: 'PAYMENT_RECEIVED', data: { receipt_no: result.payment.receipt_no, loan_no: result.loan.loan_no, amount: result.payment.amount, method: result.payment.method, remaining_balance: result.newBalance, paid_at: result.payment.paid_at, loan_completed: result.newBalance <= 0 } },
    }, transaction);
    await notifyRole('MANAGER', { title: 'Installment payment recorded', message: `${result.payment.receipt_no} was recorded by ${req.user.full_name}.`, type: 'PAYMENT', link: '/dashboard/reports' }, transaction);
    await transaction.commit();
    await audit(req, 'PAYMENT_RECORDED', 'Payment', result.payment.id, { loan_id: result.loan.id, amount: Number(req.body.amount), receipt_no: result.payment.receipt_no });
    await refreshOverdueCases();
    res.status(201).json({ success: true, data: result.payment, remaining_balance: result.newBalance, allocations: result.allocations });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

exports.history = asyncHandler(async (req, res) => {
  const loan = await Loan.findByPk(req.params.loanId);
  if (!loan) throw new AppError('Loan not found.', 404);
  if (req.user.Role.name === 'CUSTOMER' && loan.customer_id !== req.user.id) throw new AppError('Access denied.', 403);
  const data = await Payment.findAll({ where: { loan_id: loan.id }, include: [{ model: User, as: 'RecordedBy', attributes: ['id', 'full_name'] }], order: [['paid_at', 'DESC']] });
  res.json({ success: true, data });
});
