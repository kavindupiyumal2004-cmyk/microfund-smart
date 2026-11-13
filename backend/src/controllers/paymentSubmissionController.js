const dayjs = require('dayjs');
const { Op } = require('sequelize');
const {
  sequelize, OnlinePaymentSubmission, PaymentSubmissionHistory, PaymentSubmissionMessage,
  Loan, RepaymentSchedule, Payment, User, CustomerProfile, Role, CashierProfile,
} = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');
const { sha256File, safeUnlink } = require('../utils/files');
const { chooseCashier } = require('../services/cashierAssignmentService');
const { allocatePayment } = require('../services/paymentAllocationService');
const { refreshOverdueCases } = require('../services/collectionService');
const { notifyUser, notifyRole } = require('../services/notificationService');
const { audit } = require('../services/auditService');

function submissionNo() {
  return `PS-${dayjs().format('YYYYMMDD')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

const includeSubmission = [
  { model: User, as: 'Customer', attributes: ['id', 'full_name', 'email'], include: [{ model: CustomerProfile, as: 'CustomerProfile' }] },
  { model: User, as: 'AssignedCashier', attributes: ['id', 'full_name', 'email'] },
  { model: Loan, include: [{ model: RepaymentSchedule, as: 'Schedules' }] },
  { model: RepaymentSchedule, as: 'Installment' },
  { model: Payment, as: 'Payment' },
  { model: PaymentSubmissionHistory, as: 'History', include: [{ model: User, as: 'Actor', attributes: ['id', 'full_name'] }] },
  { model: PaymentSubmissionMessage, as: 'Messages', include: [{ model: User, as: 'Sender', attributes: ['id', 'full_name'] }] },
];

function publicSubmission(row) {
  const json = row.toJSON ? row.toJSON() : row;
  delete json.slip_path;
  json.slip_url = `/files/payment-slip/${json.id}`;
  return json;
}

async function addHistory(submission, actorId, fromStatus, toStatus, note, transaction, metadata) {
  await PaymentSubmissionHistory.create({ submission_id: submission.id, actor_id: actorId || null, from_status: fromStatus || null, to_status: toStatus, note: note || null, metadata: metadata || null }, { transaction });
}

exports.create = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Payment slip is required.', 422, 'PAYMENT_SLIP_REQUIRED');
  const loan = await Loan.findOne({ where: { id: req.body.loan_id, customer_id: req.user.id, status: 'ACTIVE' } });
  if (!loan) {
    safeUnlink(req.file.path);
    throw new AppError('Active customer loan not found.', 404);
  }
  const amount = Number(req.body.amount);
  if (!(amount > 0) || amount > Number(loan.remaining_balance)) {
    safeUnlink(req.file.path);
    throw new AppError('Invalid payment amount.', 422);
  }
  let installment = null;
  if (req.body.installment_id) {
    installment = await RepaymentSchedule.findOne({ where: { id: req.body.installment_id, loan_id: loan.id } });
    if (!installment) {
      safeUnlink(req.file.path);
      throw new AppError('Selected installment does not belong to this loan.', 422);
    }
  }
  const hash = await sha256File(req.file.path);
  const duplicate = await OnlinePaymentSubmission.findOne({
    where: {
      customer_id: req.user.id,
      [Op.or]: [
        { reference_no: req.body.reference_no.trim() },
        { file_hash: hash },
        { amount, payment_date: req.body.payment_date, status: { [Op.notIn]: ['REJECTED'] } },
      ],
    },
  });
  const transaction = await sequelize.transaction();
  try {
    const cashier = await chooseCashier(transaction);
    const status = cashier ? 'ASSIGNED' : 'SUBMITTED';
    const row = await OnlinePaymentSubmission.create({
      submission_no: submissionNo(), customer_id: req.user.id, loan_id: loan.id,
      installment_id: installment?.id || null, amount, payment_date: req.body.payment_date,
      bank_name: req.body.bank_name.trim(), reference_no: req.body.reference_no.trim(),
      slip_path: req.file.path, original_name: req.file.originalname, mime_type: req.file.mimetype,
      size_bytes: req.file.size, file_hash: hash, customer_note: req.body.customer_note?.trim() || null,
      status, assigned_cashier_id: cashier?.id || null, duplicate_warning: Boolean(duplicate),
      submitted_at: new Date(), review_deadline_at: cashier ? dayjs().add(24, 'hour').toDate() : null,
    }, { transaction });
    await addHistory(row, req.user.id, null, status, 'Payment slip submitted.', transaction, duplicate ? { duplicate_submission_id: duplicate.id } : null);
    await notifyUser(req.user.id, {
      title: 'Payment slip submitted', message: `${row.submission_no} is ${cashier ? `assigned to ${cashier.full_name}` : 'waiting for cashier assignment'}.`, type: 'PAYMENT', link: '/dashboard/payment-slips',
      email: { kind: 'PAYMENT_SLIP_SUBMITTED', data: { submission_no: row.submission_no, loan_no: loan.loan_no, amount, reference_no: row.reference_no, submitted_at: row.submitted_at } },
    }, transaction);
    if (cashier) await notifyUser(cashier.id, { title: 'New payment slip assigned', message: `${row.submission_no} requires review${duplicate ? ' and has a duplicate warning' : ''}.`, type: 'PAYMENT', link: '/dashboard/payment-reviews' }, transaction);
    else await notifyRole('MANAGER', { title: 'Unassigned payment slip', message: `${row.submission_no} could not be assigned because no cashier is available.`, type: 'WARNING', link: '/dashboard/payment-reviews' }, transaction);
    await transaction.commit();
    await audit(req, 'PAYMENT_SLIP_SUBMITTED', 'OnlinePaymentSubmission', row.id, { loan_id: loan.id, amount, assigned_cashier_id: cashier?.id, duplicate: Boolean(duplicate) });
    res.status(201).json({ success: true, data: publicSubmission(row) });
  } catch (error) {
    await transaction.rollback();
    safeUnlink(req.file.path);
    throw error;
  }
});

exports.mine = asyncHandler(async (req, res) => {
  const rows = await OnlinePaymentSubmission.findAll({ where: { customer_id: req.user.id }, include: includeSubmission, order: [['submitted_at', 'DESC']] });
  res.json({ success: true, data: rows.map(publicSubmission) });
});

exports.list = asyncHandler(async (req, res) => {
  const where = {};
  if (req.user.Role.name === 'CASHIER') where.assigned_cashier_id = req.user.id;
  if (req.query.status) where.status = req.query.status;
  if (req.query.search) {
    const search = req.query.search.trim();
    where[Op.or] = [
      { submission_no: { [Op.like]: `%${search}%` } },
      { reference_no: { [Op.like]: `%${search}%` } },
      { '$Customer.full_name$': { [Op.like]: `%${search}%` } },
      { '$Loan.loan_no$': { [Op.like]: `%${search}%` } },
    ];
  }
  const rows = await OnlinePaymentSubmission.findAll({ where, include: includeSubmission, order: [['submitted_at', 'DESC']], subQuery: false });
  res.json({ success: true, data: rows.map(publicSubmission) });
});

exports.getOne = asyncHandler(async (req, res) => {
  const row = await OnlinePaymentSubmission.findByPk(req.params.id, { include: includeSubmission });
  if (!row) throw new AppError('Payment submission not found.', 404);
  const role = req.user.Role.name;
  const allowed = ['OWNER', 'MANAGER'].includes(role) || (role === 'CUSTOMER' && row.customer_id === req.user.id) || (role === 'CASHIER' && row.assigned_cashier_id === req.user.id);
  if (!allowed) throw new AppError('Access denied.', 403);
  res.json({ success: true, data: publicSubmission(row) });
});

exports.startReview = asyncHandler(async (req, res) => {
  const row = await OnlinePaymentSubmission.findByPk(req.params.id);
  if (!row || (req.user.Role.name === 'CASHIER' && row.assigned_cashier_id !== req.user.id)) throw new AppError('Assigned payment submission not found.', 404);
  if (!['ASSIGNED', 'NEEDS_CLARIFICATION'].includes(row.status)) throw new AppError('This submission cannot be moved to review.', 409);
  const from = row.status;
  await row.update({ status: 'UNDER_REVIEW' });
  await addHistory(row, req.user.id, from, 'UNDER_REVIEW', req.body.note || 'Review started.');
  await notifyUser(row.customer_id, { title: 'Payment slip under review', message: `${row.submission_no} is being reviewed.`, type: 'PAYMENT', link: '/dashboard/payment-slips' });
  res.json({ success: true, data: publicSubmission(row) });
});

exports.decision = asyncHandler(async (req, res) => {
  const row = await OnlinePaymentSubmission.findByPk(req.params.id);
  if (!row || (req.user.Role.name === 'CASHIER' && row.assigned_cashier_id !== req.user.id)) throw new AppError('Assigned payment submission not found.', 404);
  if (['ACCEPTED', 'REJECTED'].includes(row.status)) throw new AppError('A final decision already exists.', 409);
  const decision = req.body.decision;
  const note = req.body.note?.trim() || null;
  if (['REJECT', 'CLARIFY'].includes(decision) && !note) throw new AppError('A note is required.', 422, 'NOTE_REQUIRED');

  if (decision === 'ACCEPT') {
    const transaction = await sequelize.transaction();
    try {
      const result = await allocatePayment({
        loanId: row.loan_id, amount: row.amount, recordedBy: req.user.id, method: 'BANK_TRANSFER',
        paidAt: dayjs(row.payment_date).toDate(), notes: `Accepted online slip ${row.submission_no}. ${note || ''}`.trim(),
        sourceSubmissionId: row.id, transaction,
      });
      const from = row.status;
      await row.update({ status: 'ACCEPTED', cashier_note: note, reviewed_at: new Date() }, { transaction });
      await addHistory(row, req.user.id, from, 'ACCEPTED', note || 'Payment verified and accepted.', transaction, { receipt_no: result.payment.receipt_no, allocations: result.allocations });
      await notifyUser(row.customer_id, {
        title: result.newBalance <= 0 ? 'Payment accepted - loan completed' : 'Payment accepted',
        message: `${row.submission_no} was accepted. Receipt: ${result.payment.receipt_no}.`, type: 'SUCCESS', link: '/dashboard/payment-slips',
        email: { kind: 'PAYMENT_SLIP_ACCEPTED', data: { receipt_no: result.payment.receipt_no, submission_no: row.submission_no, loan_no: result.loan.loan_no, amount: result.payment.amount, remaining_balance: result.newBalance, paid_at: result.payment.paid_at, loan_completed: result.newBalance <= 0 } },
      }, transaction);
      await notifyRole('MANAGER', { title: 'Online payment accepted', message: `${result.payment.receipt_no} was created from ${row.submission_no}.`, type: 'PAYMENT', link: '/dashboard/reports' }, transaction);
      await transaction.commit();
      await refreshOverdueCases();
      await audit(req, 'PAYMENT_SLIP_ACCEPTED', 'OnlinePaymentSubmission', row.id, { receipt_no: result.payment.receipt_no, amount: Number(row.amount) });
      return res.json({ success: true, data: publicSubmission(row), payment: result.payment, allocations: result.allocations });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  const nextStatus = decision === 'REJECT' ? 'REJECTED' : 'NEEDS_CLARIFICATION';
  const from = row.status;
  await row.update({ status: nextStatus, cashier_note: note, reviewed_at: decision === 'REJECT' ? new Date() : null });
  await addHistory(row, req.user.id, from, nextStatus, note);
  const submissionLoan = await Loan.findByPk(row.loan_id, { attributes: ['id', 'loan_no'] });
  await notifyUser(row.customer_id, {
    title: decision === 'REJECT' ? 'Payment slip rejected' : 'Payment clarification required',
    message: `${row.submission_no}: ${note}`,
    type: decision === 'REJECT' ? 'ERROR' : 'WARNING',
    link: '/dashboard/payment-slips',
    email: {
      kind: decision === 'REJECT' ? 'PAYMENT_SLIP_REJECTED' : 'PAYMENT_CLARIFICATION_REQUIRED',
      data: { submission_no: row.submission_no, loan_no: submissionLoan?.loan_no || '', amount: row.amount, note },
    },
  });
  await audit(req, decision === 'REJECT' ? 'PAYMENT_SLIP_REJECTED' : 'PAYMENT_CLARIFICATION_REQUESTED', 'OnlinePaymentSubmission', row.id, { note });
  res.json({ success: true, data: publicSubmission(row) });
});

exports.addMessage = asyncHandler(async (req, res) => {
  const row = await OnlinePaymentSubmission.findByPk(req.params.id);
  if (!row) throw new AppError('Payment submission not found.', 404);
  const role = req.user.Role.name;
  const allowed = role === 'MANAGER' || (role === 'CUSTOMER' && row.customer_id === req.user.id) || (role === 'CASHIER' && row.assigned_cashier_id === req.user.id);
  if (!allowed) throw new AppError('Access denied.', 403);
  const message = await PaymentSubmissionMessage.create({ submission_id: row.id, sender_id: req.user.id, message: req.body.message.trim() });
  if (role === 'CUSTOMER' && row.assigned_cashier_id) await notifyUser(row.assigned_cashier_id, { title: 'Customer replied to payment review', message: `${row.submission_no}: ${req.body.message.trim()}`, type: 'PAYMENT', link: '/dashboard/payment-reviews' });
  if (role !== 'CUSTOMER') await notifyUser(row.customer_id, { title: 'New payment review message', message: `${row.submission_no}: ${req.body.message.trim()}`, type: 'PAYMENT', link: '/dashboard/payment-slips' });
  res.status(201).json({ success: true, data: message });
});

exports.reassign = asyncHandler(async (req, res) => {
  const row = await OnlinePaymentSubmission.findByPk(req.params.id);
  if (!row) throw new AppError('Payment submission not found.', 404);
  if (['ACCEPTED', 'REJECTED'].includes(row.status)) {
    throw new AppError('A completed payment review cannot be reassigned.', 409);
  }

  let cashier;
  if (req.body.cashier_id) {
    cashier = await User.findOne({
      where: { id: req.body.cashier_id, is_active: true },
      include: [
        { model: Role, where: { name: 'CASHIER' }, attributes: ['id', 'name'] },
        { model: CashierProfile, as: 'CashierProfile', required: false },
      ],
    });
    if (!cashier || (cashier.CashierProfile && !cashier.CashierProfile.is_available)) {
      throw new AppError('The selected cashier is not active or available.', 422);
    }
  } else {
    cashier = await chooseCashier();
  }
  if (!cashier) throw new AppError('No active cashier is available.', 422);

  const previous = row.assigned_cashier_id;
  const from = row.status;
  await row.update({
    assigned_cashier_id: cashier.id,
    status: 'ASSIGNED',
    reviewed_at: null,
    review_deadline_at: dayjs().add(24, 'hour').toDate(),
  });
  await addHistory(row, req.user.id, from, 'ASSIGNED', req.body.note || 'Submission reassigned.', null, {
    previous_cashier_id: previous,
    new_cashier_id: cashier.id,
  });
  await notifyUser(cashier.id, {
    title: 'Payment slip assigned',
    message: `${row.submission_no} was assigned to you.`,
    type: 'PAYMENT',
    link: '/dashboard/payment-reviews',
  });
  if (previous && previous !== cashier.id) {
    await notifyUser(previous, {
      title: 'Payment slip reassigned',
      message: `${row.submission_no} is no longer assigned to you.`,
      type: 'INFO',
      link: '/dashboard/payment-reviews',
    });
  }
  await audit(req, 'PAYMENT_SLIP_REASSIGNED', 'OnlinePaymentSubmission', row.id, {
    previous_cashier_id: previous,
    new_cashier_id: cashier.id,
  });
  res.json({ success: true, data: publicSubmission(row) });
});
