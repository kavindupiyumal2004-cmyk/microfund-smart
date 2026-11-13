const dayjs = require('dayjs');
const { Op } = require('sequelize');
const { User, Role, CashierProfile, OnlinePaymentSubmission } = require('../models');

const OPEN_STATUSES = ['ASSIGNED', 'UNDER_REVIEW', 'NEEDS_CLARIFICATION'];

async function chooseCashier(transaction) {
  const cashiers = await User.findAll({
    where: { is_active: true },
    include: [
      { model: Role, where: { name: 'CASHIER' } },
      { model: CashierProfile, as: 'CashierProfile', required: false },
    ],
    transaction,
  });

  const scored = [];
  for (const cashier of cashiers) {
    const profile = cashier.CashierProfile;
    if (profile && !profile.is_available) continue;
    const pending = await OnlinePaymentSubmission.count({
      where: { assigned_cashier_id: cashier.id, status: { [Op.in]: OPEN_STATUSES } },
      transaction,
    });
    const maximum = Number(profile?.max_pending_reviews || 50);
    if (pending >= maximum) continue;
    scored.push({ cashier, pending, last: profile?.last_assigned_at ? new Date(profile.last_assigned_at).getTime() : 0 });
  }

  scored.sort((a, b) => a.pending - b.pending || a.last - b.last || a.cashier.id - b.cashier.id);
  const selected = scored[0]?.cashier || null;
  if (selected) {
    const [profile] = await CashierProfile.findOrCreate({ where: { user_id: selected.id }, defaults: { is_available: true } , transaction });
    await profile.update({ last_assigned_at: dayjs().toDate() }, { transaction });
  }
  return selected;
}

module.exports = { chooseCashier, OPEN_STATUSES };
