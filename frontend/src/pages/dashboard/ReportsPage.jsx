import { useEffect, useMemo, useState } from 'react';
import { Download, Eye, FileSpreadsheet, Palette } from 'lucide-react';
import toast from '../../utils/sweetAlert';
import api, { errorMessage } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';

export default function ReportsPage() {
  const [catalog, setCatalog] = useState({});
  const [type, setType] = useState('loans');
  const [title, setTitle] = useState('');
  const [columns, setColumns] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: '', role: '', method: '', date_from: '', date_to: '' });
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get('/reports/catalog').then((response) => { setCatalog(response.data.data); const first = response.data.data.loans; setColumns(first.defaults); setTitle(first.title); }).catch((error) => toast.error(errorMessage(error))); }, []);
  const definition = catalog[type];
  const changeType = (next) => { setType(next); setColumns(catalog[next]?.defaults || []); setTitle(catalog[next]?.title || ''); setPreview(null); setFilters({ search: '', status: '', role: '', method: '', date_from: '', date_to: '' }); };
  const toggleColumn = (column) => setColumns((current) => current.includes(column) ? current.filter((item) => item !== column) : [...current, column]);
  const payload = useMemo(() => ({ type, title, columns, filters: Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) }), [type, title, columns, filters]);

  const generatePreview = async () => {
    if (!columns.length) return toast.error('Select at least one column.');
    setBusy(true);
    try { const response = await api.post('/reports/preview', payload); setPreview(response.data.data); toast.success('Report preview generated'); } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };
  const exportReport = async (format) => {
    if (!columns.length) return toast.error('Select at least one column.');
    setBusy(true);
    try {
      const response = await api.post('/reports/export', { ...payload, format }, { responseType: 'blob', timeout: 120000 });
      const contentDisposition = response.headers['content-disposition'] || '';
      const filename = contentDisposition.match(/filename="(.+)"/)?.[1] || `microfund_report.${format}`;
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} downloaded`);
    } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };

  return <>
    <div className="page-title"><div><span className="eyebrow">Report builder</span><h1>Preview, select columns and export</h1><p>Build a colourful full-page web report before downloading a professionally formatted PDF or CSV.</p></div></div>
    <div className="report-builder-grid">
      <aside className="panel report-controls"><div className="panel-head"><div><h2>1. Report settings</h2><p>Choose data, filters and visible columns.</p></div></div><div className="form-stack"><label className="field"><span>Report type</span><select value={type} onChange={(event) => changeType(event.target.value)}>{Object.entries(catalog).map(([key, value]) => <option key={key} value={key}>{value.title}</option>)}</select></label><label className="field"><span>Report title</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label><div className="form-grid"><label className="field"><span>From date</span><input type="date" value={filters.date_from} onChange={(event) => setFilters({ ...filters, date_from: event.target.value })} /></label><label className="field"><span>To date</span><input type="date" value={filters.date_to} onChange={(event) => setFilters({ ...filters, date_to: event.target.value })} /></label></div><label className="field"><span>Search</span><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Name, loan, application, reference..." /></label>{['loans', 'applications', 'payment_submissions', 'collections'].includes(type) && <label className="field"><span>Status</span><input value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value.toUpperCase() })} placeholder="e.g. ACTIVE / APPROVED" /></label>}{type === 'users' && <><label className="field"><span>Role</span><select value={filters.role} onChange={(event) => setFilters({ ...filters, role: event.target.value })}><option value="">All roles</option><option>OWNER</option><option>MANAGER</option><option>CASHIER</option><option>AGENT</option><option>CUSTOMER</option></select></label><label className="field"><span>Account status</span><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label></>}{type === 'payments' && <label className="field"><span>Payment method</span><select value={filters.method} onChange={(event) => setFilters({ ...filters, method: event.target.value })}><option value="">All methods</option><option>CASH</option><option>BANK_TRANSFER</option><option>CARD</option><option>OTHER</option></select></label>}<div><span className="field-label">Columns included in the report</span><div className="column-picker">{definition && Object.entries(definition.columns).map(([key, label]) => <label key={key} className={columns.includes(key) ? 'column-option selected' : 'column-option'}><input type="checkbox" checked={columns.includes(key)} onChange={() => toggleColumn(key)} /><span>{label}</span></label>)}</div></div><div className="report-action-stack"><button className="button" onClick={generatePreview} disabled={busy}><Eye size={17} />{busy ? 'Working...' : 'Generate web preview'}</button><button className="button button-secondary" onClick={() => exportReport('pdf')} disabled={busy}><Download size={17} />Download PDF</button><button className="button button-light" onClick={() => exportReport('csv')} disabled={busy}><FileSpreadsheet size={17} />Download CSV</button></div></div></aside>
      <main className="report-preview-area">{preview ? <section className="web-report"><header className="web-report-header"><div><div className="report-brand"><Palette />MicroFund</div><h2>{preview.title}</h2><p>Generated {new Date().toLocaleString()} · {preview.rows.length} records</p></div><span>Operational Report</span></header><div className="web-report-summary">{preview.summary.map((item) => <article key={item.label}><small>{item.label}</small><strong>{item.value}</strong></article>)}</div><div className="web-report-filters"><b>Applied filters:</b> {Object.entries(preview.filters).length ? Object.entries(preview.filters).map(([key, value]) => `${key.replaceAll('_', ' ')}: ${value}`).join(' · ') : 'No filters'}</div><div className="table-wrap report-preview-table"><table><thead><tr>{preview.columns.map((column) => <th key={column}>{preview.labels[column]}</th>)}</tr></thead><tbody>{preview.rows.map((row, index) => <tr key={index}>{preview.columns.map((column) => <td key={column}>{column.includes('status') ? <StatusBadge value={row[column]} /> : row[column]}</td>)}</tr>)}</tbody></table></div><footer className="web-report-footer"><span>MicroFund Smart Microfinance System</span><span>Preview before PDF export</span></footer></section> : <section className="panel report-empty-preview"><Palette size={52} /><h2>Your report preview will appear here</h2><p>Select the columns and filters, then click “Generate web preview”. The downloaded PDF uses a matching full-page coloured layout.</p></section>}</main>
    </div>
  </>;
}
