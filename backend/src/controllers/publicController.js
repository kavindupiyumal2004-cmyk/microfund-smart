const { Area, LoanType } = require('../models');
const asyncHandler = require('../utils/asyncHandler');

exports.areas = asyncHandler(async (_req, res) => res.json({ success: true, data: await Area.findAll({ where: { is_active: true }, order: [['district', 'ASC'], ['name', 'ASC']] }) }));
exports.loanTypes = asyncHandler(async (_req, res) => res.json({ success: true, data: await LoanType.findAll({ where: { is_active: true }, order: [['name', 'ASC']] }) }));
exports.company = (_req, res) => res.json({ success: true, data: {
  name: 'MicroFund Finance',
  tagline: 'Responsible finance, verified in the field.',
  description: 'MicroFund brings loan applications, field verification, approvals and repayment tracking together in one platform.',
  contact: { phone: '+94 11 555 0101', email: 'info@microfund.local', address: 'Colombo, Sri Lanka' },
} });
