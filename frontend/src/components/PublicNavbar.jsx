import ThemeToggle from './ThemeToggle';
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, Landmark, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
export default function PublicNavbar() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  return <header className="public-nav"><div className="container nav-inner"><Link to="/" className="brand"><span className="brand-icon"><Landmark size={22} /></span><span>MicroFund</span></Link><ThemeToggle /><button className="mobile-menu" onClick={() => setOpen((v) => !v)}>{open ? <X /> : <Menu />}</button><nav className={open ? 'open' : ''}><a href="/#about">About</a><a href="/#services">Services</a><a href="/#process">How it works</a><a href="/#contact">Contact</a>{loading ? <span role="status">Checking session…</span> : user ? <NavLink to="/dashboard" className="button button-sm"><LayoutDashboard size={18} /> Dashboard</NavLink> : <><NavLink to="/login" className="nav-login">Login</NavLink><NavLink to="/register" className="button button-sm">Open account</NavLink></>}</nav></div></header>;
}
