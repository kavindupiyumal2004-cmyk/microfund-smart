const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const baseId = { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true };

const Role = sequelize.define('Role', {
  id: baseId,
  name: { type: DataTypes.ENUM('OWNER', 'MANAGER', 'AGENT', 'CASHIER', 'CUSTOMER'), allowNull: false, unique: true },
});

const User = sequelize.define('User', {
  id: baseId,
  full_name: { type: DataTypes.STRING(120), allowNull: false },
  email: { type: DataTypes.STRING(160), allowNull: false, unique: true, validate: { isEmail: true } },
  password_hash: { type: DataTypes.STRING(255), allowNull: false },
  role_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  email_verified_at: { type: DataTypes.DATE, allowNull: true },
  last_login_at: { type: DataTypes.DATE, allowNull: true },
}, { indexes: [{ fields: ['email'] }, { fields: ['role_id'] }, { fields: ['is_active'] }] });

const Area = sequelize.define('Area', {
  id: baseId,
  name: { type: DataTypes.STRING(100), allowNull: false },
  district: { type: DataTypes.STRING(100), allowNull: false },
  province: { type: DataTypes.STRING(100), allowNull: false },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { indexes: [{ unique: true, fields: ['name', 'district'] }] });

const CustomerProfile = sequelize.define('CustomerProfile', {
  id: baseId,
  user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
  nic: { type: DataTypes.STRING(20), allowNull: false, unique: true },
  phone: { type: DataTypes.STRING(20), allowNull: false },
  address_line1: { type: DataTypes.STRING(255), allowNull: false },
  city: { type: DataTypes.STRING(100), allowNull: false },
  area_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  occupation: { type: DataTypes.STRING(120), allowNull: true },
  monthly_income: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
});

const CashierProfile = sequelize.define('CashierProfile', {
  id: baseId,
  user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
  branch_name: { type: DataTypes.STRING(120), allowNull: true },
  is_available: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  max_pending_reviews: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 50 },
  last_assigned_at: { type: DataTypes.DATE, allowNull: true },
});

const AgentArea = sequelize.define('AgentArea', {
  id: baseId,
  user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  area_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
}, { indexes: [{ unique: true, fields: ['user_id', 'area_id'] }] });

const LoanType = sequelize.define('LoanType', {
  id: baseId,
  name: { type: DataTypes.STRING(120), allowNull: false, unique: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  min_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  max_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  annual_interest_rate: { type: DataTypes.DECIMAL(6, 2), allowNull: false },
  duration_months: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
});

const CustomerDocument = sequelize.define('CustomerDocument', {
  id: baseId,
  user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  document_type: { type: DataTypes.ENUM('NIC_FRONT', 'NIC_BACK', 'RESIDENCE_PROOF', 'INCOME_PROOF', 'OTHER'), allowNull: false },
  title: { type: DataTypes.STRING(160), allowNull: false },
  file_path: { type: DataTypes.STRING(500), allowNull: false },
  original_name: { type: DataTypes.STRING(255), allowNull: false },
  mime_type: { type: DataTypes.STRING(100), allowNull: false },
  size_bytes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  file_hash: { type: DataTypes.STRING(64), allowNull: true },
  status: { type: DataTypes.ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'REUPLOAD_REQUIRED'), allowNull: false, defaultValue: 'PENDING' },
  review_note: { type: DataTypes.TEXT, allowNull: true },
  reviewed_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  reviewed_at: { type: DataTypes.DATE, allowNull: true },
  version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
  is_current: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { indexes: [{ fields: ['user_id', 'document_type', 'is_current'] }, { fields: ['status'] }] });

const LoanApplication = sequelize.define('LoanApplication', {
  id: baseId,
  application_no: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  customer_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  loan_type_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  area_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  requested_duration_months: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  requested_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  purpose: { type: DataTypes.TEXT, allowNull: false },
  monthly_income: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  status: { type: DataTypes.ENUM('DRAFT', 'SUBMITTED', 'ASSIGNED', 'VISIT_SCHEDULED', 'VERIFICATION_COMPLETED', 'DOCUMENT_REVIEW', 'CREDIT_REVIEW', 'RETURNED', 'APPROVED', 'REJECTED'), defaultValue: 'SUBMITTED' },
  submitted_at: { type: DataTypes.DATE, allowNull: true },
  assigned_agent_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  admin_note: { type: DataTypes.TEXT, allowNull: true },
  rejection_reason: { type: DataTypes.TEXT, allowNull: true },
}, { indexes: [{ fields: ['customer_id'] }, { fields: ['status'] }, { fields: ['area_id'] }, { fields: ['application_no'] }] });

const FieldVisit = sequelize.define('FieldVisit', {
  id: baseId,
  application_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  agent_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  scheduled_at: { type: DataTypes.DATE, allowNull: false },
  status: { type: DataTypes.ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'RESCHEDULED', 'CANCELLED'), defaultValue: 'SCHEDULED' },
  priority: { type: DataTypes.ENUM('LOW', 'NORMAL', 'HIGH'), defaultValue: 'NORMAL' },
  admin_instructions: { type: DataTypes.TEXT, allowNull: true },
  completed_at: { type: DataTypes.DATE, allowNull: true },
}, { indexes: [{ fields: ['agent_id', 'scheduled_at'] }, { fields: ['application_id'] }] });

const VerificationReport = sequelize.define('VerificationReport', {
  id: baseId,
  visit_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
  residence_verified: { type: DataTypes.BOOLEAN, defaultValue: false },
  income_verified: { type: DataTypes.BOOLEAN, defaultValue: false },
  business_verified: { type: DataTypes.BOOLEAN, defaultValue: false },
  documents_verified: { type: DataTypes.BOOLEAN, defaultValue: false },
  guarantor_verified: { type: DataTypes.BOOLEAN, defaultValue: false },
  recommendation: { type: DataTypes.ENUM('APPROVE', 'REJECT', 'REVIEW_AGAIN'), allowNull: false },
  comments: { type: DataTypes.TEXT, allowNull: false },
});

const FieldOfficerDocument = sequelize.define('FieldOfficerDocument', {
  id: baseId,
  visit_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  agent_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  document_type: { type: DataTypes.ENUM('RESIDENCE_PHOTO', 'BUSINESS_PHOTO', 'INCOME_EVIDENCE', 'SIGNED_FORM', 'VISIT_REPORT', 'OTHER'), allowNull: false },
  title: { type: DataTypes.STRING(160), allowNull: false },
  file_path: { type: DataTypes.STRING(500), allowNull: false },
  original_name: { type: DataTypes.STRING(255), allowNull: false },
  mime_type: { type: DataTypes.STRING(100), allowNull: false },
  size_bytes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  file_hash: { type: DataTypes.STRING(64), allowNull: true },
  status: { type: DataTypes.ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'REUPLOAD_REQUIRED'), allowNull: false, defaultValue: 'PENDING' },
  review_note: { type: DataTypes.TEXT, allowNull: true },
  reviewed_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  reviewed_at: { type: DataTypes.DATE, allowNull: true },
}, { indexes: [{ fields: ['visit_id'] }, { fields: ['agent_id'] }, { fields: ['status'] }] });

const DocumentReview = sequelize.define('DocumentReview', {
  id: baseId,
  document_source: { type: DataTypes.ENUM('CUSTOMER', 'FIELD'), allowNull: false },
  document_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  reviewer_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  decision: { type: DataTypes.ENUM('ACCEPTED', 'REJECTED', 'REUPLOAD_REQUIRED'), allowNull: false },
  note: { type: DataTypes.TEXT, allowNull: true },
}, { indexes: [{ fields: ['document_source', 'document_id'] }, { fields: ['reviewer_id'] }] });

const CreditAssessment = sequelize.define('CreditAssessment', {
  id: baseId,
  application_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
  assessed_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  monthly_income_snapshot: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  household_expenses: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  existing_loan_payments: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  other_commitments: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  disposable_income: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  proposed_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  proposed_interest_rate: { type: DataTypes.DECIMAL(6, 2), allowNull: false },
  proposed_duration_months: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  estimated_installment: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  risk_level: { type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH'), allowNull: false },
  recommendation: { type: DataTypes.ENUM('APPROVE', 'REVIEW', 'REJECT'), allowNull: false },
  notes: { type: DataTypes.TEXT, allowNull: true },
  assessed_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { indexes: [{ fields: ['assessed_by'] }, { fields: ['risk_level'] }] });

const Loan = sequelize.define('Loan', {
  id: baseId,
  loan_no: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  application_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
  customer_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  principal: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  interest_rate: { type: DataTypes.DECIMAL(6, 2), allowNull: false },
  duration_months: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  total_interest: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  total_payable: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  monthly_installment: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  start_date: { type: DataTypes.DATEONLY, allowNull: false },
  end_date: { type: DataTypes.DATEONLY, allowNull: false },
  remaining_balance: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  status: { type: DataTypes.ENUM('ACTIVE', 'COMPLETED', 'DEFAULTED', 'CANCELLED'), defaultValue: 'ACTIVE' },
}, { indexes: [{ fields: ['customer_id'] }, { fields: ['status'] }, { fields: ['loan_no'] }] });

const RepaymentSchedule = sequelize.define('RepaymentSchedule', {
  id: baseId,
  loan_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  installment_no: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  due_date: { type: DataTypes.DATEONLY, allowNull: false },
  amount_due: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  amount_paid: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  status: { type: DataTypes.ENUM('PENDING', 'PARTIAL', 'PAID', 'OVERDUE'), defaultValue: 'PENDING' },
}, { indexes: [{ unique: true, fields: ['loan_id', 'installment_no'] }, { fields: ['due_date', 'status'] }] });

const CollectionCase = sequelize.define('CollectionCase', {
  id: baseId,
  case_no: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  loan_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  installment_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
  customer_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  assigned_agent_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  status: { type: DataTypes.ENUM('OPEN', 'CONTACTED', 'PROMISE_TO_PAY', 'ESCALATED', 'RESOLVED'), allowNull: false, defaultValue: 'OPEN' },
  priority: { type: DataTypes.ENUM('NORMAL', 'HIGH', 'CRITICAL'), allowNull: false, defaultValue: 'NORMAL' },
  days_overdue: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  overdue_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  promise_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
  promise_date: { type: DataTypes.DATEONLY, allowNull: true },
  next_followup_date: { type: DataTypes.DATEONLY, allowNull: true },
  manager_note: { type: DataTypes.TEXT, allowNull: true },
  resolved_at: { type: DataTypes.DATE, allowNull: true },
}, { indexes: [{ fields: ['assigned_agent_id', 'status'] }, { fields: ['status', 'priority'] }, { fields: ['customer_id'] }] });

const CollectionActivity = sequelize.define('CollectionActivity', {
  id: baseId,
  case_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  actor_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  action_type: { type: DataTypes.ENUM('CALL', 'SMS', 'FIELD_VISIT', 'NOTE', 'PROMISE', 'ESCALATION', 'RESOLUTION'), allowNull: false },
  note: { type: DataTypes.TEXT, allowNull: false },
  promise_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
  promise_date: { type: DataTypes.DATEONLY, allowNull: true },
}, { indexes: [{ fields: ['case_id', 'created_at'] }, { fields: ['actor_id'] }] });

const Payment = sequelize.define('Payment', {
  id: baseId,
  receipt_no: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  loan_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  installment_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  customer_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  recorded_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  source_submission_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, unique: true },
  amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  method: { type: DataTypes.ENUM('CASH', 'BANK_TRANSFER', 'CARD', 'OTHER'), defaultValue: 'CASH' },
  paid_at: { type: DataTypes.DATE, allowNull: false },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, { indexes: [{ fields: ['paid_at'] }, { fields: ['loan_id'] }] });

const OnlinePaymentSubmission = sequelize.define('OnlinePaymentSubmission', {
  id: baseId,
  submission_no: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  customer_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  loan_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  installment_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  payment_date: { type: DataTypes.DATEONLY, allowNull: false },
  bank_name: { type: DataTypes.STRING(120), allowNull: false },
  reference_no: { type: DataTypes.STRING(120), allowNull: false },
  slip_path: { type: DataTypes.STRING(500), allowNull: false },
  original_name: { type: DataTypes.STRING(255), allowNull: false },
  mime_type: { type: DataTypes.STRING(100), allowNull: false },
  size_bytes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  file_hash: { type: DataTypes.STRING(64), allowNull: true },
  customer_note: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.ENUM('SUBMITTED', 'ASSIGNED', 'UNDER_REVIEW', 'NEEDS_CLARIFICATION', 'ACCEPTED', 'REJECTED'), allowNull: false, defaultValue: 'SUBMITTED' },
  assigned_cashier_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  cashier_note: { type: DataTypes.TEXT, allowNull: true },
  duplicate_warning: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  submitted_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  reviewed_at: { type: DataTypes.DATE, allowNull: true },
  review_deadline_at: { type: DataTypes.DATE, allowNull: true },
  resubmission_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
}, { indexes: [{ fields: ['customer_id'] }, { fields: ['assigned_cashier_id', 'status'] }, { fields: ['reference_no'] }, { fields: ['submitted_at'] }] });

const PaymentSubmissionHistory = sequelize.define('PaymentSubmissionHistory', {
  id: baseId,
  submission_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  actor_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  from_status: { type: DataTypes.STRING(40), allowNull: true },
  to_status: { type: DataTypes.STRING(40), allowNull: false },
  note: { type: DataTypes.TEXT, allowNull: true },
  metadata: { type: DataTypes.JSON, allowNull: true },
}, { updatedAt: false, indexes: [{ fields: ['submission_id'] }] });

const PaymentSubmissionMessage = sequelize.define('PaymentSubmissionMessage', {
  id: baseId,
  submission_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  sender_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
}, { indexes: [{ fields: ['submission_id', 'created_at'] }] });

const Notification = sequelize.define('Notification', {
  id: baseId,
  user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  title: { type: DataTypes.STRING(160), allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  type: { type: DataTypes.STRING(50), defaultValue: 'INFO' },
  link: { type: DataTypes.STRING(255), allowNull: true },
  read_at: { type: DataTypes.DATE, allowNull: true },
}, { indexes: [{ fields: ['user_id', 'read_at'] }] });

const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  action: { type: DataTypes.STRING(100), allowNull: false },
  entity_type: { type: DataTypes.STRING(80), allowNull: true },
  entity_id: { type: DataTypes.STRING(80), allowNull: true },
  metadata: { type: DataTypes.JSON, allowNull: true },
  ip_address: { type: DataTypes.STRING(64), allowNull: true },
  user_agent: { type: DataTypes.STRING(255), allowNull: true },
}, { updatedAt: false, indexes: [{ fields: ['user_id'] }, { fields: ['action'] }, { fields: ['created_at'] }] });

const EmailToken = sequelize.define('EmailToken', {
  id: baseId,
  user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  type: { type: DataTypes.ENUM('VERIFY_EMAIL', 'RESET_PASSWORD'), allowNull: false },
  token_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  expires_at: { type: DataTypes.DATE, allowNull: false },
  used_at: { type: DataTypes.DATE, allowNull: true },
});

const ReportTemplate = sequelize.define('ReportTemplate', {
  id: baseId,
  owner_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  name: { type: DataTypes.STRING(120), allowNull: false },
  report_type: { type: DataTypes.STRING(60), allowNull: false },
  columns: { type: DataTypes.JSON, allowNull: false },
  filters: { type: DataTypes.JSON, allowNull: true },
}, { indexes: [{ fields: ['owner_id', 'report_type'] }] });

Role.hasMany(User, { foreignKey: 'role_id' });
User.belongsTo(Role, { foreignKey: 'role_id' });
User.hasOne(CustomerProfile, { foreignKey: 'user_id', as: 'CustomerProfile' });
CustomerProfile.belongsTo(User, { foreignKey: 'user_id' });
Area.hasMany(CustomerProfile, { foreignKey: 'area_id' });
CustomerProfile.belongsTo(Area, { foreignKey: 'area_id' });
User.hasOne(CashierProfile, { foreignKey: 'user_id', as: 'CashierProfile' });
CashierProfile.belongsTo(User, { foreignKey: 'user_id' });
User.belongsToMany(Area, { through: AgentArea, foreignKey: 'user_id', otherKey: 'area_id', as: 'ServiceAreas' });
Area.belongsToMany(User, { through: AgentArea, foreignKey: 'area_id', otherKey: 'user_id', as: 'Agents' });

User.hasMany(CustomerDocument, { foreignKey: 'user_id', as: 'CustomerDocuments' });
CustomerDocument.belongsTo(User, { foreignKey: 'user_id', as: 'Customer' });
CustomerDocument.belongsTo(User, { foreignKey: 'reviewed_by', as: 'ReviewedBy' });

User.hasMany(LoanApplication, { foreignKey: 'customer_id', as: 'Applications' });
LoanApplication.belongsTo(User, { foreignKey: 'customer_id', as: 'Customer' });
LoanType.hasMany(LoanApplication, { foreignKey: 'loan_type_id' });
LoanApplication.belongsTo(LoanType, { foreignKey: 'loan_type_id' });
Area.hasMany(LoanApplication, { foreignKey: 'area_id' });
LoanApplication.belongsTo(Area, { foreignKey: 'area_id' });
User.hasMany(LoanApplication, { foreignKey: 'assigned_agent_id', as: 'AssignedApplications' });
LoanApplication.belongsTo(User, { foreignKey: 'assigned_agent_id', as: 'AssignedAgent' });

LoanApplication.hasMany(FieldVisit, { foreignKey: 'application_id', as: 'Visits' });
FieldVisit.belongsTo(LoanApplication, { foreignKey: 'application_id' });
User.hasMany(FieldVisit, { foreignKey: 'agent_id', as: 'FieldVisits' });
FieldVisit.belongsTo(User, { foreignKey: 'agent_id', as: 'Agent' });
FieldVisit.hasOne(VerificationReport, { foreignKey: 'visit_id', as: 'VerificationReport' });
VerificationReport.belongsTo(FieldVisit, { foreignKey: 'visit_id' });
FieldVisit.hasMany(FieldOfficerDocument, { foreignKey: 'visit_id', as: 'FieldDocuments' });
FieldOfficerDocument.belongsTo(FieldVisit, { foreignKey: 'visit_id' });
User.hasMany(FieldOfficerDocument, { foreignKey: 'agent_id', as: 'UploadedFieldDocuments' });
FieldOfficerDocument.belongsTo(User, { foreignKey: 'agent_id', as: 'Agent' });
FieldOfficerDocument.belongsTo(User, { foreignKey: 'reviewed_by', as: 'ReviewedBy' });
DocumentReview.belongsTo(User, { foreignKey: 'reviewer_id', as: 'Reviewer' });

LoanApplication.hasOne(CreditAssessment, { foreignKey: 'application_id', as: 'CreditAssessment' });
CreditAssessment.belongsTo(LoanApplication, { foreignKey: 'application_id' });
User.hasMany(CreditAssessment, { foreignKey: 'assessed_by', as: 'CreditAssessments' });
CreditAssessment.belongsTo(User, { foreignKey: 'assessed_by', as: 'AssessedBy' });

LoanApplication.hasOne(Loan, { foreignKey: 'application_id', as: 'Loan' });
Loan.belongsTo(LoanApplication, { foreignKey: 'application_id' });
User.hasMany(Loan, { foreignKey: 'customer_id', as: 'Loans' });
Loan.belongsTo(User, { foreignKey: 'customer_id', as: 'Customer' });
Loan.hasMany(RepaymentSchedule, { foreignKey: 'loan_id', as: 'Schedules' });
RepaymentSchedule.belongsTo(Loan, { foreignKey: 'loan_id' });
Loan.hasMany(Payment, { foreignKey: 'loan_id', as: 'Payments' });
Payment.belongsTo(Loan, { foreignKey: 'loan_id' });
RepaymentSchedule.hasMany(Payment, { foreignKey: 'installment_id' });
Payment.belongsTo(RepaymentSchedule, { foreignKey: 'installment_id', as: 'Installment' });
User.hasMany(Payment, { foreignKey: 'recorded_by', as: 'RecordedPayments' });
Payment.belongsTo(User, { foreignKey: 'recorded_by', as: 'RecordedBy' });

Loan.hasMany(CollectionCase, { foreignKey: 'loan_id', as: 'CollectionCases' });
CollectionCase.belongsTo(Loan, { foreignKey: 'loan_id' });
RepaymentSchedule.hasOne(CollectionCase, { foreignKey: 'installment_id', as: 'CollectionCase' });
CollectionCase.belongsTo(RepaymentSchedule, { foreignKey: 'installment_id', as: 'Installment' });
User.hasMany(CollectionCase, { foreignKey: 'customer_id', as: 'CustomerCollectionCases' });
CollectionCase.belongsTo(User, { foreignKey: 'customer_id', as: 'Customer' });
User.hasMany(CollectionCase, { foreignKey: 'assigned_agent_id', as: 'AssignedCollectionCases' });
CollectionCase.belongsTo(User, { foreignKey: 'assigned_agent_id', as: 'AssignedAgent' });
CollectionCase.hasMany(CollectionActivity, { foreignKey: 'case_id', as: 'Activities' });
CollectionActivity.belongsTo(CollectionCase, { foreignKey: 'case_id' });
User.hasMany(CollectionActivity, { foreignKey: 'actor_id', as: 'CollectionActivities' });
CollectionActivity.belongsTo(User, { foreignKey: 'actor_id', as: 'Actor' });

User.hasMany(OnlinePaymentSubmission, { foreignKey: 'customer_id', as: 'PaymentSubmissions' });
OnlinePaymentSubmission.belongsTo(User, { foreignKey: 'customer_id', as: 'Customer' });
User.hasMany(OnlinePaymentSubmission, { foreignKey: 'assigned_cashier_id', as: 'AssignedPaymentSubmissions' });
OnlinePaymentSubmission.belongsTo(User, { foreignKey: 'assigned_cashier_id', as: 'AssignedCashier' });
Loan.hasMany(OnlinePaymentSubmission, { foreignKey: 'loan_id', as: 'OnlineSubmissions' });
OnlinePaymentSubmission.belongsTo(Loan, { foreignKey: 'loan_id' });
RepaymentSchedule.hasMany(OnlinePaymentSubmission, { foreignKey: 'installment_id' });
OnlinePaymentSubmission.belongsTo(RepaymentSchedule, { foreignKey: 'installment_id', as: 'Installment' });
OnlinePaymentSubmission.hasMany(PaymentSubmissionHistory, { foreignKey: 'submission_id', as: 'History' });
PaymentSubmissionHistory.belongsTo(OnlinePaymentSubmission, { foreignKey: 'submission_id' });
PaymentSubmissionHistory.belongsTo(User, { foreignKey: 'actor_id', as: 'Actor' });
OnlinePaymentSubmission.hasMany(PaymentSubmissionMessage, { foreignKey: 'submission_id', as: 'Messages' });
PaymentSubmissionMessage.belongsTo(OnlinePaymentSubmission, { foreignKey: 'submission_id' });
PaymentSubmissionMessage.belongsTo(User, { foreignKey: 'sender_id', as: 'Sender' });
OnlinePaymentSubmission.hasOne(Payment, { foreignKey: 'source_submission_id', as: 'Payment' });
Payment.belongsTo(OnlinePaymentSubmission, { foreignKey: 'source_submission_id', as: 'SourceSubmission' });

User.hasMany(Notification, { foreignKey: 'user_id' });
Notification.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(AuditLog, { foreignKey: 'user_id' });
AuditLog.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(EmailToken, { foreignKey: 'user_id' });
EmailToken.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(ReportTemplate, { foreignKey: 'owner_id', as: 'ReportTemplates' });
ReportTemplate.belongsTo(User, { foreignKey: 'owner_id', as: 'Owner' });

module.exports = {
  sequelize, Role, User, Area, CustomerProfile, CashierProfile, AgentArea, LoanType,
  CustomerDocument, LoanApplication, FieldVisit, VerificationReport, FieldOfficerDocument,
  DocumentReview, CreditAssessment, Loan, RepaymentSchedule, CollectionCase, CollectionActivity, Payment, OnlinePaymentSubmission,
  PaymentSubmissionHistory, PaymentSubmissionMessage, Notification, AuditLog, EmailToken,
  ReportTemplate,
};
