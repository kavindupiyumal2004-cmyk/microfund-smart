const dayjs = require('dayjs');
const { Op } = require('sequelize');
const {
  RepaymentSchedule, Loan, LoanApplication, CollectionCase,
} = require('../models');

function caseRef(id) {
  return `COL-${dayjs().format('YYYYMMDD')}-${String(id).padStart(6, '0')}`;
}

function priorityForDays(days) {
  if (days >= 60) return 'CRITICAL';
  if (days >= 30) return 'HIGH';
  return 'NORMAL';
}

async function refreshOverdueCases({ transaction } = {}) {
  const today = dayjs().format('YYYY-MM-DD');

  await RepaymentSchedule.update(
    { status: 'OVERDUE' },
    {
      where: {
        due_date: { [Op.lt]: today },
        status: { [Op.in]: ['PENDING', 'PARTIAL'] },
      },
      transaction,
    },
  );

  const schedules = await RepaymentSchedule.findAll({
    where: { status: 'OVERDUE' },
    include: [{
      model: Loan,
      required: true,
      include: [{ model: LoanApplication, required: true }],
    }],
    transaction,
  });

  for (const schedule of schedules) {
    const outstanding = Math.max(Number(schedule.amount_due) - Number(schedule.amount_paid), 0);
    const daysOverdue = Math.max(dayjs().startOf('day').diff(dayjs(schedule.due_date).startOf('day'), 'day'), 0);
    const assignedAgent = schedule.Loan?.LoanApplication?.assigned_agent_id || null;

    const [collectionCase, created] = await CollectionCase.findOrCreate({
      where: { installment_id: schedule.id },
      defaults: {
        case_no: `TEMP-${schedule.id}-${Date.now()}`,
        loan_id: schedule.loan_id,
        installment_id: schedule.id,
        customer_id: schedule.Loan.customer_id,
        assigned_agent_id: assignedAgent,
        days_overdue: daysOverdue,
        overdue_amount: outstanding,
        priority: priorityForDays(daysOverdue),
        status: outstanding <= 0 ? 'RESOLVED' : 'OPEN',
        resolved_at: outstanding <= 0 ? new Date() : null,
      },
      transaction,
    });

    if (created) {
      await collectionCase.update({ case_no: caseRef(collectionCase.id) }, { transaction });
    } else {
      const patch = {
        days_overdue: daysOverdue,
        overdue_amount: outstanding,
        priority: priorityForDays(daysOverdue),
      };
      if (!collectionCase.assigned_agent_id && assignedAgent) patch.assigned_agent_id = assignedAgent;
      if (outstanding <= 0 && collectionCase.status !== 'RESOLVED') {
        patch.status = 'RESOLVED';
        patch.resolved_at = new Date();
      }
      await collectionCase.update(patch, { transaction });
    }
  }

  const openCases = await CollectionCase.findAll({
    where: { status: { [Op.ne]: 'RESOLVED' } },
    include: [{ model: RepaymentSchedule, as: 'Installment' }],
    transaction,
  });
  for (const item of openCases) {
    if (!item.Installment) continue;
    const outstanding = Math.max(Number(item.Installment.amount_due) - Number(item.Installment.amount_paid), 0);
    if (item.Installment.status === 'PAID' || outstanding <= 0) {
      await item.update({ status: 'RESOLVED', overdue_amount: 0, resolved_at: new Date() }, { transaction });
    }
  }
}

module.exports = { refreshOverdueCases, priorityForDays };
