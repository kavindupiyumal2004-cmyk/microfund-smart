import ThemeToggle from '../../components/ThemeToggle';
import { Link } from 'react-router-dom';
import { Landmark, ShieldCheck, Sparkles } from 'lucide-react';
export default function AuthShell({ title, subtitle, children }) {
  return <div className="auth-page"><div className="auth-brand-panel"><Link to="/" className="brand light-brand"><span className="brand-icon"><Landmark /></span><span>MicroFund</span></Link><div><span className="hero-pill dark-pill"><Sparkles size={16} /> MicroFund loan management</span><h1>Your loans. One place to manage them.</h1><p>Track applications, field visits, approvals and repayments in one reliable platform.</p><ul><li><ShieldCheck /> Password-protected accounts</li><li><ShieldCheck /> Role-based dashboards</li><li><ShieldCheck /> Live notifications and audit history</li></ul></div><small>MicroFund | Loan management, from application to repayment</small></div><div className="auth-form-panel"><div className="auth-theme-control"><ThemeToggle /></div><div className="auth-card"><div className="auth-heading"><h2>{title}</h2><p>{subtitle}</p></div>{children}</div></div></div>;
}
