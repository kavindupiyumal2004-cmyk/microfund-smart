import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b1220' : '#ffffff');
  }, [theme]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const systemChange = () => {
      try { if (localStorage.getItem('microfund_theme')) return; } catch { /* Storage may be blocked. */ }
      setTheme(media.matches ? 'dark' : 'light');
    };
    const storageChange = (event) => {
      if (event.key === 'microfund_theme') setTheme(event.newValue === 'dark' || event.newValue === 'light' ? event.newValue : media.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', systemChange);
    window.addEventListener('storage', storageChange);
    return () => { media.removeEventListener('change', systemChange); window.removeEventListener('storage', storageChange); };
  }, []);
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('microfund_theme', next); } catch { /* The theme still works for this visit. */ }
    setTheme(next);
  };
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
