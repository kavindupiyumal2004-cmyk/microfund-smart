import { useEffect, useState } from 'react';
import { AlertTriangle, MessageSquare, X } from 'lucide-react';
import toast, { promptValue } from '../../utils/sweetAlert';
import api, { errorMessage } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import PrivateFileButton from '../../components/PrivateFileButton';
import { useAuth } from '../../contexts/AuthContext';

const statuses = ['', 'ASSIGNED', 'UNDER_REVIEW', 'NEEDS_CLARIFICATION', 'ACCEPTED', 'REJECTED', 'SUBMITTED'];

export default function PaymentReviewsPage() {
  const { user } = useAuth();
  const readOnly = user.role === 'OWNER';
  const [data, setData] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: '' });
  const [selected, setSelected] = useState(null);
  const [cashiers, setCashiers] = useState([]);
  const load = () => api.get('/payment-submissions', { params: filters }).then((response) => setData(response.data.data));
  useEffect(() => { load().catch((error) => toast.error(errorMessage(error))); if (user.role === 'MANAGER') api.get('/admin/cashiers').then((response) => setCashiers(response.data.data)); }, []);

  const start = async (submission) => {
    try { await api.patch(`/payment-submissions/${submission.id}/start`, {}); toast.success('Review started'); await load(); setSelected((await api.get(`/payment-submissions/${submission.id}`)).data.data); } catch (error) { toast.error(errorMessage(error)); }
  };
  const decide = async (submission, decision) => {
    const config = decision === 'ACCEPT'
      ? { title: 'Accept payment slip', text: 'The payment will be recorded and allocated to the loan schedule.', required: false, confirmButtonText: 'Accept & record payment', icon: 'success' }
      : decision === 'REJECT'
        ? { title: 'Reject payment slip', text: 'Enter a clear rejection reason for the customer.', required: true, confirmButtonText: 'Reject slip', icon: 'warning' }
        : { title: 'Request clarification', text: 'Explain what additional information or clearer evidence is required.', required: true, confirmButtonText: 'Send request', icon: 'info' };

    const note = await promptValue({
      ...config,
      input: 'textarea',
      validationMessage: 'A note is required for this decision.',
      inputAttributes: { maxlength: '1000' },
    });
    if (note === null || (config.required && !String(note).trim())) return;

    try {
      const response = await api.post(`/payment-submissions/${submission.id}/decision`, { decision, note: note || '' });
      const receipt = response.data?.payment?.receipt_no || response.data?.data?.receipt_no;
      toast.success(decision === 'ACCEPT' ? `Payment accepted${receipt ? `: ${receipt}` : ''}` : 'Decision saved');
      setSelected(null);
      await load();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const reply = async (submission) => {
    const message = await promptValue({
      title: 'Message customer',
      text: `Send a message about ${submission.submission_no}.`,
      input: 'textarea',
      required: true,
      validationMessage: 'Enter a message.',
      confirmButtonText: 'Send message',
      inputAttributes: { maxlength: '1000' },
    });
    if (!message) return;

    try {
      await api.post(`/payment-submissions/${submission.id}/messages`, { message });
      toast.success('Message sent');
      const response = await api.get(`/payment-submissions/${submission.id}`);
      setSelected(response.data.data);
      await load();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const reassign = async (submission) => {
    const options = { auto: 'Automatic assignment — lowest pending workload' };
    cashiers.forEach((cashier) => {
      options[String(cashier.id)] = `${cashier.full_name} — ${cashier.pending_reviews} pending reviews`;
    });
    const selectedCashier = await promptValue({
      title: 'Reassign payment review',
      text: 'Choose a cashier or allow the system to assign the lowest-workload active cashier.',
      input: 'select',
      inputOptions: options,
      inputValue: 'auto',
      required: true,
      confirmButtonText: 'Reassign',
    });
    if (!selectedCashier) return;

    try {
      await api.post(`/payment-submissions/${submission.id}/reassign`, {
        cashier_id: selectedCashier === 'auto' ? null : Number(selectedCashier),
        note: 'Manager reassignment',
      });
      toast.success('Submission reassigned');
      setSelected(null);
      await load();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return <>
    <div className="page-title"><div><span className="eyebrow">Payment verification</span><h1>Payment slip reviews</h1><p>{user.role === 'CASHIER' ? 'Only slips assigned to you are shown.' : readOnly ? 'Read-only owner view of cashier assignments and review decisions.' : 'Monitor every cashier assignment and review decision.'}</p></div></div>
    <div className="filter-bar"><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Submission, customer, loan or reference" /><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>{statuses.map((status) => <option key={status} value={status}>{status ? status.replaceAll('_', ' ') : 'All statuses'}</option>)}</select><button className="button button-sm" onClick={load}>Search</button></div>
    <section className="panel"><div className="table-wrap"><table><thead><tr><th>Submission</th><th>Customer / loan</th><th>Amount / bank</th><th>Reference</th><th>Assigned cashier</th><th>Status</th><th>Submitted</th><th></th></tr></thead><tbody>{data.map((submission) => <tr key={submission.id} className={submission.duplicate_warning ? 'warning-row' : ''}><td><strong>{submission.submission_no}</strong>{submission.duplicate_warning && <small className="table-subtext warning-text"><AlertTriangle size={13} />Possible duplicate</small>}</td><td>{submission.Customer?.full_name}<small className="table-subtext">{submission.Loan?.loan_no}</small></td><td>LKR {Number(submission.amount).toLocaleString()}<small className="table-subtext">{submission.bank_name}</small></td><td>{submission.reference_no}</td><td>{submission.AssignedCashier?.full_name || 'Unassigned'}</td><td><StatusBadge value={submission.status} /></td><td>{new Date(submission.submitted_at).toLocaleString()}</td><td><button className="button button-sm button-light" onClick={() => setSelected(submission)}>Review</button></td></tr>)}</tbody></table></div></section>
    {selected && <div className="modal-backdrop"><div className="modal modal-wide"><div className="modal-head"><div><span className="eyebrow">Payment slip review</span><h2>{selected.submission_no}</h2><p>{selected.Customer?.full_name} · {selected.Loan?.loan_no}</p></div><button onClick={() => setSelected(null)}><X /></button></div>{selected.duplicate_warning && <div className="warning-box"><AlertTriangle size={17} /> This submission matches an existing reference, file hash, amount or payment date. Verify carefully.</div>}<div className="two-column review-detail-grid"><section><div className="record-grid"><p><span>Amount</span>LKR {Number(selected.amount).toLocaleString()}</p><p><span>Payment date</span>{selected.payment_date}</p><p><span>Bank</span>{selected.bank_name}</p><p><span>Reference</span>{selected.reference_no}</p><p><span>Installment</span>{selected.Installment?.installment_no || 'Automatic allocation'}</p><p><span>Assigned cashier</span>{selected.AssignedCashier?.full_name || 'Unassigned'}</p><p className="wide"><span>Customer note</span>{selected.customer_note || '-'}</p></div><div className="record-actions"><PrivateFileButton url={selected.slip_url} label="Open slip" /><PrivateFileButton url={selected.slip_url} label="Download slip" download /></div></section><section><h3 className="subheading">Loan balance and schedule</h3><div className="metric-grid compact-metrics"><article><small>Remaining balance</small><strong>LKR {Number(selected.Loan?.remaining_balance || 0).toLocaleString()}</strong></article><article><small>{Number(selected.Loan?.principal || 0) > 100000 ? 'Monthly' : 'Weekly'} installment</small><strong>LKR {Number(selected.Loan?.monthly_installment || 0).toLocaleString()}</strong></article></div><div className="table-wrap short-table"><table><thead><tr><th>#</th><th>Due</th><th>Outstanding</th><th>Status</th></tr></thead><tbody>{selected.Loan?.Schedules?.filter((schedule) => schedule.status !== 'PAID').slice(0, 5).map((schedule) => <tr key={schedule.id}><td>{schedule.installment_no}</td><td>{schedule.due_date}</td><td>LKR {(Number(schedule.amount_due) - Number(schedule.amount_paid)).toLocaleString()}</td><td><StatusBadge value={schedule.status} /></td></tr>)}</tbody></table></div></section></div>{selected.cashier_note && <div className="review-note"><b>Current cashier note:</b> {selected.cashier_note}</div>}<div className="message-thread"><h3 className="subheading">Review messages</h3>{selected.Messages?.length ? selected.Messages.map((message) => <div className="message-row" key={message.id}><strong>{message.Sender?.full_name}</strong><p>{message.message}</p><small>{new Date(message.created_at).toLocaleString()}</small></div>) : <p>No messages yet.</p>}</div><div className="modal-sticky-actions">{readOnly ? <span className="read-only-note">Owner access is read-only.</span> : <>{['ASSIGNED', 'NEEDS_CLARIFICATION'].includes(selected.status) && <button className="button button-light" onClick={() => start(selected)}>Start review</button>}{!['ACCEPTED', 'REJECTED'].includes(selected.status) && <><button className="button" onClick={() => decide(selected, 'ACCEPT')}>Accept & record payment</button><button className="button button-warning" onClick={() => decide(selected, 'CLARIFY')}>Request clarification</button><button className="button button-danger" onClick={() => decide(selected, 'REJECT')}>Reject slip</button><button className="button button-light" onClick={() => reply(selected)}><MessageSquare size={15} />Message customer</button></>}{user.role === 'MANAGER' && <button className="button button-light" onClick={() => reassign(selected)}>Reassign cashier</button>}</>}</div></div></div>}
  </>;
}
