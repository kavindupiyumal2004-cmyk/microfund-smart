const fs = require('fs');
const path = require('path');
const {
  CustomerDocument, FieldOfficerDocument, OnlinePaymentSubmission, LoanApplication,
  FieldVisit,
} = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');

function sendPrivate(res, row, fileField, download) {
  const absolute = path.resolve(row[fileField]);
  if (!fs.existsSync(absolute)) throw new AppError('The stored file is missing.', 404, 'FILE_MISSING');
  res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
  const disposition = download === 'true' ? 'attachment' : 'inline';
  res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(row.original_name || path.basename(absolute))}`);
  res.setHeader('Cache-Control', 'private, no-store');
  return res.sendFile(absolute);
}

exports.customerDocument = asyncHandler(async (req, res) => {
  const row = await CustomerDocument.findByPk(req.params.id);
  if (!row) throw new AppError('Document not found.', 404);
  const role = req.user.Role.name;
  let allowed = ['OWNER', 'MANAGER'].includes(role) || (role === 'CUSTOMER' && row.user_id === req.user.id);
  if (role === 'AGENT') {
    allowed = Boolean(await LoanApplication.findOne({ where: { customer_id: row.user_id, assigned_agent_id: req.user.id } }));
  }
  if (!allowed) throw new AppError('Access denied.', 403);
  return sendPrivate(res, row, 'file_path', req.query.download);
});

exports.fieldDocument = asyncHandler(async (req, res) => {
  const row = await FieldOfficerDocument.findByPk(req.params.id, { include: [{ model: FieldVisit, include: [LoanApplication] }] });
  if (!row) throw new AppError('Document not found.', 404);
  const role = req.user.Role.name;
  const customerId = row.FieldVisit?.LoanApplication?.customer_id;
  const allowed = ['OWNER', 'MANAGER'].includes(role)
    || (role === 'AGENT' && row.agent_id === req.user.id)
    || (role === 'CUSTOMER' && customerId === req.user.id);
  if (!allowed) throw new AppError('Access denied.', 403);
  return sendPrivate(res, row, 'file_path', req.query.download);
});

exports.paymentSlip = asyncHandler(async (req, res) => {
  const row = await OnlinePaymentSubmission.findByPk(req.params.id);
  if (!row) throw new AppError('Payment submission not found.', 404);
  const role = req.user.Role.name;
  const allowed = ['OWNER', 'MANAGER'].includes(role)
    || (role === 'CUSTOMER' && row.customer_id === req.user.id)
    || (role === 'CASHIER' && row.assigned_cashier_id === req.user.id);
  if (!allowed) throw new AppError('Access denied.', 403);
  return sendPrivate(res, row, 'slip_path', req.query.download);
});
