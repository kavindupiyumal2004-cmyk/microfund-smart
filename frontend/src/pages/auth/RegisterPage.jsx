import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileCheck2, ShieldCheck, UserRound } from 'lucide-react';
import toast from '../../utils/sweetAlert';
import api, { errorMessage } from '../../api/client';
import PasswordField from '../../components/PasswordField';
import AuthShell from './AuthShell';

const initial = { full_name: '', email: '', password: '', confirm_password: '', nic: '', phone: '', address_line1: '', city: '', area_id: '', occupation: '', monthly_income: '' };

export default function RegisterPage() {
  const [form, setForm] = useState(initial);
  const [files, setFiles] = useState({ nic_front: null, nic_back: null, residence_proof: null, income_proof: null });
  const [areas, setAreas] = useState([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  useEffect(() => { api.get('/public/areas').then((response) => setAreas(response.data.data)).catch(() => toast.error('Unable to load service areas.')); }, []);
  const change = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  const fileChange = (event) => setFiles({ ...files, [event.target.name]: event.target.files?.[0] || null });

  const submit = async (event) => {
    event.preventDefault();
    if (form.password !== form.confirm_password) return toast.error('Passwords do not match.');
    if (!files.nic_front || !files.nic_back || !files.residence_proof) return toast.error('NIC front, NIC back and residence proof are required.');
    setBusy(true);
    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => { if (key !== 'confirm_password') payload.append(key, value); });
      Object.entries(files).forEach(([key, value]) => { if (value) payload.append(key, value); });
      const { data } = await api.post('/auth/register', payload, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 });
      setDone(data);
      toast.success('Customer account created');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  if (done) return <AuthShell title="Registration completed" subtitle="Your documents are now waiting for administrative review.">
    <div className="success-panel">
      <FileCheck2 size={38} />
      <h3>{done.email_sent ? 'Verification email sent' : 'Account created'}</h3>
      <p>{done.message}</p>
      {done.warning && <div className="warning-box">{done.warning}</div>}
      {done.dev_verification_url && <a className="button button-full" href={done.dev_verification_url}>Open development verification link</a>}
      <Link to="/login" className="text-link">Return to login</Link>
    </div>
  </AuthShell>;

  return <AuthShell title="Create customer account" subtitle="Register your identity, contact details and verification documents.">
    <form onSubmit={submit} className="form-stack compact registration-form">
      <div className="form-section-title"><UserRound /><div><strong>Personal information</strong><small>Details used to identify and contact you</small></div></div>
      <div className="form-grid">
        <label className="field"><span>Full name</span><input name="full_name" value={form.full_name} onChange={change} required /></label>
        <label className="field"><span>NIC number</span><input name="nic" value={form.nic} onChange={change} required /></label>
        <label className="field"><span>Email address</span><input name="email" type="email" value={form.email} onChange={change} required /></label>
        <label className="field"><span>Phone number</span><input name="phone" value={form.phone} onChange={change} required /></label>
        <label className="field field-wide"><span>Residential address</span><input name="address_line1" value={form.address_line1} onChange={change} required /></label>
        <label className="field"><span>City</span><input name="city" value={form.city} onChange={change} required /></label>
        <label className="field"><span>Service area</span><select name="area_id" value={form.area_id} onChange={change} required><option value="">Select area</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}, {area.district}</option>)}</select></label>
        <label className="field"><span>Occupation</span><input name="occupation" value={form.occupation} onChange={change} /></label>
        <label className="field"><span>Monthly income (LKR)</span><input name="monthly_income" type="number" min="0" value={form.monthly_income} onChange={change} /></label>
      </div>

      <div className="form-section-title"><ShieldCheck /><div><strong>Identity and residence documents</strong><small>PDF, JPG, PNG or WEBP, maximum 5 MB each</small></div></div>
      <div className="upload-grid">
        <label className="file-field required"><span>NIC front</span><input type="file" name="nic_front" accept="image/*,.pdf" onChange={fileChange} required /><small>{files.nic_front?.name || 'Required'}</small></label>
        <label className="file-field required"><span>NIC back</span><input type="file" name="nic_back" accept="image/*,.pdf" onChange={fileChange} required /><small>{files.nic_back?.name || 'Required'}</small></label>
        <label className="file-field required"><span>Residence confirmation</span><input type="file" name="residence_proof" accept="image/*,.pdf" onChange={fileChange} required /><small>{files.residence_proof?.name || 'Utility bill / GN certificate'}</small></label>
        <label className="file-field"><span>Income proof</span><input type="file" name="income_proof" accept="image/*,.pdf" onChange={fileChange} /><small>{files.income_proof?.name || 'Optional salary slip / bank record'}</small></label>
      </div>

      <div className="form-section-title"><ShieldCheck /><div><strong>Secure password</strong><small>Use uppercase, lowercase and a number</small></div></div>
      <div className="form-grid">
        <PasswordField value={form.password} onChange={change} autoComplete="new-password" />
        <PasswordField label="Confirm password" name="confirm_password" value={form.confirm_password} onChange={change} autoComplete="new-password" />
      </div>
      <p className="password-help">Your account must be verified by email before you can sign in.</p>
      <button className="button button-full" disabled={busy}>{busy ? 'Creating secure account...' : 'Create customer account'}</button>
      <p className="form-foot">Already registered? <Link to="/login">Sign in</Link></p>
    </form>
  </AuthShell>;
}
