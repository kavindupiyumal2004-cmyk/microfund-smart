import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import PasswordField from '../../components/PasswordField';
import PasswordFeedback from '../../components/PasswordFeedback';
import { passwordStrength } from '../../utils/passwordStrength';
import toast from '../../utils/sweetAlert';

export default function AccountSecurityPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ current_password: '', password: '', confirmation: '' });
  const [busy, setBusy] = useState(false);
  const change = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!passwordStrength(form.password).valid || new TextEncoder().encode(form.password).length > 72) return toast.error('Use at least 8 characters with uppercase, lowercase and a number (maximum 72 bytes).');
    if (form.password !== form.confirmation) return toast.error('Passwords do not match.');
    if (form.password === form.current_password) return toast.error('Choose a different new password.');
    setBusy(true);
    try {
      await api.post('/auth/change-password', { current_password: form.current_password, password: form.password });
      logout();
      toast.success('Password changed. Please sign in with your new password.');
      navigate('/login', { replace: true });
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(false); }
  };
  return <>
    <div className="page-title"><div><h1>Account security</h1><p>Manage the password you use to sign in.</p></div></div>
    <section className="panel" style={{ maxWidth: 560 }}>
      <div className="panel-head"><div><h2>Change password</h2><p>Use a password only you know. After saving, sign in again on each device.</p></div></div>
      <form className="form-stack" onSubmit={submit}>
        <PasswordField label="Current password" name="current_password" value={form.current_password} onChange={change} />
        <PasswordField label="New password" value={form.password} onChange={change} autoComplete="new-password" />
        <PasswordField label="Confirm new password" name="confirmation" value={form.confirmation} onChange={change} autoComplete="new-password" />
        <PasswordFeedback password={form.password} confirmation={form.confirmation} />
        <button className="button" disabled={busy}>{busy ? 'Saving...' : 'Change password'}</button>
      </form>
    </section>
  </>;
}
