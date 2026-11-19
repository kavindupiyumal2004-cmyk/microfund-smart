function parseDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatDateOnly(date) {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

function addMonthsDateOnly(date, offset) {
  const monthIndex = (date.month - 1) + offset;
  const year = date.year + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12 + 1;
  const day = Math.min(date.day, daysInMonth(year, month));
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addDaysDateOnly(date, offset) {
  const js = new Date(Date.UTC(date.year, date.month - 1, date.day));
  js.setUTCDate(js.getUTCDate() + offset);
  return formatDateOnly({ year: js.getUTCFullYear(), month: js.getUTCMonth() + 1, day: js.getUTCDate() });
}

function effectiveFrequency(principal, preference) {
  if (principal <= 50000) return 'WEEKLY';
  return preference ?? (principal > 100000 ? 'MONTHLY' : 'WEEKLY');
}

/**
 * MicroFund repayment policy:
 *   - Up to LKR 50,000 is weekly. Larger loans follow the requested frequency.
 *   - Applications made before frequency selection retain their legacy default.
 *   - Interest is fixed when the loan is approved (flat-rate calculation).
 *   - A late payment NEVER increases amount_due, total_interest or total_payable.
 *     Late installments are only marked OVERDUE by the collection process.
 *
 * durationMonths remains the contractual term. Weekly loans convert that term to
 * approximately 52 weeks per year; monthly loans use one installment per month.
 * startDate is the first installment due date.
 */
function calculateFlatRateLoan({ principal, annualInterestRate, durationMonths, startDate, requestedFrequency }) {
  const p = Number(principal);
  const rate = Number(annualInterestRate);
  const months = Number(durationMonths);
  const firstDueDate = parseDateOnly(startDate);

  if (!(p > 0) || !(rate >= 0) || !Number.isInteger(months) || months <= 0 || !firstDueDate) {
    throw new Error('Invalid loan calculation inputs.');
  }

  const repaymentFrequency = effectiveFrequency(p, requestedFrequency);
  const installmentCount = repaymentFrequency === 'MONTHLY'
    ? months
    : Math.max(1, Math.ceil((months * 52) / 12));

  const years = months / 12;
  const totalInterest = Number((p * (rate / 100) * years).toFixed(2));
  const totalPayable = Number((p + totalInterest).toFixed(2));
  const baseInstallment = Number((totalPayable / installmentCount).toFixed(2));
  const schedule = [];
  let allocated = 0;

  for (let installmentNo = 1; installmentNo <= installmentCount; installmentNo += 1) {
    const amountDue = installmentNo === installmentCount
      ? Number((totalPayable - allocated).toFixed(2))
      : baseInstallment;
    allocated = Number((allocated + amountDue).toFixed(2));

    schedule.push({
      installment_no: installmentNo,
      due_date: repaymentFrequency === 'MONTHLY'
        ? addMonthsDateOnly(firstDueDate, installmentNo - 1)
        : addDaysDateOnly(firstDueDate, (installmentNo - 1) * 7),
      amount_due: amountDue,
      amount_paid: 0,
      status: 'PENDING',
    });
  }

  return {
    totalInterest,
    totalPayable,
    monthlyInstallment: baseInstallment, // kept for DB backward compatibility; this is the installment amount.
    installmentAmount: baseInstallment,
    installmentCount,
    repaymentFrequency,
    startDate: schedule[0].due_date,
    endDate: schedule[schedule.length - 1].due_date,
    schedule,
  };
}

module.exports = { calculateFlatRateLoan, effectiveFrequency };
