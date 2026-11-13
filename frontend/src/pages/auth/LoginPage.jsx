import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from '../../utils/sweetAlert';
import api, { errorMessage } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import PasswordField from '../../components/PasswordField';
import AuthShell from './AuthShell';

export default function LoginPage() {
  const [form,setForm]=useState({email:'',password:''}); const [busy,setBusy]=useState(false); const {login}=useAuth(); const navigate=useNavigate(); const location=useLocation();
  const change=(e)=>setForm({...form,[e.target.name]:e.target.value});
  const submit=async(e)=>{e.preventDefault();setBusy(true);try{const {data}=await api.post('/auth/login',form);login(data.token,data.user);toast.success('Welcome back');navigate(location.state?.from || '/dashboard');}catch(err){toast.error(errorMessage(err));}finally{setBusy(false);}};
  return <AuthShell title="Welcome back" subtitle="Sign in to access your secure dashboard."><form onSubmit={submit} className="form-stack"><label className="field"><span>Email address</span><input name="email" type="email" value={form.email} onChange={change} placeholder="name@example.com" required autoComplete="email" /></label><PasswordField value={form.password} onChange={change} /><div className="form-row-between"><label className="check-line"><input type="checkbox" /> Remember me</label><Link to="/forgot-password">Forgot password?</Link></div><button className="button button-full" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button><p className="form-foot">New customer? <Link to="/register">Create an account</Link><br/><Link to="/resend-verification">Resend verification email</Link></p></form></AuthShell>;
}
