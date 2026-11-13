import { useEffect, useMemo, useState } from 'react';
import { MessageSquare, UploadCloud } from 'lucide-react';
import toast, { promptValue } from '../../utils/sweetAlert';
import api, { errorMessage } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import PrivateFileButton from '../../components/PrivateFileButton';

export default function PaymentSlipsPage() {
  const [loans, setLoans] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ loan_id: '', installment_id: '', amount: '', payment_date: new Date().toISOString().slice(0, 10), bank_name: '', reference_no: '', customer_note: '', slip: null });
  const [busy, setBusy] = useState(false);
  const load = () => Promise.all([api.get('/applications/my-loans'), api.get('/payment-submissions/mine')]).then(([loanResponse, submissionResponse]) => { setLoans(loanResponse.data.data); setSubmissions(submissionResponse.data.data); });
  useEffect(() => { load().catch((error) => toast.error(errorMessage(error))); }, []);
  const loan = useMemo(() => loans.find((item) => item.id === Number(form.loan_id)), [loans, form.loan_id]);
  const pendingSchedules = loan?.Schedules?.filter((schedule) => schedule.status !== 'PAID') || [];
  const selectLoan = (value) => {
    const next = loans.find((item) => item.id === Number(value));
    const installment = next?.Schedules?.find((item) => item.status !== 'PAID');
    setForm({ ...form, loan_id: value, installment_id: installment?.id || '', amount: installment ? (Number(installment.amount_due) - Number(installment.amount_paid)).toFixed(2) : '' });
  };
  const submit = async (event) => {
    event.preventDefault();
    if (!form.slip) return toast.error('Upload the bank payment slip.');
    setBusy(true);
    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => { if (value !== '' && value !== null) payload.append(key, value); });
      await api.post('/payment-submissions', payload, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 });
      toast.success('Payment slip submitted for cashier review');
      setForm({ loan_id: '', installment_id: '', amount: '', payment_date: new Date().toISOString().slice(0, 10), bank_name: '', reference_no: '', customer_note: '', slip: null });
      await load();
    } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };
  const reply = async (submission) => {
    const message = await promptValue({
      title: 'Reply to cashier',
      text: `Send clarification for ${submission.submission_no}.`,
      input: 'textarea',
      required: true,
      validationMessage: 'Enter your reply.',
      confirmButtonText: 'Send reply',
      inputAttributes: { maxlength: '1000' },
    });
    if (!message) return;
    try {
      await api.post(`/payment-submissions/${submission.id}/messages`, { message });
      toast.success('Reply sent');
      await load();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  return <>
    <div className="page-title"><div><span className="eyebrow">Online bank payments</span><h1>Payment slips</h1><p>Upload a transfer slip and track the assigned cashier review.</p></div></div>
    <div className="two-column payment-submission-layout">
      <section className="panel"><div className="panel-head"><div><h2>Submit payment evidence</h2><p>The payment is applied only after cashier acceptance.</p></div></div><form onSubmit={submit} className="form-stack">
        <label className="field"><span>Active loan</span><select value={form.loan_id} onChange={(event) => selectLoan(event.target.value)} required><option value="">Select loan</option>{loans.filter((item) => item.status === 'ACTIVE').map((item) => <option key={item.id} value={item.id}>{item.loan_no} · Balance LKR {Number(item.remaining_balance).toLocaleString()}</option>)}</select></label>
        <label className="field"><span>Installment</span><select value={form.installment_id} onChange={(event) => setForm({ ...form, installment_id: event.target.value })}><option value="">Allocate automatically</option>{pendingSchedules.map((item) => <option key={item.id} value={item.id}>#{item.installment_no} · {item.due_date} · Outstanding LKR {(Number(item.amount_due) - Number(item.amount_paid)).toLocaleString()}</option>)}</select></label>
        <div className="form-grid"><label className="field"><span>Amount (LKR)</span><input type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required /></label><label className="field"><span>Payment date</span><input type="date" value={form.payment_date} onChange={(event) => setForm({ ...form, payment_date: event.target.value })} required /></label></div>
        <div className="form-grid"><label className="field"><span>Bank / channel</span><input value={form.bank_name} onChange={(event) => setForm({ ...form, bank_name: event.target.value })} placeholder="Commercial Bank / CEFT" required /></label><label className="field"><span>Transaction reference</span><input value={form.reference_no} onChange={(event) => setForm({ ...form, reference_no: event.target.value })} required /></label></div>
        <label className="field"><span>Customer note</span><textarea rows="3" value={form.customer_note} onChange={(event) => setForm({ ...form, customer_note: event.target.value })} /></label>
        <label className="file-field"><UploadCloud /><span>Payment slip</span><input type="file" accept="image/*,.pdf" onChange={(event) => setForm({ ...form, slip: event.target.files?.[0] || null })} required /><small>{form.slip?.name || 'PDF, JPG, PNG or WEBP'}</small></label>
        <button className="button" disabled={busy}>{busy ? 'Submitting...' : 'Submit payment slip'}</button>
      </form></section>
      <section className="panel"><div className="panel-head"><div><h2>Submission history</h2><p>Cashier notes and decisions appear here.</p></div></div><div className="card-list scroll-list">{submissions.map((submission) => <article className="record-card" key={submission.id}><div className="record-top"><div><small>{submission.Loan?.loan_no}</small><h3>{submission.submission_no}</h3></div><StatusBadge value={submission.status} /></div><div className="record-grid"><p><span>Amount</span>LKR {Number(submission.amount).toLocaleString()}</p><p><span>Bank</span>{submission.bank_name}</p><p><span>Reference</span>{submission.reference_no}</p><p><span>Assigned cashier</span>{submission.AssignedCashier?.full_name || 'Waiting assignment'}</p><p><span>Submitted</span>{new Date(submission.submitted_at).toLocaleString()}</p><p><span>Duplicate check</span>{submission.duplicate_warning ? 'Possible duplicate' : 'Clear'}</p></div>{submission.cashier_note && <div className="review-note"><b>Cashier note:</b> {submission.cashier_note}</div>}<div className="record-actions"><PrivateFileButton url={submission.slip_url} label="View slip" /><button type="button" className="button button-sm button-light" onClick={() => setSelected(selected?.id === submission.id ? null : submission)}><MessageSquare size={15} />Messages</button>{submission.status === 'NEEDS_CLARIFICATION' && <button type="button" className="button button-sm" onClick={() => reply(submission)}>Reply</button>}</div>{selected?.id === submission.id && <div className="message-thread">{submission.Messages?.length ? submission.Messages.map((message) => <div className="message-row" key={message.id}><strong>{message.Sender?.full_name}</strong><p>{message.message}</p><small>{new Date(message.created_at).toLocaleString()}</small></div>) : <p>No messages yet.</p>}</div>}</article>)}</div></section>
    </div>
  </>;
}
