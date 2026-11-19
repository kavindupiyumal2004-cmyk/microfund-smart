import { useEffect, useMemo, useState } from 'react';
import { FileSearch, Save, SlidersHorizontal, X } from 'lucide-react';
import toast, { promptValue, Swal } from '../../utils/sweetAlert';
import api, { errorMessage } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import DocumentReviewPanel from '../../components/DocumentReviewPanel';
import { useAuth } from '../../contexts/AuthContext';

const initialFilters = { search: '', status: '', area_id: '', loan_type_id: '', agent_id: '', customer_name: '', nic: '', phone: '', email: '', loan_no: '', date_from: '', date_to: '' };
const emptyAssessment = { household_expenses: '', existing_loan_payments: '', other_commitments: '', proposed_amount: '', proposed_interest_rate: '', proposed_duration_months: '', risk_level: 'MEDIUM', recommendation: 'REVIEW', notes: '' };

const toLocalDateTimeInput = (date) => {
  const value = new Date(date);
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 16);
};

export default function AdminApplicationsPage() {
  const { user } = useAuth();
  const readOnly = user.role === 'OWNER';
  const [data, setData] = useState([]);
  const [filters, setFilters] = useState(initialFilters);
  const [areas, setAreas] = useState([]);
  const [loanTypes, setLoanTypes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [assessment, setAssessment] = useState(emptyAssessment);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const [showAdvanced, setShowAdvanced] = useState(false);

  const load = (page = 1) => api.get('/applications', { params: { ...filters, page, limit: 15 } }).then((response) => { setData(response.data.data); setPagination(response.data.pagination); });
  useEffect(() => { Promise.all([load(), api.get('/admin/areas').then((response) => setAreas(response.data.data)), api.get('/admin/loan-types').then((response) => setLoanTypes(response.data.data))]).catch((error) => toast.error(errorMessage(error))); }, []);

  const selectApplication = async (application) => {
    try {
      const response = await api.get(`/applications/${application.id}`);
      const item = response.data.data;
      setSelected(item);
      const current = item.CreditAssessment;
      setAssessment(current ? {
        household_expenses: current.household_expenses ?? '', existing_loan_payments: current.existing_loan_payments ?? '', other_commitments: current.other_commitments ?? '',
        proposed_amount: current.proposed_amount ?? '', proposed_interest_rate: current.proposed_interest_rate ?? '', proposed_duration_months: current.proposed_duration_months ?? '',
        risk_level: current.risk_level || 'MEDIUM', recommendation: current.recommendation || 'REVIEW', notes: current.notes || '',
      } : {
        ...emptyAssessment,
        proposed_amount: item.requested_amount || '', proposed_interest_rate: item.LoanType?.annual_interest_rate || '', proposed_duration_months: item.requested_duration_months || item.LoanType?.duration_months || '',
      });
    } catch (error) { toast.error(errorMessage(error)); }
  };

  const assign = async (application) => {
    const scheduledAt = await promptValue({ title: 'Schedule agent visit', text: `Choose the visit date and time for ${application.Customer?.full_name || application.application_no}.`, input: 'datetime-local', inputValue: toLocalDateTimeInput(Date.now() + 86400000), required: true, validationMessage: 'Select a visit date and time.', confirmButtonText: 'Find agents', icon: 'info' });
    if (!scheduledAt) return;
    try {
      const recommendation = await api.get(`/applications/${application.id}/recommend-agents`, { params: { date: scheduledAt.slice(0, 10) } });
      const officers = Array.isArray(recommendation.data?.data) ? recommendation.data.data : [];
      if (!officers.length) return toast.error('No active agent is assigned to this area.');
      const officerOptions = Object.fromEntries(officers.map((agent) => [String(agent.id), `${agent.full_name} — ${agent.visit_count} active visits`]));
      const agentId = await promptValue({ title: 'Select agent', text: 'Recommended agents are ordered by area match and current workload.', input: 'select', inputOptions: officerOptions, inputValue: String(officers[0].id), required: true, confirmButtonText: 'Continue' });
      if (!agentId) return;
      const instructions = await promptValue({ title: 'Agent instructions', text: 'Add optional instructions for the verification visit.', input: 'textarea', confirmButtonText: 'Schedule visit', inputAttributes: { maxlength: '1000' } });
      if (instructions === null) return;
      await api.post(`/applications/${application.id}/assign`, { agent_id: Number(agentId), scheduled_at: new Date(scheduledAt).toISOString(), priority: 'NORMAL', admin_instructions: instructions || '' });
      toast.success('Agent visit scheduled'); await load(pagination.page); await selectApplication(application);
    } catch (error) { toast.error(errorMessage(error)); }
  };

  const saveAssessment = async () => {
    try {
      const payload = {
        household_expenses: Number(assessment.household_expenses || 0), existing_loan_payments: Number(assessment.existing_loan_payments || 0), other_commitments: Number(assessment.other_commitments || 0),
        proposed_amount: Number(assessment.proposed_amount), proposed_interest_rate: Number(assessment.proposed_interest_rate), proposed_duration_months: Number(assessment.proposed_duration_months),
        risk_level: assessment.risk_level, recommendation: assessment.recommendation, notes: assessment.notes || '',
      };
      const response = await api.put(`/applications/${selected.id}/assessment`, payload);
      setSelected({ ...selected, status: 'CREDIT_REVIEW', CreditAssessment: response.data.data });
      toast.success('Credit assessment saved');
      await load(pagination.page);
    } catch (error) { toast.error(errorMessage(error)); }
  };

  const approve = async (application) => {
    if (!application.CreditAssessment) return toast.error('Complete and save the credit assessment first.');
    const proposedAmountForSchedule = Number(application.CreditAssessment?.proposed_amount || application.requested_amount || 0);
    const defaultStart = new Date(Date.now() + (proposedAmountForSchedule > 100000 ? 30 : 7) * 86400000).toISOString().slice(0, 10);
    const result = await Swal.fire({
      title: 'Approve loan', text: `${application.application_no} — ${application.Customer?.full_name || 'Customer'}`, icon: 'question',
      html: `<div class="microfund-swal-form">
        <label>Approved amount (LKR)<input id="swal-approved-amount" class="swal2-input" type="number" min="1" step="0.01" value="${Number(application.CreditAssessment?.proposed_amount || application.requested_amount || 0)}"></label>
        <label>Annual flat interest rate (%)<input id="swal-interest-rate" class="swal2-input" type="number" min="0" step="0.01" value="${Number(application.CreditAssessment?.proposed_interest_rate ?? application.LoanType?.annual_interest_rate ?? 0)}"></label>
        <label>Duration (months)<input id="swal-duration" class="swal2-input" type="number" min="1" step="1" value="${Number(application.CreditAssessment?.proposed_duration_months || application.requested_duration_months || application.LoanType?.duration_months || 12)}"></label>
        <div class="wide repayment-policy-note">Repayment frequency is automatic: LKR 100,000 or less = weekly; above LKR 100,000 = monthly. Late payments do not add extra interest or late-payment interest.</div>
        <label>First installment date<input id="swal-start-date" class="swal2-input" type="date" value="${defaultStart}"></label>
        <label class="wide">Approval note<textarea id="swal-admin-note" class="swal2-textarea" maxlength="1000" placeholder="Optional approval note"></textarea></label>
      </div>`,
      showCancelButton: true, confirmButtonText: 'Approve & create schedule', cancelButtonText: 'Cancel', reverseButtons: true, focusConfirm: false,
      preConfirm: () => {
        const approvedAmount = Number(document.getElementById('swal-approved-amount')?.value); const interestRate = Number(document.getElementById('swal-interest-rate')?.value); const durationMonths = Number(document.getElementById('swal-duration')?.value); const startDate = document.getElementById('swal-start-date')?.value; const adminNote = document.getElementById('swal-admin-note')?.value?.trim() || '';
        if (!approvedAmount || approvedAmount <= 0) return Swal.showValidationMessage('Enter a valid approved amount.');
        if (Number.isNaN(interestRate) || interestRate < 0) return Swal.showValidationMessage('Enter a valid interest rate.');
        if (!durationMonths || durationMonths < 1) return Swal.showValidationMessage('Enter a valid loan duration.');
        if (!startDate) return Swal.showValidationMessage('Select the first installment date.');
        return { approved_amount: approvedAmount, interest_rate: interestRate, duration_months: durationMonths, start_date: startDate, admin_note: adminNote };
      },
    });
    if (!result.isConfirmed) return;
    try { await api.post(`/applications/${application.id}/approve`, result.value); toast.success('Loan approved and repayment schedule generated'); setSelected(null); await load(pagination.page); } catch (error) { toast.error(errorMessage(error)); }
  };

  const reject = async (application) => {
    const reason = await promptValue({ title: 'Reject application', text: `Give a clear rejection reason for ${application.application_no}. The customer will see this note.`, input: 'textarea', required: true, validationMessage: 'A rejection reason is required.', confirmButtonText: 'Reject application', icon: 'warning', inputAttributes: { maxlength: '1000' } });
    if (!reason) return;
    try { await api.post(`/applications/${application.id}/reject`, { reason }); toast.success('Application rejected'); setSelected(null); await load(pagination.page); } catch (error) { toast.error(errorMessage(error)); }
  };

  const calculated = useMemo(() => {
    if (!selected) return { disposable: 0, ratio: 0 };
    const disposable = Number(selected.monthly_income || 0) - Number(assessment.household_expenses || 0) - Number(assessment.existing_loan_payments || 0) - Number(assessment.other_commitments || 0);
    const proposed = Number(assessment.proposed_amount || 0); const rate = Number(assessment.proposed_interest_rate || 0); const months = Number(assessment.proposed_duration_months || 0);
    const frequency = proposed > 100000 ? 'MONTHLY' : 'WEEKLY';
    const count = frequency === 'MONTHLY' ? months : Math.max(1, Math.ceil((months * 52) / 12));
    const estimated = count > 0 ? (proposed + (proposed * rate / 100 * months / 12)) / count : 0;
    const monthlyEquivalent = frequency === 'WEEKLY' ? estimated * (52 / 12) : estimated;
    return { disposable, estimated, frequency, ratio: disposable > 0 ? (monthlyEquivalent / disposable) * 100 : 0 };
  }, [selected, assessment]);

  const field = (name, label, type = 'text') => <label className="field"><span>{label}</span><input type={type} value={filters[name]} onChange={(event) => setFilters({ ...filters, [name]: event.target.value })} /></label>;
  const statusOptions = ['SUBMITTED', 'ASSIGNED', 'VISIT_SCHEDULED', 'VERIFICATION_COMPLETED', 'DOCUMENT_REVIEW', 'CREDIT_REVIEW', 'RETURNED', 'APPROVED', 'REJECTED'];

  return <>
    <div className="page-title"><div><span className="eyebrow">{readOnly ? 'Owner monitoring' : 'Manager operations'}</span><h1>Applications, verification and credit decision</h1><p>{readOnly ? 'Review every application, document, field report and credit assessment without changing operational records.' : 'Process applications from document review and field assignment through assessment, approval and repayment schedule creation.'}</p></div></div>
    <section className="filter-panel panel"><div className="filter-bar advanced-search-top"><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Quick search across application, loan, customer, NIC, phone or email" /><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select><button className="button button-sm" onClick={() => load(1)}><FileSearch size={16} />Search</button><button className="button button-sm button-light" onClick={() => setShowAdvanced(!showAdvanced)}><SlidersHorizontal size={16} />Advanced</button></div>{showAdvanced && <div className="advanced-filter-grid">{field('customer_name', 'Customer name')}{field('nic', 'NIC')}{field('phone', 'Phone')}{field('email', 'Email')}<label className="field"><span>Area</span><select value={filters.area_id} onChange={(event) => setFilters({ ...filters, area_id: event.target.value })}><option value="">All areas</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}, {area.district}</option>)}</select></label><label className="field"><span>Loan type</span><select value={filters.loan_type_id} onChange={(event) => setFilters({ ...filters, loan_type_id: event.target.value })}><option value="">All loan types</option>{loanTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>{field('loan_no', 'Loan number')}{field('date_from', 'From date', 'date')}{field('date_to', 'To date', 'date')}<button className="button button-light" onClick={() => setFilters(initialFilters)}>Clear filters</button></div>}</section>
    <section className="panel">{data.length ? <div className="table-wrap"><table><thead><tr><th>Application</th><th>Customer</th><th>Identity / contact</th><th>Loan</th><th>Area / agent</th><th>Assessment</th><th>Status</th><th>Actions</th></tr></thead><tbody>{data.map((application) => <tr key={application.id}><td><strong>{application.application_no}</strong><small className="table-subtext">{new Date(application.created_at).toLocaleDateString()}</small></td><td><strong>{application.Customer?.full_name}</strong><small className="table-subtext">{application.Customer?.email}</small></td><td>{application.Customer?.CustomerProfile?.nic}<small className="table-subtext">{application.Customer?.CustomerProfile?.phone}</small></td><td>{application.LoanType?.name}<small className="table-subtext">LKR {Number(application.requested_amount).toLocaleString()} · {application.Loan?.loan_no || 'Not approved'}</small></td><td>{application.Area?.name}<small className="table-subtext">{application.AssignedAgent?.full_name || 'Not assigned'}</small></td><td>{application.CreditAssessment ? <><StatusBadge value={application.CreditAssessment.risk_level}/><small className="table-subtext">{application.CreditAssessment.recommendation}</small></> : 'Not assessed'}</td><td><StatusBadge value={application.status} /></td><td><div className="record-actions"><button className="button button-sm button-light" onClick={() => selectApplication(application)}>View {readOnly ? 'details' : '& process'}</button>{!readOnly && ['SUBMITTED', 'ASSIGNED'].includes(application.status) && <button className="button button-sm" onClick={() => assign(application)}>Schedule</button>}</div></td></tr>)}</tbody></table></div> : <EmptyState title="No matching applications" text="Change the filters or wait for a new customer application." />}{pagination.pages > 1 && <div className="pagination"><button disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}>Previous</button><span>Page {pagination.page} of {pagination.pages}</span><button disabled={pagination.page >= pagination.pages} onClick={() => load(pagination.page + 1)}>Next</button></div>}</section>
    {selected && <div className="modal-backdrop"><div className="modal modal-wide"><div className="modal-head"><div><span className="eyebrow">Application review</span><h2>{selected.application_no}</h2><p>{selected.Customer?.full_name} · {selected.Customer?.CustomerProfile?.nic}</p></div><button onClick={() => setSelected(null)}><X /></button></div><div className="record-grid application-detail-grid"><p><span>Loan type</span>{selected.LoanType?.name}</p><p><span>Requested amount</span>LKR {Number(selected.requested_amount).toLocaleString()}</p><p><span>Requested term</span>{selected.requested_duration_months ? selected.requested_duration_months + ' months' : 'Not specified'}</p><p><span>Monthly income</span>LKR {Number(selected.monthly_income).toLocaleString()}</p><p><span>Area</span>{selected.Area?.name}</p><p><span>Assigned agent</span>{selected.AssignedAgent?.full_name || 'Not assigned'}</p><p><span>Status</span><StatusBadge value={selected.status} /></p><p className="wide"><span>Purpose</span>{selected.purpose}</p></div>{selected.Visits?.find((visit) => visit.VerificationReport)?.VerificationReport && <div className="verification-summary"><strong>Agent recommendation: {selected.Visits.find((visit) => visit.VerificationReport).VerificationReport.recommendation}</strong><p>{selected.Visits.find((visit) => visit.VerificationReport).VerificationReport.comments}</p></div>}<DocumentReviewPanel applicationId={selected.id} admin={!readOnly} />
      <section className="credit-assessment-panel"><div className="panel-head"><div><h3>Credit & repayment capacity assessment</h3><p>Manager records verified expenses and commitments before the final decision. The values are an internal assessment aid; the manager makes the final decision.</p></div>{selected.CreditAssessment?.AssessedBy && <small>Last assessed by {selected.CreditAssessment.AssessedBy.full_name}</small>}</div><div className="form-grid"><label className="field"><span>Monthly income</span><input value={selected.monthly_income} disabled /></label><label className="field"><span>Household expenses</span><input type="number" min="0" value={assessment.household_expenses} disabled={readOnly} onChange={(e)=>setAssessment({...assessment,household_expenses:e.target.value})}/></label><label className="field"><span>Existing loan payments</span><input type="number" min="0" value={assessment.existing_loan_payments} disabled={readOnly} onChange={(e)=>setAssessment({...assessment,existing_loan_payments:e.target.value})}/></label><label className="field"><span>Other commitments</span><input type="number" min="0" value={assessment.other_commitments} disabled={readOnly} onChange={(e)=>setAssessment({...assessment,other_commitments:e.target.value})}/></label><label className="field"><span>Proposed amount</span><input type="number" min="1" value={assessment.proposed_amount} disabled={readOnly} onChange={(e)=>setAssessment({...assessment,proposed_amount:e.target.value})}/></label><label className="field"><span>Interest rate %</span><input type="number" min="0" step="0.01" value={assessment.proposed_interest_rate} disabled={readOnly} onChange={(e)=>setAssessment({...assessment,proposed_interest_rate:e.target.value})}/></label><label className="field"><span>Duration months</span><input type="number" min="1" value={assessment.proposed_duration_months} disabled={readOnly} onChange={(e)=>setAssessment({...assessment,proposed_duration_months:e.target.value})}/></label><label className="field"><span>Risk level</span><select value={assessment.risk_level} disabled={readOnly} onChange={(e)=>setAssessment({...assessment,risk_level:e.target.value})}><option>LOW</option><option>MEDIUM</option><option>HIGH</option></select></label><label className="field"><span>Recommendation</span><select value={assessment.recommendation} disabled={readOnly} onChange={(e)=>setAssessment({...assessment,recommendation:e.target.value})}><option>APPROVE</option><option>REVIEW</option><option>REJECT</option></select></label><label className="field field-wide"><span>Assessment notes</span><textarea rows="3" value={assessment.notes} disabled={readOnly} onChange={(e)=>setAssessment({...assessment,notes:e.target.value})}/></label></div><div className="metric-grid compact-metrics"><article><small>Disposable income</small><strong>LKR {calculated.disposable.toLocaleString()}</strong></article><article><small>{calculated.frequency === 'WEEKLY' ? 'Estimated weekly installment' : 'Estimated monthly installment'}</small><strong>LKR {calculated.estimated.toLocaleString(undefined,{maximumFractionDigits:2})}</strong></article><article><small>Installment / disposable</small><strong>{Number.isFinite(calculated.ratio) ? calculated.ratio.toFixed(1) : '0.0'}%</strong></article></div>{!readOnly && <button className="button button-light" onClick={saveAssessment}><Save size={16}/>Save credit assessment</button>}</section>
      <div className="modal-sticky-actions">{!readOnly && !['APPROVED', 'REJECTED'].includes(selected.status) && <>{!selected.AssignedAgent && <button className="button button-light" onClick={() => assign(selected)}>Schedule agent</button>}<button className="button" onClick={() => approve(selected)}>Approve loan</button><button className="button button-danger" onClick={() => reject(selected)}>Reject application</button></>}</div></div></div>}
  </>;
}
