const dayjs = require('dayjs');
const { Op, fn, col, literal } = require('sequelize');
const {
  sequelize, User, Role, CustomerProfile, CustomerDocument, Area, AgentArea, LoanType,
  LoanApplication, FieldVisit, VerificationReport, FieldOfficerDocument, CreditAssessment, Loan,
  RepaymentSchedule,
} = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');
const { notifyUser, notifyRole } = require('../services/notificationService');
const { audit } = require('../services/auditService');
const { calculateFlatRateLoan } = require('../utils/loanCalculator');

const customerAttributes = ['id', 'full_name', 'email', 'is_active'];
const applicationInclude = [
  { model: User, as: 'Customer', attributes: customerAttributes, include: [{ model: CustomerProfile, as: 'CustomerProfile', include: [Area] }] },
  { model: User, as: 'AssignedAgent', attributes: ['id', 'full_name', 'email'] },
  LoanType,
  Area,
  { model: Loan, as: 'Loan', required: false },
  { model: CreditAssessment, as: 'CreditAssessment', required: false, include: [{ model: User, as: 'AssessedBy', attributes: ['id', 'full_name'] }] },
  { model: FieldVisit, as: 'Visits', include: [
    { model: User, as: 'Agent', attributes: ['id', 'full_name'] },
    { model: VerificationReport, as: 'VerificationReport' },
    { model: FieldOfficerDocument, as: 'FieldDocuments', attributes: { exclude: ['file_path'] } },
  ] },
];

function ref(prefix) {
  return `${prefix}-${dayjs().format('YYYYMMDD')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

exports.create = asyncHandler(async (req, res) => {
  const requiredDocs = await CustomerDocument.findAll({ where: { user_id: req.user.id, is_current: true, document_type: { [Op.in]: ['NIC_FRONT', 'NIC_BACK', 'RESIDENCE_PROOF'] } } });
  const requiredReady = ['NIC_FRONT', 'NIC_BACK', 'RESIDENCE_PROOF'].every((type) => requiredDocs.some((doc) => doc.document_type === type));
  if (!requiredReady) throw new AppError('Upload the required identity and residence documents before applying.', 422, 'CUSTOMER_DOCUMENTS_REQUIRED');

  const loanType = await LoanType.findByPk(req.body.loan_type_id);
  if (!loanType || !loanType.is_active) throw new AppError('Invalid loan type.', 422, 'INVALID_LOAN_TYPE');
  const amount = Number(req.body.requested_amount);
  if (amount < Number(loanType.min_amount) || amount > Number(loanType.max_amount)) {
    throw new AppError(`Requested amount must be between ${loanType.min_amount} and ${loanType.max_amount}.`, 422, 'AMOUNT_OUT_OF_RANGE');
  }
  const area = await Area.findByPk(req.body.area_id);
  if (!area || !area.is_active) throw new AppError('Invalid service area.', 422, 'INVALID_AREA');
  const application = await LoanApplication.create({
    application_no: ref('APP'),
    customer_id: req.user.id,
    loan_type_id: loanType.id,
    area_id: area.id,
    requested_amount: amount,
    requested_duration_months: req.body.requested_duration_months ?? null,
    purpose: req.body.purpose.trim(),
    monthly_income: Number(req.body.monthly_income),
    status: 'SUBMITTED',
    submitted_at: new Date(),
  });
  await notifyRole('MANAGER', { title: 'New loan application', message: `${req.user.full_name} submitted ${application.application_no}.`, type: 'APPLICATION', link: '/dashboard/applications' });
  await notifyUser(req.user.id, {
    title: 'Application submitted', message: `${application.application_no} was submitted successfully.`, type: 'SUCCESS', link: '/dashboard/my-applications',
    email: { kind: 'APPLICATION_SUBMITTED', data: { application_no: application.application_no, loan_type: loanType.name, amount, submitted_at: application.submitted_at || new Date() } },
  });
  await audit(req, 'LOAN_APPLICATION_SUBMITTED', 'LoanApplication', application.id, { application_no: application.application_no });
  res.status(201).json({ success: true, data: application });
});

exports.mine = asyncHandler(async (req, res) => {
  const data = await LoanApplication.findAll({ where: { customer_id: req.user.id }, include: applicationInclude, order: [['created_at', 'DESC']] });
  res.json({ success: true, data });
});

exports.list = asyncHandler(async (req, res) => {
  const where = {};
  const customerWhere = {};
  const profileWhere = {};
  const areaWhere = {};
  const loanTypeWhere = {};
  const agentWhere = {};
  const loanWhere = {};

  if (req.query.status) where.status = req.query.status;
  if (req.query.area_id) where.area_id = Number(req.query.area_id);
  if (req.query.loan_type_id) where.loan_type_id = Number(req.query.loan_type_id);
  if (req.query.agent_id) where.assigned_agent_id = Number(req.query.agent_id);
  if (req.query.date_from || req.query.date_to) {
    where.created_at = {};
    if (req.query.date_from) where.created_at[Op.gte] = dayjs(req.query.date_from).startOf('day').toDate();
    if (req.query.date_to) where.created_at[Op.lte] = dayjs(req.query.date_to).endOf('day').toDate();
  }

  if (req.query.customer_name) customerWhere.full_name = { [Op.like]: `%${req.query.customer_name}%` };
  if (req.query.nic) profileWhere.nic = { [Op.like]: `%${req.query.nic}%` };
  if (req.query.phone) profileWhere.phone = { [Op.like]: `%${req.query.phone}%` };
  if (req.query.email) customerWhere.email = { [Op.like]: `%${req.query.email}%` };
  if (req.query.loan_no) loanWhere.loan_no = { [Op.like]: `%${req.query.loan_no}%` };

  const search = req.query.search?.trim();
  if (search) {
    where[Op.or] = [
      { application_no: { [Op.like]: `%${search}%` } },
      { '$Customer.full_name$': { [Op.like]: `%${search}%` } },
      { '$Customer.email$': { [Op.like]: `%${search}%` } },
      { '$Customer.CustomerProfile.nic$': { [Op.like]: `%${search}%` } },
      { '$Customer.CustomerProfile.phone$': { [Op.like]: `%${search}%` } },
      { '$Area.name$': { [Op.like]: `%${search}%` } },
      { '$LoanType.name$': { [Op.like]: `%${search}%` } },
      { '$AssignedAgent.full_name$': { [Op.like]: `%${search}%` } },
      { '$Loan.loan_no$': { [Op.like]: `%${search}%` } },
    ];
  }

  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
  const offset = (page - 1) * limit;
  const include = [
    { model: User, as: 'Customer', attributes: customerAttributes, where: Object.keys(customerWhere).length ? customerWhere : undefined, include: [{ model: CustomerProfile, as: 'CustomerProfile', where: Object.keys(profileWhere).length ? profileWhere : undefined, include: [Area] }] },
    { model: User, as: 'AssignedAgent', attributes: ['id', 'full_name', 'email'], required: Boolean(Object.keys(agentWhere).length), where: Object.keys(agentWhere).length ? agentWhere : undefined },
    { model: LoanType, where: Object.keys(loanTypeWhere).length ? loanTypeWhere : undefined },
    { model: Area, where: Object.keys(areaWhere).length ? areaWhere : undefined },
    { model: Loan, as: 'Loan', required: Boolean(Object.keys(loanWhere).length), where: Object.keys(loanWhere).length ? loanWhere : undefined },
    { model: CreditAssessment, as: 'CreditAssessment', required: false, include: [{ model: User, as: 'AssessedBy', attributes: ['id', 'full_name'] }] },
    { model: FieldVisit, as: 'Visits', separate: true, order: [['created_at', 'DESC']], include: [
      { model: User, as: 'Agent', attributes: ['id', 'full_name'] },
      { model: VerificationReport, as: 'VerificationReport' },
      { model: FieldOfficerDocument, as: 'FieldDocuments', attributes: { exclude: ['file_path'] } },
    ] },
  ];
  const { rows, count } = await LoanApplication.findAndCountAll({ where, include, order: [['created_at', 'DESC']], distinct: true, subQuery: false, limit, offset });
  res.json({ success: true, data: rows, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
});

exports.getOne = asyncHandler(async (req, res) => {
  const application = await LoanApplication.findByPk(req.params.id, { include: applicationInclude });
  if (!application) throw new AppError('Application not found.', 404);
  const role = req.user.Role.name;
  if (role === 'CUSTOMER' && application.customer_id !== req.user.id) throw new AppError('Access denied.', 403);
  if (role === 'AGENT' && application.assigned_agent_id !== req.user.id) throw new AppError('Access denied.', 403);
  res.json({ success: true, data: application });
});

exports.recommendAgents = asyncHandler(async (req, res) => {
  const application = await LoanApplication.findByPk(req.params.id);
  if (!application) throw new AppError('Application not found.', 404);
  const scheduledDate = req.query.date ? dayjs(req.query.date) : dayjs().add(1, 'day');
  if (!scheduledDate.isValid()) throw new AppError('Invalid visit date.', 422);
  const role = await Role.findOne({ where: { name: 'AGENT' } });
  const visitTable = sequelize.getQueryInterface().queryGenerator.quoteTable(FieldVisit.getTableName());
  const agents = await User.findAll({
    where: { role_id: role.id, is_active: true },
    include: [{ model: Area, as: 'ServiceAreas', where: { id: application.area_id }, through: { attributes: [] } }],
    attributes: {
      include: [[literal(`(SELECT COUNT(*) FROM ${visitTable} fv WHERE fv.agent_id = User.id AND DATE(fv.scheduled_at) = ${sequelize.escape(scheduledDate.format('YYYY-MM-DD'))} AND fv.status NOT IN ('COMPLETED','CANCELLED'))`), 'visit_count']],
      exclude: ['password_hash'],
    },
    order: [[literal('visit_count'), 'ASC'], ['full_name', 'ASC']],
    subQuery: false,
  });
  res.json({ success: true, data: agents.map((agent) => ({ id: agent.id, full_name: agent.full_name, email: agent.email, visit_count: Number(agent.get('visit_count') || 0) })) });
});

exports.assignAgent = asyncHandler(async (req, res) => {
  const application = await LoanApplication.findByPk(req.params.id);
  if (!application) throw new AppError('Application not found.', 404);
  if (['APPROVED', 'REJECTED'].includes(application.status)) throw new AppError('A final decision already exists.', 409);
  const agent = await User.findByPk(req.body.agent_id, { include: [Role, { model: Area, as: 'ServiceAreas', through: { attributes: [] } }] });
  if (!agent || agent.Role.name !== 'AGENT' || !agent.is_active) throw new AppError('Valid active agent required.', 422);
  if (!agent.ServiceAreas.some((area) => area.id === application.area_id)) throw new AppError('The officer is not assigned to this service area.', 422);
  const transaction = await sequelize.transaction();
  try {
    await FieldVisit.create({ application_id: application.id, agent_id: agent.id, scheduled_at: req.body.scheduled_at, priority: req.body.priority || 'NORMAL', admin_instructions: req.body.admin_instructions || null }, { transaction });
    await application.update({ assigned_agent_id: agent.id, status: 'VISIT_SCHEDULED' }, { transaction });
    const customer = await User.findByPk(application.customer_id, { attributes: ['id', 'full_name'], transaction });
    await notifyUser(agent.id, {
      title: 'New field visit assigned', message: `${application.application_no} is scheduled for ${dayjs(req.body.scheduled_at).format('DD MMM YYYY, hh:mm A')}.`, type: 'VISIT', link: '/dashboard/visits',
      email: { kind: 'FIELD_VISIT_ASSIGNED_OFFICER', data: { application_no: application.application_no, customer_name: customer?.full_name || 'Customer', scheduled_at: req.body.scheduled_at, priority: req.body.priority || 'NORMAL', instructions: req.body.admin_instructions || '' } },
    }, transaction);
    await notifyUser(application.customer_id, {
      title: 'Field visit scheduled', message: `An agent has been assigned to ${application.application_no}.`, type: 'VISIT', link: '/dashboard/my-applications',
      email: { kind: 'FIELD_VISIT_ASSIGNED_CUSTOMER', data: { application_no: application.application_no, officer_name: agent.full_name, scheduled_at: req.body.scheduled_at, instructions: req.body.admin_instructions || '' } },
    }, transaction);
    await transaction.commit();
    await audit(req, 'FIELD_VISIT_ASSIGNED', 'LoanApplication', application.id, { agent_id: agent.id, scheduled_at: req.body.scheduled_at });
    res.json({ success: true, message: 'Field visit scheduled.' });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

exports.getAssessment = asyncHandler(async (req, res) => {
  const application = await LoanApplication.findByPk(req.params.id);
  if (!application) throw new AppError('Application not found.', 404);
  const assessment = await CreditAssessment.findOne({
    where: { application_id: application.id },
    include: [{ model: User, as: 'AssessedBy', attributes: ['id', 'full_name', 'email'] }],
  });
  res.json({ success: true, data: assessment });
});

exports.saveAssessment = asyncHandler(async (req, res) => {
  const application = await LoanApplication.findByPk(req.params.id, { include: [LoanType] });
  if (!application) throw new AppError('Application not found.', 404);
  if (['APPROVED', 'REJECTED'].includes(application.status)) throw new AppError('A final decision already exists.', 409);

  const householdExpenses = Number(req.body.household_expenses || 0);
  const existingLoanPayments = Number(req.body.existing_loan_payments || 0);
  const otherCommitments = Number(req.body.other_commitments || 0);
  const income = Number(application.monthly_income || 0);
  const disposableIncome = income - householdExpenses - existingLoanPayments - otherCommitments;
  const proposedAmount = Number(req.body.proposed_amount || application.requested_amount);
  if (proposedAmount <= 0 || proposedAmount > Number(application.requested_amount)) throw new AppError('Proposed amount must be positive and cannot exceed the requested amount.', 422);
  const interestRate = Number(req.body.proposed_interest_rate ?? application.LoanType.annual_interest_rate);
  const durationMonths = Number(req.body.proposed_duration_months ?? application.requested_duration_months ?? application.LoanType.duration_months);
  const firstInstallmentDate = dayjs().add(proposedAmount > 100000 ? 30 : 7, 'day').format('YYYY-MM-DD');
  const estimate = calculateFlatRateLoan({ principal: proposedAmount, annualInterestRate: interestRate, durationMonths, startDate: firstInstallmentDate });

  const [assessment, created] = await CreditAssessment.findOrCreate({
    where: { application_id: application.id },
    defaults: {
      application_id: application.id,
      assessed_by: req.user.id,
      monthly_income_snapshot: income,
      household_expenses: householdExpenses,
      existing_loan_payments: existingLoanPayments,
      other_commitments: otherCommitments,
      disposable_income: disposableIncome,
      proposed_amount: proposedAmount,
      proposed_interest_rate: interestRate,
      proposed_duration_months: durationMonths,
      estimated_installment: estimate.monthlyInstallment,
      risk_level: req.body.risk_level,
      recommendation: req.body.recommendation,
      notes: req.body.notes || null,
      assessed_at: new Date(),
    },
  });
  if (!created) {
    await assessment.update({
      assessed_by: req.user.id,
      monthly_income_snapshot: income,
      household_expenses: householdExpenses,
      existing_loan_payments: existingLoanPayments,
      other_commitments: otherCommitments,
      disposable_income: disposableIncome,
      proposed_amount: proposedAmount,
      proposed_interest_rate: interestRate,
      proposed_duration_months: durationMonths,
      estimated_installment: estimate.monthlyInstallment,
      risk_level: req.body.risk_level,
      recommendation: req.body.recommendation,
      notes: req.body.notes || null,
      assessed_at: new Date(),
    });
  }
  await application.update({ status: 'CREDIT_REVIEW' });
  await audit(req, 'CREDIT_ASSESSMENT_SAVED', 'LoanApplication', application.id, {
    risk_level: req.body.risk_level,
    recommendation: req.body.recommendation,
    proposed_amount: proposedAmount,
  });
  const fresh = await CreditAssessment.findByPk(assessment.id, { include: [{ model: User, as: 'AssessedBy', attributes: ['id', 'full_name'] }] });
  res.status(created ? 201 : 200).json({ success: true, data: fresh });
});

async function ensureDocumentsAccepted(application) {
  const customerDocs = await CustomerDocument.findAll({ where: { user_id: application.customer_id, is_current: true } });
  const missingCustomer = ['NIC_FRONT', 'NIC_BACK', 'RESIDENCE_PROOF'].filter((type) => !customerDocs.some((doc) => doc.document_type === type && doc.status === 'ACCEPTED'));
  if (missingCustomer.length) throw new AppError(`Required customer documents are not accepted: ${missingCustomer.join(', ')}.`, 422, 'CUSTOMER_DOCUMENT_REVIEW_INCOMPLETE');
  const visits = await FieldVisit.findAll({ where: { application_id: application.id }, include: [{ model: VerificationReport, as: 'VerificationReport' }, { model: FieldOfficerDocument, as: 'FieldDocuments', attributes: { exclude: ['file_path'] } }] });
  const completed = visits.find((visit) => visit.VerificationReport);
  if (!completed) throw new AppError('A completed field verification report is required.', 422, 'FIELD_REPORT_REQUIRED');
  const allFieldDocs = visits.flatMap((visit) => visit.FieldDocuments || []);
  const fieldReady = allFieldDocs.some((doc) => ['RESIDENCE_PHOTO', 'VISIT_REPORT', 'SIGNED_FORM'].includes(doc.document_type) && doc.status === 'ACCEPTED');
  if (!fieldReady) throw new AppError('At least one accepted residence photo, visit report or signed form is required.', 422, 'FIELD_DOCUMENT_REVIEW_INCOMPLETE');
  if (allFieldDocs.some((doc) => ['PENDING', 'REUPLOAD_REQUIRED'].includes(doc.status))) throw new AppError('All uploaded field documents must be reviewed before approval.', 422, 'FIELD_DOCUMENTS_PENDING');
}

exports.approve = asyncHandler(async (req, res) => {
  const application = await LoanApplication.findByPk(req.params.id, { include: [LoanType, { model: CreditAssessment, as: 'CreditAssessment' }] });
  if (!application) throw new AppError('Application not found.', 404);
  if (['APPROVED', 'REJECTED'].includes(application.status)) throw new AppError('A final decision already exists.', 409);
  await ensureDocumentsAccepted(application);
  if (!application.CreditAssessment) throw new AppError('Complete the credit assessment before approving the loan.', 422, 'CREDIT_ASSESSMENT_REQUIRED');
  const amount = Number(req.body.approved_amount);
  if (amount <= 0 || amount > Number(application.requested_amount)) throw new AppError('Approved amount must be positive and cannot exceed the requested amount.', 422);
  const interestRate = Number(req.body.interest_rate ?? application.LoanType.annual_interest_rate);
  const durationMonths = Number(req.body.duration_months ?? application.requested_duration_months ?? application.LoanType.duration_months);
  const calculation = calculateFlatRateLoan({
    principal: amount,
    annualInterestRate: interestRate,
    durationMonths,
    startDate: req.body.start_date,
  });
  const transaction = await sequelize.transaction();
  try {
    const loan = await Loan.create({
      loan_no: ref('LN'), application_id: application.id, customer_id: application.customer_id,
      principal: amount, interest_rate: interestRate, duration_months: durationMonths,
      total_interest: calculation.totalInterest, total_payable: calculation.totalPayable,
      monthly_installment: calculation.monthlyInstallment, start_date: calculation.startDate,
      end_date: calculation.endDate, remaining_balance: calculation.totalPayable, status: 'ACTIVE',
    }, { transaction });
    await RepaymentSchedule.bulkCreate(calculation.schedule.map((item) => ({ loan_id: loan.id, ...item })), { transaction });
    await application.update({ status: 'APPROVED', admin_note: req.body.admin_note || null, rejection_reason: null }, { transaction });
    await notifyUser(application.customer_id, {
      title: 'Loan approved', message: `${application.application_no} was approved. Loan number: ${loan.loan_no}.`, type: 'SUCCESS', link: '/dashboard/my-loans',
      email: { kind: 'LOAN_APPROVED', data: { loan_no: loan.loan_no, application_no: application.application_no, principal: amount, monthly_installment: calculation.monthlyInstallment, repayment_frequency: calculation.repaymentFrequency, total_payable: calculation.totalPayable, start_date: calculation.startDate, end_date: calculation.endDate, admin_note: req.body.admin_note || '' } },
    }, transaction);
    await notifyRole('CASHIER', { title: 'New approved loan', message: `${loan.loan_no} is ready for repayment tracking.`, type: 'LOAN', link: '/dashboard/payments' }, transaction);
    await transaction.commit();
    await audit(req, 'LOAN_APPROVED', 'Loan', loan.id, { application_id: application.id, loan_no: loan.loan_no, amount, repayment_frequency: calculation.repaymentFrequency, late_interest_policy: 'NONE' });
    res.status(201).json({ success: true, data: { loan: { ...loan.toJSON(), repayment_frequency: calculation.repaymentFrequency, installment_amount: calculation.installmentAmount }, schedule: calculation.schedule } });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

exports.reject = asyncHandler(async (req, res) => {
  const application = await LoanApplication.findByPk(req.params.id);
  if (!application) throw new AppError('Application not found.', 404);
  if (application.status === 'APPROVED') throw new AppError('An approved application cannot be rejected.', 409);
  await application.update({ status: 'REJECTED', rejection_reason: req.body.reason, admin_note: req.body.admin_note || null });
  await notifyUser(application.customer_id, {
    title: 'Loan application rejected', message: `${application.application_no}: ${req.body.reason}`, type: 'ERROR', link: '/dashboard/my-applications',
    email: { kind: 'LOAN_REJECTED', data: { application_no: application.application_no, reason: req.body.reason, decided_at: new Date() } },
  });
  await audit(req, 'LOAN_APPLICATION_REJECTED', 'LoanApplication', application.id, { reason: req.body.reason });
  res.json({ success: true, message: 'Application rejected.' });
});

exports.myLoans = asyncHandler(async (req, res) => {
  await RepaymentSchedule.update({ status: 'OVERDUE' }, {
    where: { due_date: { [Op.lt]: dayjs().format('YYYY-MM-DD') }, status: { [Op.in]: ['PENDING', 'PARTIAL'] } },
  });
  const data = await Loan.findAll({
    where: { customer_id: req.user.id },
    include: [{ model: RepaymentSchedule, as: 'Schedules' }, { model: LoanApplication, include: [LoanType] }],
    order: [['created_at', 'DESC']],
  });
  res.json({ success: true, data });
});
