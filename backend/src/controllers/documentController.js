const { Op } = require('sequelize');
const {
  CustomerDocument, FieldOfficerDocument, DocumentReview, User, LoanApplication,
  FieldVisit, VerificationReport,
} = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');
const { sha256File, safeUnlink } = require('../utils/files');
const { storeDocument } = require('../services/documentStorage');
const { notifyUser, notifyRole } = require('../services/notificationService');
const { audit } = require('../services/auditService');

const customerRequiredTypes = ['NIC_FRONT', 'NIC_BACK', 'RESIDENCE_PROOF'];

function publicDocument(document) {
  const json = document.toJSON();
  delete json.file_path;
  json.file_url = `/files/customer-document/${document.id}`;
  return json;
}

function publicFieldDocument(document) {
  const json = document.toJSON();
  delete json.file_path;
  json.file_url = `/files/field-document/${document.id}`;
  return json;
}

exports.myCustomerDocuments = asyncHandler(async (req, res) => {
  const rows = await CustomerDocument.findAll({
    where: { user_id: req.user.id, is_current: true },
    include: [{ model: User, as: 'ReviewedBy', attributes: ['id', 'full_name'] }],
    order: [['document_type', 'ASC']],
  });
  res.json({ success: true, data: rows.map(publicDocument), required_types: customerRequiredTypes });
});

exports.reuploadCustomerDocument = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Please select a document to upload.', 422, 'FILE_REQUIRED');
  const type = String(req.params.type || '').toUpperCase();
  if (!['NIC_FRONT', 'NIC_BACK', 'RESIDENCE_PROOF', 'INCOME_PROOF', 'OTHER'].includes(type)) {
    safeUnlink(req.file.path);
    throw new AppError('Invalid document type.', 422, 'INVALID_DOCUMENT_TYPE');
  }
  const previous = await CustomerDocument.findOne({ where: { user_id: req.user.id, document_type: type, is_current: true } });
  const hash = await sha256File(req.file.path);
  const row = await storeDocument(req.file, async (filePath, transaction) => {
    if (previous) await previous.update({ is_current: false }, { transaction });
    return CustomerDocument.create({
      user_id: req.user.id,
      document_type: type,
      title: req.body.title?.trim() || type.replaceAll('_', ' '),
      file_path: filePath,
      original_name: req.file.originalname,
      mime_type: req.file.mimetype,
      size_bytes: req.file.size,
      file_hash: hash,
      status: 'PENDING',
      version: previous ? previous.version + 1 : 1,
      is_current: true,
    }, { transaction });
  });
  await notifyRole('MANAGER', { title: 'Customer document uploaded', message: `${req.user.full_name} uploaded ${row.title}.`, type: 'DOCUMENT', link: '/dashboard/applications' });
  await audit(req, 'CUSTOMER_DOCUMENT_UPLOADED', 'CustomerDocument', row.id, { type, version: row.version });
  res.status(201).json({ success: true, data: publicDocument(row) });
});

exports.applicationDocuments = asyncHandler(async (req, res) => {
  const application = await LoanApplication.findByPk(req.params.applicationId, {
    include: [{ model: FieldVisit, as: 'Visits', include: [{ model: VerificationReport, as: 'VerificationReport' }] }],
  });
  if (!application) throw new AppError('Application not found.', 404);
  const role = req.user.Role.name;
  if (role === 'CUSTOMER' && application.customer_id !== req.user.id) throw new AppError('Access denied.', 403);
  if (role === 'AGENT' && application.assigned_agent_id !== req.user.id) throw new AppError('Access denied.', 403);

  const customerDocs = await CustomerDocument.findAll({
    where: { user_id: application.customer_id, is_current: true },
    include: [{ model: User, as: 'ReviewedBy', attributes: ['id', 'full_name'] }],
    order: [['document_type', 'ASC']],
  });
  const visitIds = application.Visits.map((visit) => visit.id);
  const fieldDocs = visitIds.length ? await FieldOfficerDocument.findAll({
    where: { visit_id: { [Op.in]: visitIds } },
    include: [
      { model: User, as: 'Agent', attributes: ['id', 'full_name'] },
      { model: User, as: 'ReviewedBy', attributes: ['id', 'full_name'] },
    ],
    order: [['created_at', 'DESC']],
  }) : [];

  const summary = {
    customer_total: customerDocs.length,
    customer_accepted: customerDocs.filter((row) => row.status === 'ACCEPTED').length,
    required_customer_accepted: customerRequiredTypes.every((type) => customerDocs.some((row) => row.document_type === type && row.status === 'ACCEPTED')),
    field_total: fieldDocs.length,
    field_accepted: fieldDocs.filter((row) => row.status === 'ACCEPTED').length,
    field_ready: fieldDocs.some((row) => ['RESIDENCE_PHOTO', 'VISIT_REPORT', 'SIGNED_FORM'].includes(row.document_type) && row.status === 'ACCEPTED'),
  };
  res.json({
    success: true,
    data: {
      customer_documents: customerDocs.map(publicDocument),
      field_documents: fieldDocs.map(publicFieldDocument),
      visits: application.Visits,
      summary,
    },
  });
});

async function reviewDocument({ req, source, Model, fileUrlBuilder }) {
  const document = await Model.findByPk(req.params.id);
  if (!document) throw new AppError('Document not found.', 404);
  const decision = req.body.decision;
  const note = req.body.note?.trim() || null;
  if (['REJECTED', 'REUPLOAD_REQUIRED'].includes(decision) && !note) {
    throw new AppError('A review note is required for rejection or re-upload requests.', 422, 'REVIEW_NOTE_REQUIRED');
  }
  await document.update({ status: decision, review_note: note, reviewed_by: req.user.id, reviewed_at: new Date() });
  await DocumentReview.create({ document_source: source, document_id: document.id, reviewer_id: req.user.id, decision, note });
  if (source === 'CUSTOMER') {
    await LoanApplication.update(
      { status: 'DOCUMENT_REVIEW' },
      { where: { customer_id: document.user_id, status: 'VERIFICATION_COMPLETED' } },
    );
    await notifyUser(document.user_id, {
      title: `Document ${decision.replaceAll('_', ' ').toLowerCase()}`,
      message: `${document.title}: ${note || 'Review completed.'}`,
      type: 'DOCUMENT',
      link: '/dashboard/documents',
      email: { kind: 'DOCUMENT_REVIEWED', data: { document_title: document.title, decision, note, reviewed_at: new Date() } },
    });
  } else {
    const visit = await FieldVisit.findByPk(document.visit_id);
    if (visit) {
      await LoanApplication.update(
        { status: 'DOCUMENT_REVIEW' },
        { where: { id: visit.application_id, status: 'VERIFICATION_COMPLETED' } },
      );
    }
    await notifyUser(document.agent_id, {
      title: `Field evidence ${decision.replaceAll('_', ' ').toLowerCase()}`,
      message: `${document.title}: ${note || 'Review completed.'}`,
      type: 'DOCUMENT',
      link: '/dashboard/visits',
    });
  }
  await audit(req, 'DOCUMENT_REVIEWED', source === 'CUSTOMER' ? 'CustomerDocument' : 'FieldOfficerDocument', document.id, { decision, note });
  const json = document.toJSON();
  delete json.file_path;
  json.file_url = fileUrlBuilder(document.id);
  return json;
}

exports.reviewCustomerDocument = asyncHandler(async (req, res) => {
  const data = await reviewDocument({ req, source: 'CUSTOMER', Model: CustomerDocument, fileUrlBuilder: (id) => `/files/customer-document/${id}` });
  res.json({ success: true, data });
});

exports.reviewFieldDocument = asyncHandler(async (req, res) => {
  const data = await reviewDocument({ req, source: 'FIELD', Model: FieldOfficerDocument, fileUrlBuilder: (id) => `/files/field-document/${id}` });
  res.json({ success: true, data });
});

exports.uploadFieldDocument = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Please select a document.', 422, 'FILE_REQUIRED');
  const visit = await FieldVisit.findByPk(req.params.visitId, { include: [LoanApplication] });
  if (!visit || visit.agent_id !== req.user.id) {
    safeUnlink(req.file.path);
    throw new AppError('Assigned field visit not found.', 404);
  }
  const type = String(req.body.document_type || '').toUpperCase();
  if (!['RESIDENCE_PHOTO', 'BUSINESS_PHOTO', 'INCOME_EVIDENCE', 'SIGNED_FORM', 'VISIT_REPORT', 'OTHER'].includes(type)) {
    safeUnlink(req.file.path);
    throw new AppError('Invalid field document type.', 422, 'INVALID_DOCUMENT_TYPE');
  }
  const hash = await sha256File(req.file.path);
  const row = await storeDocument(req.file, (filePath, transaction) => FieldOfficerDocument.create({
    visit_id: visit.id,
    agent_id: req.user.id,
    document_type: type,
    title: req.body.title?.trim() || type.replaceAll('_', ' '),
    file_path: filePath,
    original_name: req.file.originalname,
    mime_type: req.file.mimetype,
    size_bytes: req.file.size,
    file_hash: hash,
  }, { transaction }));
  await notifyRole('MANAGER', { title: 'New field verification evidence', message: `${req.user.full_name} uploaded ${row.title}.`, type: 'DOCUMENT', link: '/dashboard/applications' });
  await audit(req, 'FIELD_DOCUMENT_UPLOADED', 'FieldOfficerDocument', row.id, { visit_id: visit.id, type });
  res.status(201).json({ success: true, data: publicFieldDocument(row) });
});

exports.visitFieldDocuments = asyncHandler(async (req, res) => {
  const visit = await FieldVisit.findByPk(req.params.visitId, { include: [LoanApplication] });
  if (!visit) throw new AppError('Visit not found.', 404);
  const role = req.user.Role.name;
  if (role === 'AGENT' && visit.agent_id !== req.user.id) throw new AppError('Access denied.', 403);
  if (role === 'CUSTOMER' && visit.LoanApplication.customer_id !== req.user.id) throw new AppError('Access denied.', 403);
  const rows = await FieldOfficerDocument.findAll({ where: { visit_id: visit.id }, order: [['created_at', 'DESC']] });
  res.json({ success: true, data: rows.map(publicFieldDocument) });
});

exports.customerReadiness = asyncHandler(async (req, res) => {
  const rows = await CustomerDocument.findAll({ where: { user_id: req.user.id, is_current: true } });
  const required = customerRequiredTypes.map((type) => {
    const row = rows.find((item) => item.document_type === type);
    return { type, uploaded: Boolean(row), status: row?.status || 'MISSING', note: row?.review_note || null };
  });
  res.json({ success: true, data: { required, ready_for_review: required.every((item) => item.uploaded), all_accepted: required.every((item) => item.status === 'ACCEPTED') } });
});
