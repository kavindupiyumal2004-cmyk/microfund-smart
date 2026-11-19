import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from '../../utils/sweetAlert';
import api, { errorMessage } from '../../api/client';

export default function ApplyLoanPage() {
  const [types, setTypes] = useState([]);
  const [areas, setAreas] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [form, setForm] = useState({ loan_type_id: '', area_id: '', requested_amount: '', requested_frequency: '', requested_duration_months: '', monthly_income: '', purpose: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { Promise.all([api.get('/public/loan-types'), api.get('/public/areas'), api.get('/documents/customer/readiness')]).then(([typesResponse, areasResponse, readyResponse]) => { setTypes(typesResponse.data.data); setAreas(areasResponse.data.data); setReadiness(readyResponse.data.data); }).catch((error) => toast.error(errorMessage(error))); }, []);
  const selected = types.find((type) => type.id === Number(form.loan_type_id));
  const amount = Number(form.requested_amount);
  const months = Number(form.requested_duration_months);
  const frequency = amount <= 50000 ? 'WEEKLY' : form.requested_frequency;
  const weekly = frequency === 'WEEKLY';
  const maxTerm = Math.min(Number(selected?.duration_months || 0), 120);
  const count = weekly ? Math.ceil(months * 52 / 12) : months;
  const validEstimate = selected && amount > 0 && amount >= selected.min_amount && amount <= selected.max_amount
    && Number.isInteger(months) && months >= 1 && months <= maxTerm && Boolean(frequency);
  const interest = validEstimate ? Number((amount * (Number(selected.annual_interest_rate) / 100) * (months / 12)).toFixed(2)) : 0;
  const total = Number((amount + interest).toFixed(2));
  const money = (value) => value.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post('/applications', { ...form, requested_frequency: frequency, loan_type_id: Number(form.loan_type_id), area_id: Number(form.area_id), requested_amount: Number(form.requested_amount), monthly_income: Number(form.monthly_income) });
      toast.success('Loan application submitted');
      setForm({ loan_type_id: '', area_id: '', requested_amount: '', requested_frequency: '', requested_duration_months: '', monthly_income: '', purpose: '' });
    } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };
  return <>
    <div className="page-title"><div><span className="eyebrow">Customer</span><h1>Apply for a loan</h1><p>Your registration documents are linked automatically to every application.</p></div></div>
    {readiness && !readiness.ready_for_review && <div className="warning-box">Required customer documents are incomplete. <Link to="/dashboard/documents">Upload documents before applying.</Link></div>}
    <section className="panel form-panel"><form onSubmit={submit} className="form-stack"><div className="form-grid"><label className="field"><span>Loan type</span><select value={form.loan_type_id} onChange={(event) => setForm({ ...form, loan_type_id: event.target.value, requested_duration_months: Math.min(types.find(type => String(type.id) === event.target.value)?.duration_months || 0, 120) || '' })} required><option value="">Select loan type</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label><label className="field"><span>Service area</span><select value={form.area_id} onChange={(event) => setForm({ ...form, area_id: event.target.value })} required><option value="">Select area</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}, {area.district}</option>)}</select></label><label className="field"><span>Requested amount (LKR)</span><input type="number" step="0.01" value={form.requested_amount} min={selected?.min_amount || 1} max={selected?.max_amount || undefined} onChange={(event) => setForm({ ...form, requested_amount: event.target.value })} required />{selected && <small>Allowed: LKR {Number(selected.min_amount).toLocaleString()} – {Number(selected.max_amount).toLocaleString()}</small>}</label>
      <label className="field"><span>Repayment frequency</span>
        <select required disabled={amount <= 50000} value={frequency} onChange={event => setForm({ ...form, requested_frequency: event.target.value })}>
          {amount > 50000 && <option value="">Choose weekly or monthly</option>}
          <option value="WEEKLY">Weekly</option>
          {amount > 50000 && <option value="MONTHLY">Monthly</option>}
        </select>
      </label>
      <label className="field"><span>Requested term (months)</span>
        <input type="number" min="1" max={maxTerm || undefined} disabled={!selected} step="1" required value={form.requested_duration_months} onChange={event => setForm({ ...form, requested_duration_months: event.target.value })} />
        {selected && <small>Maximum term: {maxTerm} months</small>}
      </label>
      <label className="field"><span>Current monthly income (LKR)</span><input type="number" min="1" value={form.monthly_income} onChange={(event) => setForm({ ...form, monthly_income: event.target.value })} required /></label><label className="field field-wide"><span>Purpose of the loan</span><textarea value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value })} minLength="10" rows="5" required placeholder="Explain how the funds will be used..." /></label></div>
      <section aria-live="polite" className="loan-policy-note">
        <strong>Repayment estimate</strong>
        {validEstimate ? <>
          <p>{count} {weekly ? 'weekly' : 'monthly'} installments over {months} months · LKR {money(total / count)} per installment.</p>
          <p>Annual flat rate: {Number(selected.annual_interest_rate)}% · Total repayment: LKR {money(total)}. Final terms are confirmed at approval.</p>
        </> : <p>Choose a loan type and enter an eligible amount and term to see your installment.</p>}
        <p>Up to LKR 50,000 is repaid weekly. Above LKR 50,000 you can choose weekly or monthly installments.</p>
      </section>
      <div className="info-box">Identity, residence and income documents are managed from <Link to="/dashboard/documents">My Documents</Link>. Manager will accept or reject each file separately.</div><button className="button" disabled={busy || (readiness && !readiness.ready_for_review)}>{busy ? 'Submitting...' : 'Submit loan application'}</button></form></section>
  </>;
}
