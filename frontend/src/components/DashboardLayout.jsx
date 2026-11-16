import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  ChevronDown,
  FileCheck2,
  FilePlus2,
  FileText,
  Gauge,
  HandCoins,
  Leaf,
  LogOut,
  MapPinned,
  Menu,
  Receipt,
  Settings,
  UploadCloud,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';
import ThemeToggle from './ThemeToggle';

const menu = {
  OWNER: [
    ['Dashboard', '/dashboard', Gauge],
    ['Applications', '/dashboard/applications', FileCheck2],
    ['Users & Customers', '/dashboard/users', Users],
    ['Payments', '/dashboard/payments', Receipt],
    ['Payment Reviews', '/dashboard/payment-reviews', UploadCloud],
    ['Collections', '/dashboard/collections', HandCoins],
    ['Loan Products', '/dashboard/catalog', Settings],
    ['Reports', '/dashboard/reports', FileText],
    ['Audit Logs', '/dashboard/audit', BookOpen],
  ],
  MANAGER: [
    ['Dashboard', '/dashboard', Gauge],
    ['Applications', '/dashboard/applications', FileCheck2],
    ['Staff & Customers', '/dashboard/users', Users],
    ['Payments', '/dashboard/payments', Receipt],
    ['Payment Reviews', '/dashboard/payment-reviews', UploadCloud],
    ['Collections', '/dashboard/collections', HandCoins],
    ['Areas & Products', '/dashboard/catalog', Settings],
    ['Reports', '/dashboard/reports', FileText],
    ['Audit Logs', '/dashboard/audit', BookOpen],
  ],
  AGENT: [
    ['Dashboard', '/dashboard', Gauge],
    ['My Visits', '/dashboard/visits', MapPinned],
    ['Collections Follow-up', '/dashboard/collections', HandCoins],
  ],
  CASHIER: [
    ['Dashboard', '/dashboard', Gauge],
    ['Receive Payments', '/dashboard/payments', Receipt],
    ['Payment Reviews', '/dashboard/payment-reviews', UploadCloud],
    ['Reports', '/dashboard/reports', FileText],
  ],
  CUSTOMER: [
    ['Dashboard', '/dashboard', Gauge],
    ['Documents', '/dashboard/documents', UploadCloud],
    ['Apply for Loan', '/dashboard/apply', FilePlus2],
    ['My Applications', '/dashboard/my-applications', FileCheck2],
    ['My Loans', '/dashboard/my-loans', WalletCards],
    ['Payments', '/dashboard/payment-slips', UploadCloud],
  ],
};

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobile, setMobile] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const profileButtonRef = useRef(null);

  useEffect(() => {
    if (!profileOpen) return;
    const outside = (event) => { if (!profileRef.current?.contains(event.target)) setProfileOpen(false); };
    const escape = (event) => { if (event.key === 'Escape') { setProfileOpen(false); profileButtonRef.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [profileOpen]);

  useEffect(() => {
    document.body.classList.toggle('dashboard-menu-open', mobile);
    return () => document.body.classList.remove('dashboard-menu-open');
  }, [mobile]);

  const signOut = () => { logout(); navigate('/login'); };
  const roleMenu = menu[user?.role] || [];
  const fullName = user?.full_name || 'MicroFund user';
  const roleLabel = user?.role ? user.role.replaceAll('_', ' ') : 'Account';
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((name) => name[0])
    .join('')
    .toUpperCase() || 'MF';

  return <div className="dashboard-shell">
    <aside className={mobile ? 'sidebar mobile-open' : 'sidebar'} aria-label="Dashboard navigation">
      <div className="sidebar-brand">
        <span className="sidebar-logo-mark"><Leaf size={24} /></span>
        <span className="sidebar-brand-copy"><strong>MicroFund</strong><small>People • Progress • Together</small></span>
        <button type="button" aria-label="Close navigation menu" onClick={() => setMobile(false)}><X /></button>
      </div>

      <nav className="side-menu">
        {roleMenu.map(([label, to, Icon]) => <NavLink key={to} to={to} end={to === '/dashboard'} onClick={() => setMobile(false)}><Icon size={18} /><span>{label}</span></NavLink>)}
        <NavLink to="/dashboard/notifications" onClick={() => setMobile(false)}><Bell size={18} /><span>Notifications</span></NavLink>
      </nav>

      <button type="button" className="logout-button" onClick={signOut}><LogOut size={18} /><span>Sign out</span></button>
    </aside>

    {mobile && <button type="button" className="sidebar-overlay" aria-label="Close navigation menu" onClick={() => setMobile(false)} />}

    <main className="dashboard-main">
      <header className="topbar">
        <button type="button" className="topbar-menu" aria-label="Open navigation menu" aria-expanded={mobile} onClick={() => setMobile(true)}><Menu /></button>

        <div className="topbar-workspace">
          <strong>MicroFund <span className="workspace-badge">Workspace</span></strong>
          <small>Loan management</small>
        </div>

        <div className="topbar-actions">
          <ThemeToggle />
          <NotificationBell />
          <div className="profile-menu-wrap" ref={profileRef} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setProfileOpen(false); }}>
            <button ref={profileButtonRef} type="button" className="topbar-profile" title={fullName} aria-label="Your account" aria-controls="account-panel" aria-expanded={profileOpen} onClick={() => setProfileOpen((value) => !value)}>
              <span className="topbar-avatar">{initials}</span>
              <span className="topbar-profile-copy"><strong>{fullName}</strong><small>{roleLabel.toLowerCase()}</small></span>
              <ChevronDown size={16} className={profileOpen ? 'profile-chevron-open' : ''} />
            </button>
            {profileOpen && <div className="profile-dropdown" id="account-panel" aria-label="Account details">
              <div className="profile-panel-label">Signed in as</div>
              <div className="profile-dropdown-head">
                <span className="topbar-avatar large">{initials}</span>
                <div><strong>{fullName}</strong><small>{user?.email || roleLabel}</small><span>{roleLabel}</span></div>
              </div>
              <button type="button" className="profile-logout" onClick={signOut}><LogOut size={17} /><span>Sign out</span></button>
            </div>}
          </div>
        </div>
      </header>
      <div className="dashboard-content"><Outlet /></div>
    </main>
  </div>;
}
