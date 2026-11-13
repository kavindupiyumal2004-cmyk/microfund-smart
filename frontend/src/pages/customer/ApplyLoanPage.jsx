import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from '../../utils/sweetAlert';
import api, { errorMessage } from '../../api/client';

export default function ApplyLoanPage() {
  const [types, setTypes] = useState([]);
  const [areas, setAreas] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [form, setForm] = useState({ loan_type_id: '', area_id: '', requested_amount: '', monthly_income: '', purpose: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { Promise.all([api.get('/public/loan-types'), api.get('/public/areas'), api.get('/documents/customer/readiness')]).then(([typesResponse, areasResponse, readyResponse]) => { setTypes(typesResponse.data.data); setAreas(areasResponse.data.data); setReadiness(readyResponse.data.data); }).catch((error) => toast.error(errorMessage(error))); }, []);
  const selected = types.find((type) => type.id === Number(form.loan_type_id));
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post('/applications', { ...form, loan_type_id: Number(form.loan_type_id), area_id: Number(form.area_id), requested_amount: Number(form.requested_amount), monthly_income: Number(form.monthly_income) });
      toast.success('Loan application submitted');
      setForm({ loan_type_id: '', area_id: '', requested_amount: '', monthly_income: '', purpose: '' });
    } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };
  return <>
    <div className="page-title"><div><span className="eyebrow">Customer</span><h1>Apply for a loan</h1><p>Your registration documents are linked automatically to every application.</p></div></div>
    {readiness && !readiness.ready_for_review && <div className="warning-box">Required customer documents are incomplete. <Link to="/dashboard/documents">Upload documents before applying.</Link></div>}
    <section className="panel form-panel"><form onSubmit={submit} className="form-stack"><div className="form-grid"><label className="field"><span>Loan type</span><select value={form.loan_type_id} onChange={(event) => setForm({ ...form, loan_type_id: event.target.value })} required><option value="">Select loan type</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label><label className="field"><span>Service area</span><select value={form.area_id} onChange={(event) => setForm({ ...form, area_id: event.target.value })} required><option value="">Select area</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}, {area.district}</option>)}</select></label><label className="field"><span>Requested amount (LKR)</span><input type="number" value={form.requested_amount} min={selected?.min_amount || 1} max={selected?.max_amount || undefined} onChange={(event) => setForm({ ...form, requested_amount: event.target.value })} required />{selected && <small>Allowed: LKR {Number(selected.min_amount).toLocaleString()} – {Number(selected.max_amount).toLocaleString()}</small>}</label><label className="field"><span>Current monthly income (LKR)</span><input type="number" min="1" value={form.monthly_income} onChange={(event) => setForm({ ...form, monthly_income: event.target.value })} required /></label><label className="field field-wide"><span>Purpose of the loan</span><textarea value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value })} minLength="10" rows="5" required placeholder="Explain how the funds will be used..." /></label></div><div className="info-box">Identity, residence and income documents are managed from <Link to="/dashboard/documents">My Documents</Link>. Manager will accept or reject each file separately.</div><button className="button" disabled={busy || (readiness && !readiness.ready_for_review)}>{busy ? 'Submitting...' : 'Submit loan application'}</button></form></section>
  </>;
}
