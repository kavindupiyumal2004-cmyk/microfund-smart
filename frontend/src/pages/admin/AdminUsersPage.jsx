import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, UserCheck, UserRound, UsersRound, WalletCards } from 'lucide-react';
import toast from '../../utils/sweetAlert';
import api, { errorMessage } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../contexts/AuthContext';

const categories = [
  ['ALL', 'All users', UsersRound], ['CUSTOMER', 'Customers', UserRound], ['AGENT', 'Agents', UserCheck],
  ['CASHIER', 'Cashiers', WalletCards], ['MANAGER', 'Managers', ShieldCheck], ['OWNER', 'Owner', ShieldCheck], ['PENDING_VERIFICATION', 'Pending verification', ShieldCheck], ['INACTIVE', 'Inactive', UsersRound],
];

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const readOnly = currentUser.role === 'OWNER';
  const [summary, setSummary] = useState({});
  const [users, setUsers] = useState([]);
  const [areas, setAreas] = useState([]);
  const [category, setCategory] = useState('ALL');
  const [filters, setFilters] = useState({ search: '', area_id: '', status: '', verification: '' });
  const [form, setForm] = useState({ full_name: '', email: '', password: 'Password@123', role: 'AGENT', area_ids: [], branch_name: '', max_pending_reviews: 50 });
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });

  const loadSummary = () => api.get('/admin/user-summary').then((response) => setSummary(response.data.data));
  const loadUsers = (page = 1) => api.get('/admin/users', { params: { category: category === 'ALL' ? '' : category, ...filters, page, limit: 20 } }).then((response) => { setUsers(response.data.data); setPagination(response.data.pagination); });
  const load = () => Promise.all([loadSummary(), loadUsers(), api.get('/admin/areas').then((response) => setAreas(response.data.data))]);
  useEffect(() => { load().catch((error) => toast.error(errorMessage(error))); }, []);
  useEffect(() => { loadUsers().catch((error) => toast.error(errorMessage(error))); }, [category]);

  const createStaff = async (event) => {
    event.preventDefault();
    try {
      await api.post('/admin/users', { ...form, area_ids: form.area_ids.map(Number), max_pending_reviews: Number(form.max_pending_reviews) });
      toast.success('Staff account created');
      setForm({ full_name: '', email: '', password: 'Password@123', role: 'AGENT', area_ids: [], branch_name: '', max_pending_reviews: 50 });
      await load();
    } catch (error) { toast.error(errorMessage(error)); }
  };

  const toggle = async (user) => {
    try { await api.patch(`/admin/users/${user.id}/status`, { is_active: !user.is_active }); toast.success('Account status updated'); await load(); } catch (error) { toast.error(errorMessage(error)); }
  };

  return <>
    <div className="page-title"><div><span className="eyebrow">{readOnly ? 'Owner monitoring' : 'Manager operations'}</span><h1>User management</h1><p>{readOnly ? 'View staff and customer details in read-only mode.' : 'Manage staff accounts and browse registered customers.'}</p></div></div>
    <div className="category-grid">{categories.map(([key, label, Icon]) => <button key={key} className={category === key ? 'category-card active' : 'category-card'} onClick={() => setCategory(key)}><Icon size={21} /><span>{label}</span><strong>{summary[key] ?? 0}</strong></button>)}</div>
    <div className={readOnly ? "admin-users-layout owner-readonly-layout" : "two-column admin-users-layout"}>
      {!readOnly && <section className="panel staff-form-panel"><div className="panel-head"><div><h2>Create staff account</h2><p>Customers register through the public website.</p></div></div><form onSubmit={createStaff} className="form-stack"><label className="field"><span>Full name</span><input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} required /></label><label className="field"><span>Email</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label><label className="field"><span>Temporary password</span><input value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /></label><label className="field"><span>Role</span><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option>AGENT</option><option>CASHIER</option><option>MANAGER</option></select></label>{form.role === 'AGENT' && <label className="field"><span>Service areas</span><select multiple value={form.area_ids} onChange={(event) => setForm({ ...form, area_ids: Array.from(event.target.selectedOptions, (option) => option.value) })}>{areas.filter((area) => area.is_active).map((area) => <option key={area.id} value={area.id}>{area.name}, {area.district}</option>)}</select><small>Hold Ctrl to select multiple areas.</small></label>}{form.role === 'CASHIER' && <><label className="field"><span>Branch / location</span><input value={form.branch_name} onChange={(event) => setForm({ ...form, branch_name: event.target.value })} /></label><label className="field"><span>Maximum pending slip reviews</span><input type="number" min="1" max="500" value={form.max_pending_reviews} onChange={(event) => setForm({ ...form, max_pending_reviews: event.target.value })} /></label></>}<button className="button">Create staff account</button></form></section>}
      <section className="panel users-table-panel"><div className="panel-head"><div><h2>{categories.find(([key]) => key === category)?.[1]}</h2><p>Search by name, email, NIC, phone or area.</p></div></div><div className="filter-grid user-filter-grid"><input placeholder="Search users" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /><select value={filters.area_id} onChange={(event) => setFilters({ ...filters, area_id: event.target.value })}><option value="">All areas</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All account states</option><option value="active">Active</option><option value="inactive">Inactive</option></select><select value={filters.verification} onChange={(event) => setFilters({ ...filters, verification: event.target.value })}><option value="">Any verification</option><option value="verified">Email verified</option><option value="unverified">Email unverified</option></select><button className="button button-sm" onClick={() => loadUsers()}>Apply filters</button></div><div className="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Contact / area</th><th>Verification</th><th>Documents</th><th>Account</th><th>Actions</th></tr></thead><tbody>{users.map((user) => { const accepted = ['NIC_FRONT', 'NIC_BACK', 'RESIDENCE_PROOF'].every((type) => user.CustomerDocuments?.some((doc) => doc.document_type === type && doc.status === 'ACCEPTED')); return <tr key={user.id}><td><strong>{user.full_name}</strong><small className="table-subtext">{user.email}</small></td><td>{user.Role?.name?.replaceAll('_', ' ')}</td><td>{user.CustomerProfile ? <>{user.CustomerProfile.phone}<small className="table-subtext">{user.CustomerProfile.Area?.name}</small></> : user.CashierProfile?.branch_name || user.ServiceAreas?.map((area) => area.name).join(', ') || '-'}</td><td><StatusBadge value={user.email_verified_at ? 'VERIFIED' : 'UNVERIFIED'} /></td><td>{user.Role?.name === 'CUSTOMER' ? <StatusBadge value={accepted ? 'ACCEPTED' : user.CustomerDocuments?.length ? 'PENDING' : 'MISSING'} /> : '-'}</td><td><StatusBadge value={user.is_active ? 'ACTIVE' : 'INACTIVE'} /></td><td><div className="record-actions"><Link className="button button-sm button-light" to={`/dashboard/users/${user.id}`}>View details</Link>{!readOnly && user.Role?.name !== 'OWNER' && <button className={user.is_active ? 'button button-sm button-danger-outline' : 'button button-sm'} onClick={() => toggle(user)}>{user.is_active ? 'Deactivate' : 'Activate'}</button>}</div></td></tr>; })}</tbody></table></div>{pagination.pages > 1 && <div className="pagination"><button disabled={pagination.page <= 1} onClick={() => loadUsers(pagination.page - 1)}>Previous</button><span>Page {pagination.page} of {pagination.pages}</span><button disabled={pagination.page >= pagination.pages} onClick={() => loadUsers(pagination.page + 1)}>Next</button></div>}</section>
    </div>
  </>;
}
