export function passwordStrength(value = '') {
  const rules = [
    { label: 'At least 8 characters', met: value.length >= 8 },
    { label: 'Uppercase letter (A–Z)', met: /[A-Z]/.test(value) },
    { label: 'Lowercase letter (a–z)', met: /[a-z]/.test(value) },
    { label: 'Number (0–9)', met: /[0-9]/.test(value) },
  ];
  const valid = rules.every((rule) => rule.met);
  const common = /password|qwerty|123456|letmein/i.test(value);
  const level = !value ? 0 : !valid || common ? 1 : value.length < 12 ? 2 : value.length < 16 ? 3 : 4;
  return { rules, valid, level, label: ['Not entered', 'Weak', 'Fair', 'Good', 'Strong'][level] };
}
