const dayjs = require('dayjs');
const { Op } = require('sequelize');
const { FieldVisit, LoanApplication, User, CustomerProfile, Area, VerificationReport, FieldOfficerDocument } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');
const { notifyUser, notifyRole } = require('../services/notificationService');
const { audit } = require('../services/auditService');

exports.myVisits = asyncHandler(async (req, res) => {
  const where = { agent_id: req.user.id };
  if (req.query.status) where.status = req.query.status;
  if (req.query.date) where.scheduled_at = { [Op.between]: [dayjs(req.query.date).startOf('day').toDate(), dayjs(req.query.date).endOf('day').toDate()] };
  const data = await FieldVisit.findAll({
    where,
    include: [{
      model: LoanApplication,
      include: [
        { model: User, as: 'Customer', attributes: ['id', 'full_name', 'email'], include: [{ model: CustomerProfile, as: 'CustomerProfile', include: [Area] }] },
        Area,
      ],
    }, { model: VerificationReport, as: 'VerificationReport' }, { model: FieldOfficerDocument, as: 'FieldDocuments', attributes: { exclude: ['file_path'] } }],
    order: [['scheduled_at', 'ASC']],
  });
  res.json({ success: true, data });
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const visit = await FieldVisit.findOne({ where: { id: req.params.id, agent_id: req.user.id }, include: [LoanApplication] });
  if (!visit) throw new AppError('Assigned visit not found.', 404);
  if (visit.status === 'COMPLETED') throw new AppError('Completed visits cannot be changed.', 409);
  const changes = { status: req.body.status };
  if (req.body.status === 'RESCHEDULED') {
    if (!req.body.scheduled_at) throw new AppError('A new visit date is required.', 422);
    changes.scheduled_at = req.body.scheduled_at;
  }
  await visit.update(changes);
  await notifyUser(visit.LoanApplication.customer_id, {
    title: `Field visit ${req.body.status.replaceAll('_', ' ').toLowerCase()}`,
    message: `${visit.LoanApplication.application_no} visit status was updated by ${req.user.full_name}.`,
    type: 'VISIT', link: '/dashboard/my-applications',
    email: { kind: 'FIELD_VISIT_UPDATED', data: { application_no: visit.LoanApplication.application_no, status: req.body.status, scheduled_at: changes.scheduled_at || visit.scheduled_at, officer_name: req.user.full_name } },
  });
  await audit(req, 'FIELD_VISIT_STATUS_CHANGED', 'FieldVisit', visit.id, changes);
  res.json({ success: true, data: visit });
});

exports.submitReport = asyncHandler(async (req, res) => {
  const visit = await FieldVisit.findOne({ where: { id: req.params.id, agent_id: req.user.id }, include: [LoanApplication] });
  if (!visit) throw new AppError('Assigned visit not found.', 404);
  if (visit.status === 'CANCELLED') throw new AppError('A cancelled visit cannot be completed.', 409);
  const existing = await VerificationReport.findOne({ where: { visit_id: visit.id } });
  if (existing) throw new AppError('A verification report has already been submitted.', 409);
  const report = await VerificationReport.create({
    visit_id: visit.id,
    residence_verified: req.body.residence_verified === true || req.body.residence_verified === 'true',
    income_verified: req.body.income_verified === true || req.body.income_verified === 'true',
    business_verified: req.body.business_verified === true || req.body.business_verified === 'true',
    documents_verified: req.body.documents_verified === true || req.body.documents_verified === 'true',
    guarantor_verified: req.body.guarantor_verified === true || req.body.guarantor_verified === 'true',
    recommendation: req.body.recommendation,
    comments: req.body.comments,
  });
  await visit.update({ status: 'COMPLETED', completed_at: new Date() });
  await visit.LoanApplication.update({ status: 'VERIFICATION_COMPLETED' });
  await notifyRole('MANAGER', { title: 'Field verification completed', message: `${visit.LoanApplication.application_no} is ready for document review.`, type: 'VERIFICATION', link: '/dashboard/applications' });
  await notifyUser(visit.LoanApplication.customer_id, {
    title: 'Verification completed', message: `The field verification for ${visit.LoanApplication.application_no} is complete.`, type: 'VERIFICATION', link: '/dashboard/my-applications',
    email: { kind: 'VERIFICATION_COMPLETED', data: { application_no: visit.LoanApplication.application_no, completed_at: new Date() } },
  });
  await audit(req, 'VERIFICATION_REPORT_SUBMITTED', 'VerificationReport', report.id, { visit_id: visit.id, recommendation: report.recommendation });
  res.status(201).json({ success: true, data: report });
});
