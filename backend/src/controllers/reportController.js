const PDFDocument = require('pdfkit');
const dayjs = require('dayjs');
const { Op } = require('sequelize');
const {
  User, Role, CustomerProfile, Area, LoanType, LoanApplication, Loan,
  RepaymentSchedule, Payment, OnlinePaymentSubmission, CollectionCase,
} = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');
const { audit } = require('../services/auditService');
const { refreshOverdueCases } = require('../services/collectionService');

const money = (value) => Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateText = (value) => value ? dayjs(value).format('DD MMM YYYY') : '-';
const dateTimeText = (value) => value ? dayjs(value).format('DD MMM YYYY HH:mm') : '-';

const definitions = {
  loans: {
    title: 'Loan Portfolio Report',
    columns: {
      loan_no: 'Loan No.', customer_name: 'Customer', nic: 'NIC', phone: 'Phone', application_no: 'Application No.',
      loan_type: 'Loan Type', principal: 'Principal (LKR)', total_payable: 'Total Payable (LKR)', paid_amount: 'Paid (LKR)',
      remaining_balance: 'Balance (LKR)', monthly_installment: 'Installment (LKR)', status: 'Status', start_date: 'Start Date', end_date: 'End Date',
    },
    defaults: ['loan_no', 'customer_name', 'nic', 'loan_type', 'principal', 'paid_amount', 'remaining_balance', 'status'],
  },
  applications: {
    title: 'Loan Application Report',
    columns: {
      application_no: 'Application No.', customer_name: 'Customer', nic: 'NIC', phone: 'Phone', email: 'Email', area: 'Area',
      loan_type: 'Loan Type', requested_amount: 'Requested (LKR)', monthly_income: 'Income (LKR)', assigned_officer: 'Agent',
      loan_no: 'Loan No.', status: 'Status', submitted_at: 'Submitted At',
    },
    defaults: ['application_no', 'customer_name', 'nic', 'area', 'loan_type', 'requested_amount', 'assigned_officer', 'status'],
  },
  payments: {
    title: 'Recorded Payment Report',
    columns: {
      receipt_no: 'Receipt No.', loan_no: 'Loan No.', customer_name: 'Customer', nic: 'NIC', amount: 'Amount (LKR)', method: 'Method',
      recorded_by: 'Recorded By', source: 'Source', paid_at: 'Paid At', notes: 'Notes',
    },
    defaults: ['receipt_no', 'loan_no', 'customer_name', 'amount', 'method', 'recorded_by', 'paid_at'],
  },
  payment_submissions: {
    title: 'Online Payment Slip Review Report',
    columns: {
      submission_no: 'Submission No.', customer_name: 'Customer', loan_no: 'Loan No.', installment_no: 'Installment', amount: 'Amount (LKR)',
      bank_name: 'Bank', reference_no: 'Reference', assigned_cashier: 'Cashier', status: 'Status', duplicate_warning: 'Duplicate Warning',
      submitted_at: 'Submitted At', reviewed_at: 'Reviewed At', review_hours: 'Review Hours', cashier_note: 'Cashier Note',
    },
    defaults: ['submission_no', 'customer_name', 'loan_no', 'amount', 'bank_name', 'reference_no', 'assigned_cashier', 'status', 'submitted_at'],
  },
  collections: {
    title: 'Overdue Collection Report',
    columns: {
      case_no: 'Case No.', loan_no: 'Loan No.', customer_name: 'Customer', installment_no: 'Installment', due_date: 'Due Date',
      overdue_amount: 'Overdue (LKR)', days_overdue: 'Days Overdue', assigned_agent: 'Agent', priority: 'Priority', status: 'Status',
      promise_amount: 'Promise Amount', promise_date: 'Promise Date', next_followup_date: 'Next Follow-up',
    },
    defaults: ['case_no', 'loan_no', 'customer_name', 'installment_no', 'overdue_amount', 'days_overdue', 'assigned_agent', 'priority', 'status'],
  },
  users: {
    title: 'Registered User Report',
    columns: {
      full_name: 'Name', email: 'Email', role: 'Role', nic: 'NIC', phone: 'Phone', area: 'Area / Branch', email_verified: 'Email Verified',
      document_status: 'Document Status', account_status: 'Account Status', registered_at: 'Registered At', last_login_at: 'Last Login',
    },
    defaults: ['full_name', 'email', 'role', 'nic', 'phone', 'area', 'account_status', 'registered_at'],
  },
};

function dateWhere(filters, field = 'created_at') {
  if (!filters?.date_from && !filters?.date_to) return {};
  const range = {};
  if (filters.date_from) range[Op.gte] = dayjs(filters.date_from).startOf('day').toDate();
  if (filters.date_to) range[Op.lte] = dayjs(filters.date_to).endOf('day').toDate();
  return { [field]: range };
}

async function loadRows(type, filters = {}, user = null) {
  const search = filters.search?.trim();
  if (type === 'loans') {
    const where = { ...dateWhere(filters) };
    if (filters.status) where.status = filters.status;
    if (search) where[Op.or] = [{ loan_no: { [Op.like]: `%${search}%` } }, { '$Customer.full_name$': { [Op.like]: `%${search}%` } }, { '$Customer.CustomerProfile.nic$': { [Op.like]: `%${search}%` } }];
    const rows = await Loan.findAll({ where, include: [
      { model: User, as: 'Customer', include: [{ model: CustomerProfile, as: 'CustomerProfile' }] },
      { model: LoanApplication, include: [LoanType] },
      { model: Payment, as: 'Payments' },
    ], order: [['created_at', 'DESC']], subQuery: false, limit: 1000 });
    return rows.map((row) => ({
      loan_no: row.loan_no, customer_name: row.Customer?.full_name, nic: row.Customer?.CustomerProfile?.nic, phone: row.Customer?.CustomerProfile?.phone,
      application_no: row.LoanApplication?.application_no, loan_type: row.LoanApplication?.LoanType?.name,
      principal: money(row.principal), total_payable: money(row.total_payable), paid_amount: money(row.Payments?.reduce((sum, p) => sum + Number(p.amount), 0)),
      remaining_balance: money(row.remaining_balance), monthly_installment: money(row.monthly_installment), status: row.status,
      start_date: dateText(row.start_date), end_date: dateText(row.end_date), _amount: Number(row.principal), _balance: Number(row.remaining_balance),
    }));
  }
  if (type === 'applications') {
    const where = { ...dateWhere(filters) };
    if (filters.status) where.status = filters.status;
    if (search) where[Op.or] = [{ application_no: { [Op.like]: `%${search}%` } }, { '$Customer.full_name$': { [Op.like]: `%${search}%` } }, { '$Customer.CustomerProfile.nic$': { [Op.like]: `%${search}%` } }, { '$Loan.loan_no$': { [Op.like]: `%${search}%` } }];
    const rows = await LoanApplication.findAll({ where, include: [
      { model: User, as: 'Customer', include: [{ model: CustomerProfile, as: 'CustomerProfile' }] },
      { model: User, as: 'AssignedAgent' }, LoanType, Area, { model: Loan, as: 'Loan' },
    ], order: [['created_at', 'DESC']], subQuery: false, limit: 1000 });
    return rows.map((row) => ({
      application_no: row.application_no, customer_name: row.Customer?.full_name, nic: row.Customer?.CustomerProfile?.nic, phone: row.Customer?.CustomerProfile?.phone,
      email: row.Customer?.email, area: row.Area?.name, loan_type: row.LoanType?.name, requested_amount: money(row.requested_amount), monthly_income: money(row.monthly_income),
      assigned_officer: row.AssignedAgent?.full_name || '-', loan_no: row.Loan?.loan_no || '-', status: row.status, submitted_at: dateTimeText(row.submitted_at), _amount: Number(row.requested_amount),
    }));
  }
  if (type === 'payments') {
    const where = { ...dateWhere(filters, 'paid_at') };
    if (user?.Role?.name === 'CASHIER') where.recorded_by = user.id;
    if (filters.method) where.method = filters.method;
    if (search) where[Op.or] = [{ receipt_no: { [Op.like]: `%${search}%` } }, { '$Loan.loan_no$': { [Op.like]: `%${search}%` } }, { '$Loan.Customer.full_name$': { [Op.like]: `%${search}%` } }];
    const rows = await Payment.findAll({ where, include: [
      { model: Loan, include: [{ model: User, as: 'Customer', include: [{ model: CustomerProfile, as: 'CustomerProfile' }] }] },
      { model: User, as: 'RecordedBy' },
    ], order: [['paid_at', 'DESC']], subQuery: false, limit: 1000 });
    return rows.map((row) => ({
      receipt_no: row.receipt_no, loan_no: row.Loan?.loan_no, customer_name: row.Loan?.Customer?.full_name, nic: row.Loan?.Customer?.CustomerProfile?.nic,
      amount: money(row.amount), method: row.method, recorded_by: row.RecordedBy?.full_name, source: row.source_submission_id ? 'ONLINE_SLIP' : 'OFFICE',
      paid_at: dateTimeText(row.paid_at), notes: row.notes || '-', _amount: Number(row.amount),
    }));
  }
  if (type === 'payment_submissions') {
    const where = { ...dateWhere(filters, 'submitted_at') };
    if (user?.Role?.name === 'CASHIER') where.assigned_cashier_id = user.id;
    if (filters.status) where.status = filters.status;
    if (search) where[Op.or] = [{ submission_no: { [Op.like]: `%${search}%` } }, { reference_no: { [Op.like]: `%${search}%` } }, { '$Customer.full_name$': { [Op.like]: `%${search}%` } }, { '$Loan.loan_no$': { [Op.like]: `%${search}%` } }];
    const rows = await OnlinePaymentSubmission.findAll({ where, include: [
      { model: User, as: 'Customer' }, { model: User, as: 'AssignedCashier' }, Loan, { model: RepaymentSchedule, as: 'Installment' },
    ], order: [['submitted_at', 'DESC']], subQuery: false, limit: 1000 });
    return rows.map((row) => ({
      submission_no: row.submission_no, customer_name: row.Customer?.full_name, loan_no: row.Loan?.loan_no, installment_no: row.Installment?.installment_no || '-',
      amount: money(row.amount), bank_name: row.bank_name, reference_no: row.reference_no, assigned_cashier: row.AssignedCashier?.full_name || 'Unassigned', status: row.status,
      duplicate_warning: row.duplicate_warning ? 'YES' : 'NO', submitted_at: dateTimeText(row.submitted_at), reviewed_at: dateTimeText(row.reviewed_at),
      review_hours: row.reviewed_at ? dayjs(row.reviewed_at).diff(dayjs(row.submitted_at), 'hour', true).toFixed(1) : '-', cashier_note: row.cashier_note || '-', _amount: Number(row.amount),
    }));
  }
  if (type === 'collections') {
    await refreshOverdueCases();
    const where = {};
    if (filters.status) where.status = filters.status;
    if (search) where[Op.or] = [
      { case_no: { [Op.like]: `%${search}%` } },
      { '$Loan.loan_no$': { [Op.like]: `%${search}%` } },
      { '$Customer.full_name$': { [Op.like]: `%${search}%` } },
    ];
    const rows = await CollectionCase.findAll({ where, include: [
      { model: User, as: 'Customer' }, { model: User, as: 'AssignedAgent' },
      { model: Loan }, { model: RepaymentSchedule, as: 'Installment' },
    ], order: [['days_overdue', 'DESC']], subQuery: false, limit: 1000 });
    return rows.map((row) => ({
      case_no: row.case_no, loan_no: row.Loan?.loan_no, customer_name: row.Customer?.full_name,
      installment_no: row.Installment?.installment_no, due_date: dateText(row.Installment?.due_date),
      overdue_amount: money(row.overdue_amount), days_overdue: row.days_overdue, assigned_agent: row.AssignedAgent?.full_name || 'Unassigned',
      priority: row.priority, status: row.status, promise_amount: row.promise_amount ? money(row.promise_amount) : '-',
      promise_date: dateText(row.promise_date), next_followup_date: dateText(row.next_followup_date), _amount: Number(row.overdue_amount || 0),
    }));
  }
  if (type === 'users') {
    const where = { ...dateWhere(filters) };
    if (filters.status === 'active') where.is_active = true;
    if (filters.status === 'inactive') where.is_active = false;
    if (search) where[Op.or] = [{ full_name: { [Op.like]: `%${search}%` } }, { email: { [Op.like]: `%${search}%` } }, { '$CustomerProfile.nic$': { [Op.like]: `%${search}%` } }];
    const roleWhere = filters.role ? { name: filters.role } : undefined;
    const rows = await User.findAll({ where, include: [
      { model: Role, where: roleWhere },
      { model: CustomerProfile, as: 'CustomerProfile', required: false, include: [Area] },
      { model: require('../models').CashierProfile, as: 'CashierProfile', required: false },
      { model: require('../models').CustomerDocument, as: 'CustomerDocuments', required: false, where: { is_current: true }, separate: true, attributes: ['id', 'document_type', 'status'] },
    ], attributes: { exclude: ['password_hash'] }, order: [['created_at', 'DESC']], subQuery: false, limit: 1000 });
    return rows.map((row) => {
      const docs = row.CustomerDocuments || [];
      const requiredAccepted = ['NIC_FRONT', 'NIC_BACK', 'RESIDENCE_PROOF'].every((typeName) => docs.some((doc) => doc.document_type === typeName && doc.status === 'ACCEPTED'));
      return {
        full_name: row.full_name, email: row.email, role: row.Role?.name, nic: row.CustomerProfile?.nic || '-', phone: row.CustomerProfile?.phone || '-',
        area: row.CustomerProfile?.Area?.name || row.CashierProfile?.branch_name || '-', email_verified: row.email_verified_at ? 'YES' : 'NO',
        document_status: row.Role?.name === 'CUSTOMER' ? (requiredAccepted ? 'ACCEPTED' : docs.length ? 'IN REVIEW' : 'MISSING') : '-',
        account_status: row.is_active ? 'ACTIVE' : 'INACTIVE', registered_at: dateText(row.created_at), last_login_at: dateTimeText(row.last_login_at),
      };
    });
  }
  throw new AppError('Unsupported report type.', 422, 'INVALID_REPORT_TYPE');
}

function summaryFor(type, rows) {
  const totalAmount = rows.reduce((sum, row) => sum + Number(row._amount || 0), 0);
  const summary = [{ label: 'Records', value: rows.length }];
  if (['loans', 'applications', 'payments', 'payment_submissions', 'collections'].includes(type)) summary.push({ label: type === 'loans' ? 'Total Principal' : 'Total Amount', value: `LKR ${money(totalAmount)}` });
  if (type === 'loans') summary.push({ label: 'Outstanding', value: `LKR ${money(rows.reduce((sum, row) => sum + Number(row._balance || 0), 0))}` });
  const statusCounts = {};
  for (const row of rows) if (row.status || row.account_status) statusCounts[row.status || row.account_status] = (statusCounts[row.status || row.account_status] || 0) + 1;
  const topStatus = Object.entries(statusCounts).sort((a, b) => b[1] - a[1])[0];
  if (topStatus) summary.push({ label: `Most Common: ${topStatus[0]}`, value: topStatus[1] });
  return summary.slice(0, 4);
}

function cleanRows(rows) {
  return rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => !key.startsWith('_'))));
}

function allowedReportTypes(user) {
  return ['OWNER', 'MANAGER'].includes(user?.Role?.name)
    ? Object.keys(definitions)
    : ['loans', 'payments', 'payment_submissions'];
}

function assertReportAccess(req, type) {
  if (!definitions[type]) throw new AppError('Invalid report type.', 422);
  if (!allowedReportTypes(req.user).includes(type)) throw new AppError('You do not have permission to generate this report.', 403, 'REPORT_ACCESS_DENIED');
}

exports.catalog = asyncHandler(async (req, res) => {
  const allowed = new Set(allowedReportTypes(req.user));
  res.json({ success: true, data: Object.fromEntries(Object.entries(definitions)
    .filter(([key]) => allowed.has(key))
    .map(([key, def]) => [key, { title: def.title, columns: def.columns, defaults: def.defaults }])) });
});

exports.preview = asyncHandler(async (req, res) => {
  const type = req.body.type;
  assertReportAccess(req, type);
  const rows = await loadRows(type, req.body.filters || {}, req.user);
  const columns = Array.isArray(req.body.columns) && req.body.columns.length ? req.body.columns.filter((column) => definitions[type].columns[column]) : definitions[type].defaults;
  res.json({ success: true, data: { title: req.body.title?.trim() || definitions[type].title, columns, labels: definitions[type].columns, rows: cleanRows(rows), summary: summaryFor(type, rows), filters: req.body.filters || {} } });
});

function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function renderPdf(res, report, generatedBy) {
  const landscape = report.columns.length > 7;
  const doc = new PDFDocument({ size: 'A4', layout: landscape ? 'landscape' : 'portrait', margin: 34, bufferPages: true });
  const filename = `${report.title.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_${dayjs().format('YYYYMMDD_HHmm')}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const left = doc.page.margins.left;
  const usable = pageWidth - doc.page.margins.left - doc.page.margins.right;
  const colors = { navy: '#102544', blue: '#0d5bd7', teal: '#16a085', light: '#eef4fb', ink: '#24364b', muted: '#6f8094', green: '#14855f', red: '#c0394a', orange: '#c36a08' };

  function header() {
    doc.rect(0, 0, pageWidth, 92).fill(colors.navy);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(24).text('MicroFund', left, 26);
    doc.font('Helvetica').fontSize(9).fillColor('#c9d8ed').text('Smart Microfinance Processing & Field Verification', left, 57);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16).text(report.title, pageWidth / 2 - 30, 27, { width: usable / 2 + 30, align: 'right' });
    doc.fillColor('#c9d8ed').font('Helvetica').fontSize(8).text(`Generated ${dayjs().format('DD MMM YYYY, HH:mm')} by ${generatedBy}`, pageWidth / 2 - 30, 57, { width: usable / 2 + 30, align: 'right' });
  }

  function footer(pageNumber, pageCount) {
    doc.save();
    doc.moveTo(left, pageHeight - 28).lineTo(pageWidth - left, pageHeight - 28).strokeColor('#dfe7f1').stroke();
    doc.fillColor(colors.muted).fontSize(8).text('Confidential operational report', left, pageHeight - 20);
    doc.text(`Page ${pageNumber} of ${pageCount}`, pageWidth - left - 90, pageHeight - 20, { width: 90, align: 'right' });
    doc.restore();
  }

  header();
  let y = 112;
  const gap = 10;
  const cardWidth = (usable - gap * (report.summary.length - 1)) / Math.max(report.summary.length, 1);
  report.summary.forEach((item, index) => {
    const x = left + index * (cardWidth + gap);
    doc.roundedRect(x, y, cardWidth, 58, 8).fill(index % 2 ? '#e9f8f3' : '#eaf2ff');
    doc.fillColor(colors.muted).font('Helvetica').fontSize(8).text(item.label, x + 12, y + 11, { width: cardWidth - 24 });
    doc.fillColor(index % 2 ? colors.green : colors.blue).font('Helvetica-Bold').fontSize(14).text(String(item.value), x + 12, y + 30, { width: cardWidth - 24 });
  });
  y += 76;
  const filtersText = Object.entries(report.filters || {}).filter(([, value]) => value).map(([key, value]) => `${key.replaceAll('_', ' ')}: ${value}`).join('  •  ') || 'No filters applied';
  doc.roundedRect(left, y, usable, 31, 6).fill(colors.light);
  doc.fillColor(colors.muted).font('Helvetica').fontSize(8).text(`Filters: ${filtersText}`, left + 10, y + 11, { width: usable - 20 });
  y += 43;

  const colWidths = report.columns.map((column) => {
    const label = report.labels[column] || column;
    const long = /note|email|customer|officer|cashier|area|type/i.test(column);
    return Math.max(long ? 90 : 58, label.length * 4.4 + 14);
  });
  const totalNatural = colWidths.reduce((a, b) => a + b, 0);
  const scale = Math.min(1, usable / totalNatural);
  const widths = colWidths.map((width) => width * scale);
  const rowHeight = 25;

  function tableHeader() {
    let x = left;
    doc.rect(left, y, usable, 27).fill(colors.blue);
    report.columns.forEach((column, index) => {
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7).text(report.labels[column], x + 5, y + 8, { width: widths[index] - 10, ellipsis: true });
      x += widths[index];
    });
    y += 27;
  }
  tableHeader();

  report.rows.forEach((row, rowIndex) => {
    if (y + rowHeight > pageHeight - 48) {
      doc.addPage();
      header();
      y = 112;
      tableHeader();
    }
    if (rowIndex % 2 === 0) doc.rect(left, y, usable, rowHeight).fill('#f7f9fc');
    let x = left;
    report.columns.forEach((column, index) => {
      const value = String(row[column] ?? '-');
      let color = colors.ink;
      if (column.includes('status')) {
        if (/APPROVED|ACCEPTED|PAID|ACTIVE|COMPLETED/i.test(value)) color = colors.green;
        if (/REJECTED|INACTIVE|DEFAULTED/i.test(value)) color = colors.red;
        if (/PENDING|REVIEW|OVERDUE|CLARIFICATION/i.test(value)) color = colors.orange;
      }
      doc.fillColor(color).font(column.includes('status') ? 'Helvetica-Bold' : 'Helvetica').fontSize(7).text(value, x + 5, y + 8, { width: widths[index] - 10, ellipsis: true });
      x += widths[index];
    });
    doc.moveTo(left, y + rowHeight).lineTo(left + usable, y + rowHeight).strokeColor('#e5eaf1').stroke();
    y += rowHeight;
  });
  if (!report.rows.length) doc.fillColor(colors.muted).fontSize(11).text('No records matched the selected filters.', left, y + 20, { width: usable, align: 'center' });

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    footer(i + 1, range.count);
  }
  doc.end();
}

exports.export = asyncHandler(async (req, res) => {
  const type = req.body.type;
  assertReportAccess(req, type);
  const rawRows = await loadRows(type, req.body.filters || {}, req.user);
  const columns = Array.isArray(req.body.columns) && req.body.columns.length ? req.body.columns.filter((column) => definitions[type].columns[column]) : definitions[type].defaults;
  const report = { title: req.body.title?.trim() || definitions[type].title, columns, labels: definitions[type].columns, rows: cleanRows(rawRows), summary: summaryFor(type, rawRows), filters: req.body.filters || {} };
  await audit(req, 'REPORT_EXPORTED', 'Report', type, { format: req.body.format || 'pdf', columns, filters: report.filters, record_count: report.rows.length });
  if (req.body.format === 'csv') {
    const lines = [columns.map((column) => csvEscape(report.labels[column])).join(',')];
    report.rows.forEach((row) => lines.push(columns.map((column) => csvEscape(row[column])).join(',')));
    const filename = `${report.title.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_${dayjs().format('YYYYMMDD_HHmm')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(`\uFEFF${lines.join('\n')}`);
  }
  return renderPdf(res, report, req.user.full_name);
});
