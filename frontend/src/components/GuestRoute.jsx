import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function GuestRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loader" role="status" aria-label="Checking your session"><span className="spinner" /></div>;
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
}
