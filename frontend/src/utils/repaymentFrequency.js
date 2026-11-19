export function repaymentFrequency(amount, preference) {
  if (Number(amount) <= 50000) return 'WEEKLY';
  // Historical records have no stored choice.
  return preference ?? (Number(amount) > 100000 ? 'MONTHLY' : 'WEEKLY');
}
