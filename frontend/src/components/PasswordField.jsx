import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
export default function PasswordField({ label = 'Password', name = 'password', value, onChange, required = true, autoComplete = 'current-password', placeholder = 'Enter your password' }) {
  const [visible, setVisible] = useState(false);
  return <label className="field"><span>{label}</span><div className="password-wrap"><input name={name} type={visible ? 'text' : 'password'} value={value} onChange={onChange} required={required} autoComplete={autoComplete} placeholder={placeholder} /><button type="button" className="icon-button" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>;
}
