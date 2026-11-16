import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, UserRound } from 'lucide-react';
import toast, { Swal } from '../../utils/sweetAlert';
import { useAuth } from '../../contexts/AuthContext';
import api, { errorMessage } from '../../api/client';
import PasswordField from '../../components/PasswordField';
import PasswordFeedback from '../../components/PasswordFeedback';
import { passwordStrength } from '../../utils/passwordStrength';
import AuthShell from './AuthShell';

const initial = { full_name: '', email: '', password: '', confirm_password: '', nic: '', phone: '', address_line1: '', city: '', area_id: '', occupation: '', monthly_income: '' };

export default function RegisterPage() {
  const [form, setForm] = useState(initial);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [areas, setAreas] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/public/areas').then((response) => setAreas(response.data.data)).catch(() => toast.error('Unable to load service areas.')); }, []);
  const change = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    if (!passwordStrength(form.password).valid) return toast.error('Use at least 8 characters with uppercase, lowercase and a number.');
    if (form.password !== form.confirm_password) return toast.error('Passwords do not match.');
    setBusy(true);
    try {
      const { confirm_password, ...payload } = form;
      const { data } = await api.post('/auth/register', payload);
      const result = await Swal.fire({
        icon: 'success',
        title: 'Your account is ready',
        text: 'Upload your NIC front, NIC back and proof of residence before applying for a loan. You can do this now or later from the Documents tab.',
        confirmButtonText: 'Upload documents',
        cancelButtonText: 'Later, go to dashboard',
        showCancelButton: true,
        allowOutsideClick: false,
        customClass: { popup: 'microfund-swal-popup', confirmButton: 'microfund-swal-confirm', cancelButton: 'microfund-swal-cancel' },
      });
      login(data.token, data.user);
      navigate(result.isConfirmed ? '/dashboard/documents' : '/dashboard', { replace: true });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return <AuthShell wide title="Create customer account" subtitle="Create your account first. You can upload documents after registration.">
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

      <div className="form-section-title"><ShieldCheck /><div><strong>Secure password</strong><small>Use uppercase, lowercase and a number</small></div></div>
      <div className="form-grid">
        <PasswordField value={form.password} onChange={change} autoComplete="new-password" />
        <PasswordField label="Confirm password" name="confirm_password" value={form.confirm_password} onChange={change} autoComplete="new-password" />
      </div>
      <PasswordFeedback password={form.password} confirmation={form.confirm_password} />
      <p className="password-help">No documents needed to register. Upload them later from your dashboard.</p>
      <button className="button button-full" disabled={busy}>{busy ? 'Creating secure account...' : 'Create customer account'}</button>
      <p className="form-foot">Already registered? <Link to="/login">Sign in</Link></p>
    </form>
  </AuthShell>;
}
