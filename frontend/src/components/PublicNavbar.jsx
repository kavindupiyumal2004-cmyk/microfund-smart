import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, Landmark } from 'lucide-react';
export default function PublicNavbar() {
  const [open, setOpen] = useState(false);
  return <header className="public-nav"><div className="container nav-inner"><Link to="/" className="brand"><span className="brand-icon"><Landmark size={22} /></span><span>MicroFund</span></Link><button className="mobile-menu" onClick={() => setOpen((v) => !v)}>{open ? <X /> : <Menu />}</button><nav className={open ? 'open' : ''}><a href="/#about">About</a><a href="/#services">Services</a><a href="/#process">How it works</a><a href="/#contact">Contact</a><NavLink to="/login" className="nav-login">Login</NavLink><NavLink to="/register" className="button button-sm">Open account</NavLink></nav></div></header>;
}
