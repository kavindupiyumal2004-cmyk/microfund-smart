import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('microfund_token');
    if (!token) { setUser(null); setLoading(false); return; }
    try { const { data } = await api.get('/auth/me'); setUser(data.user); }
    catch { localStorage.removeItem('microfund_token'); setUser(null); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refreshUser(); const logout = () => { setUser(null); setLoading(false); }; window.addEventListener('microfund:logout', logout); return () => window.removeEventListener('microfund:logout', logout); }, [refreshUser]);
  const login = (token, nextUser) => { localStorage.setItem('microfund_token', token); setUser(nextUser); };
  const logout = () => { localStorage.removeItem('microfund_token'); setUser(null); };
  const value = useMemo(() => ({ user, loading, login, logout, refreshUser }), [user, loading, refreshUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
