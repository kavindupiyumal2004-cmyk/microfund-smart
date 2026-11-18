import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from '../../utils/sweetAlert';
import api, { errorMessage } from '../../api/client';
import AuthShell from './AuthShell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await api.post('/auth/forgot-password', { email }, { timeout: 45000 });
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter the email address registered to your account.">
      <form onSubmit={submit} className="form-stack">
        <label className="field">
          <span>Email address</span>
          <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <button className="button button-full" disabled={busy}>
          {busy ? 'Requesting...' : 'Request reset link'}
        </button>
        <p className="form-foot">If no link arrives, check your spam folder or contact your manager.</p>
        <p className="form-foot"><Link to="/login">Back to login</Link></p>
      </form>
    </AuthShell>
  );
}
