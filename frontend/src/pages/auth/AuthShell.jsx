import ThemeToggle from '../../components/ThemeToggle';
import { Link } from 'react-router-dom';
import { Landmark, ArrowLeft } from 'lucide-react';
export default function AuthShell({ title, subtitle, children, wide = false }) {
  return <div className="auth-page auth-centered">
    <header className="auth-topbar">
      <div className="auth-topbar-inner">
        <Link to="/" className="brand" aria-label="MicroFund home"><span className="brand-icon"><Landmark /></span><span>MicroFund</span></Link>
        <nav className="auth-topbar-actions" aria-label="Account navigation">
          <Link to="/" className="auth-home-link"><ArrowLeft size={16} /> Home</Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
    <main className="auth-form-panel">
      <section className={`auth-card${wide ? ' auth-card-wide' : ''}`} aria-labelledby="auth-title">
        <div className="auth-heading"><h1 id="auth-title">{title}</h1><p>{subtitle}</p></div>
        {children}
      </section>
    </main>
  </div>;
}
