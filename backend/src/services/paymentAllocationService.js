const dayjs = require('dayjs');
const { Op } = require('sequelize');
const { Loan, RepaymentSchedule, Payment } = require('../models');
const { AppError } = require('../middleware/errorHandler');

function receiptNo() {
  return `RCPT-${dayjs().format('YYYYMMDD')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

async function allocatePayment({ loanId, amount, recordedBy, method, paidAt, notes, sourceSubmissionId = null, transaction }) {
  const numericAmount = Number(amount);
  const loan = await Loan.findByPk(loanId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!loan || loan.status !== 'ACTIVE') throw new AppError('An active loan is required.', 422, 'ACTIVE_LOAN_REQUIRED');
  if (!(numericAmount > 0) || numericAmount > Number(loan.remaining_balance)) {
    throw new AppError('Payment amount is invalid or exceeds the remaining balance.', 422, 'INVALID_PAYMENT_AMOUNT');
  }

  const schedules = await RepaymentSchedule.findAll({
    where: { loan_id: loan.id, status: { [Op.ne]: 'PAID' } },
    order: [['installment_no', 'ASC']],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  let remaining = numericAmount;
  let firstInstallmentId = null;
  const allocations = [];
  for (const schedule of schedules) {
    if (remaining <= 0) break;
    const outstanding = Number(schedule.amount_due) - Number(schedule.amount_paid);
    if (outstanding <= 0) continue;
    const allocated = Math.min(outstanding, remaining);
    if (!firstInstallmentId) firstInstallmentId = schedule.id;
    const paid = Number((Number(schedule.amount_paid) + allocated).toFixed(2));
    const status = paid >= Number(schedule.amount_due)
      ? 'PAID'
      : (dayjs(schedule.due_date).isBefore(dayjs(), 'day') ? 'OVERDUE' : 'PARTIAL');
    await schedule.update({ amount_paid: paid, status }, { transaction });
    allocations.push({ installment_id: schedule.id, installment_no: schedule.installment_no, amount: allocated });
    remaining = Number((remaining - allocated).toFixed(2));
  }

  if (remaining > 0.009) throw new AppError('Unable to allocate the full payment.', 409, 'PAYMENT_ALLOCATION_FAILED');
  const newBalance = Number((Number(loan.remaining_balance) - numericAmount).toFixed(2));
  await loan.update({ remaining_balance: newBalance, status: newBalance <= 0 ? 'COMPLETED' : 'ACTIVE' }, { transaction });
  const payment = await Payment.create({
    receipt_no: receiptNo(),
    loan_id: loan.id,
    installment_id: firstInstallmentId,
    customer_id: loan.customer_id,
    recorded_by: recordedBy,
    source_submission_id: sourceSubmissionId || null,
    amount: numericAmount,
    method: method || 'CASH',
    paid_at: paidAt || new Date(),
    notes: notes || null,
  }, { transaction });

  return { payment, loan, newBalance, allocations };
}

module.exports = { allocatePayment };
