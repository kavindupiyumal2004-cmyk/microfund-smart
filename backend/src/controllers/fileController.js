const fs = require('fs');
const path = require('path');
const { DocumentFile } = require('../services/documentStorage');
const { privateRoot } = require('../middleware/upload');
const {
  CustomerDocument, FieldOfficerDocument, OnlinePaymentSubmission, LoanApplication,
  FieldVisit,
} = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');

async function sendPrivate(res, row, fileField, download, folder) {
  const stored = row[fileField];
  const name = row.original_name || path.win32.basename(stored);
  let contents;
  let absolute;
  if (stored.startsWith('db:')) {
    const file = await DocumentFile.findByPk(stored.slice(3));
    contents = file?.contents;
  } else {
    absolute = [path.resolve(stored), path.join(privateRoot, folder, path.win32.basename(stored))]
      .find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  }
  if (!contents && !absolute) throw new AppError('The uploaded file is unavailable. Please upload the original file again.', 404, 'FILE_MISSING');
  res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  const disposition = download === 'true' ? 'attachment' : 'inline';
  res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.setHeader('Cache-Control', 'private, no-store');
  return contents ? res.send(contents) : res.sendFile(absolute);
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
  return sendPrivate(res, row, 'file_path', req.query.download, 'customer-documents');
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
  return sendPrivate(res, row, 'file_path', req.query.download, 'field-documents');
});

exports.paymentSlip = asyncHandler(async (req, res) => {
  const row = await OnlinePaymentSubmission.findByPk(req.params.id);
  if (!row) throw new AppError('Payment submission not found.', 404);
  const role = req.user.Role.name;
  const allowed = ['OWNER', 'MANAGER'].includes(role)
    || (role === 'CUSTOMER' && row.customer_id === req.user.id)
    || (role === 'CASHIER' && row.assigned_cashier_id === req.user.id);
  if (!allowed) throw new AppError('Access denied.', 403);
  return sendPrivate(res, row, 'slip_path', req.query.download, 'payment-slips');
});
