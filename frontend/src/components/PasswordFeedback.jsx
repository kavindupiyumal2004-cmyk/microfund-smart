import { CheckCircle2, Circle, XCircle } from 'lucide-react';
import { passwordStrength } from '../utils/passwordStrength';

export default function PasswordFeedback({ password, confirmation }) {
  const { rules, level, label } = passwordStrength(password);
  const matches = password.length > 0 && password === confirmation;
  return <div className="password-feedback">
    <div className="password-strength-heading"><strong>Password strength</strong><span className={`password-level level-${level}`} role="status" aria-live="polite">{label}</span></div>
    <div className={`password-strength-meter level-${level}`} aria-hidden="true">{[1, 2, 3, 4].map((segment) => <span key={segment} className={segment <= level ? 'filled' : ''} />)}</div>
    <ul className="password-rules">{rules.map(({ label: rule, met }) => <li key={rule} className={met ? 'met' : ''}>{met ? <CheckCircle2 size={15} aria-hidden="true" /> : <Circle size={15} aria-hidden="true" />}<span>{rule}</span></li>)}</ul>
    <small className="password-strength-hint">Strength is an estimate. Use a long, unique password; avoid common words and sequences.</small>
    <div className={`password-match ${confirmation ? matches ? 'matches' : 'mismatch' : ''}`} role="status" aria-live="polite">
      {confirmation ? matches ? <CheckCircle2 size={17} aria-hidden="true" /> : <XCircle size={17} aria-hidden="true" /> : <Circle size={17} aria-hidden="true" />}
      <span>{!confirmation ? 'Re-enter your password to check the match.' : matches ? 'Passwords match' : 'Passwords do not match'}</span>
    </div>
  </div>;
}
