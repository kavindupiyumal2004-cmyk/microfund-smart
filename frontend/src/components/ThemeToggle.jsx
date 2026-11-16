import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const label = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`;
  return <button type="button" className="theme-toggle" onClick={toggleTheme} title={label} aria-label={label} aria-pressed={theme === 'dark'}>
    {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
  </button>;
}
