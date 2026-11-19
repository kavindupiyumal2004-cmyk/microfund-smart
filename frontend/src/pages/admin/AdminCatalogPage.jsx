import { useEffect, useRef, useState } from 'react';
import toast from '../../utils/sweetAlert';
import api, { errorMessage } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminCatalogPage() {
  const { user } = useAuth();
  const readOnly = user.role === 'OWNER';
  const [areas, setAreas] = useState([]);
  const [types, setTypes] = useState([]);
  const [area, setArea] = useState({ name: '', district: '', province: '' });
  const [type, setType] = useState({ name: '', description: '', min_amount: '', max_amount: '', annual_interest_rate: '', duration_months: '' });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const typeForm = useRef(null);
  const resetType = () => {
    setEditingId(null);
    setType({ name: '', description: '', min_amount: '', max_amount: '', annual_interest_rate: '', duration_months: '' });
  };
  const editType = (product) => {
    setEditingId(product.id);
    setType(Object.fromEntries(['name', 'description', 'min_amount', 'max_amount', 'annual_interest_rate', 'duration_months'].map((key) => [key, product[key] ?? ''])));
    typeForm.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    typeForm.current?.querySelector('input')?.focus({ preventScroll: true });
  };
  const load = () => Promise.all([api.get('/admin/areas'), api.get('/admin/loan-types')]).then(([a, t]) => { setAreas(a.data.data); setTypes(t.data.data); });
  useEffect(() => { load().catch((error) => toast.error(errorMessage(error))); }, []);
  const addArea = async (event) => { event.preventDefault(); try { await api.post('/admin/areas', area); setArea({ name: '', district: '', province: '' }); await load(); toast.success('Area added'); } catch (error) { toast.error(errorMessage(error)); } };
  const saveType = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (Number(type.max_amount) < Number(type.min_amount)) return toast.error('Maximum amount must be at least the minimum amount.');
    setSaving(true);
    const editing = editingId !== null;
    try {
      const payload = { ...type, name: type.name.trim(), min_amount: Number(type.min_amount), max_amount: Number(type.max_amount), annual_interest_rate: Number(type.annual_interest_rate), duration_months: Number(type.duration_months) };
      const { data } = editing ? await api.put('/admin/loan-types/' + editingId, payload) : await api.post('/admin/loan-types', payload);
      setTypes((current) => (editing ? current.map((item) => item.id === editingId ? data.data : item) : [...current, data.data]).sort((a, b) => a.name.localeCompare(b.name)));
      resetType();
      toast.success(editing ? 'Loan type updated' : 'Loan type added');
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSaving(false); }
  };
  return <><div className="page-title"><div><span className="eyebrow">{readOnly ? 'Owner monitoring' : 'Manager configuration'}</span><h1>Areas and loan products</h1><p>{readOnly ? 'View the current service coverage and loan product rules.' : 'Manage agent service areas and the loan products customers can apply for.'}</p></div></div><div className="two-column"><section className="panel"><div className="panel-head"><h2>Service areas</h2></div>{!readOnly && <form className="form-stack inline-form" onSubmit={addArea}><input placeholder="Area" value={area.name} onChange={(e)=>setArea({...area,name:e.target.value})} required/><input placeholder="District" value={area.district} onChange={(e)=>setArea({...area,district:e.target.value})} required/><input placeholder="Province" value={area.province} onChange={(e)=>setArea({...area,province:e.target.value})} required/><button className="button button-sm">Add area</button></form>}<div className="simple-list">{areas.map((a)=><div className="simple-item" key={a.id}><div><strong>{a.name}</strong><small>{a.district}, {a.province}</small></div><span className={a.is_active?'status status-active':'status status-cancelled'}>{a.is_active?'Active':'Inactive'}</span></div>)}</div></section><section className="panel"><div className="panel-head"><h2>Loan products</h2></div>{!readOnly && <form ref={typeForm} className="form-stack" onSubmit={saveType}><strong>{editingId !== null ? 'Edit loan product' : 'Add loan product'}</strong><fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><div className="form-grid"><label className="field"><span>Name</span><input maxLength={120} value={type.name} onChange={(e)=>setType({...type,name:e.target.value})} required/></label><label className="field"><span>Maximum term (months)</span><input type="number" min="1" max="120" step="1" value={type.duration_months} onChange={(e)=>setType({...type,duration_months:e.target.value})} required/></label><label className="field"><span>Minimum</span><input type="number" min="1" step="0.01" value={type.min_amount} onChange={(e)=>setType({...type,min_amount:e.target.value})} required/></label><label className="field"><span>Maximum</span><input type="number" min="1" step="0.01" value={type.max_amount} onChange={(e)=>setType({...type,max_amount:e.target.value})} required/></label><label className="field"><span>Interest rate %</span><input type="number" min="0" max="9999.99" step="0.01" value={type.annual_interest_rate} onChange={(e)=>setType({...type,annual_interest_rate:e.target.value})} required/></label><label className="field field-wide"><span>Description</span><textarea value={type.description} onChange={(e)=>setType({...type,description:e.target.value})}/></label></div><div className="record-actions"><button className="button button-sm" disabled={saving}>{saving ? 'Saving...' : editingId !== null ? 'Save changes' : 'Add loan product'}</button>{editingId !== null && <button type="button" className="button button-sm button-light" onClick={resetType}>Cancel</button>}</div></fieldset></form>}<div className="simple-list">{types.map((t)=><div className="simple-item" key={t.id}><div><strong>{t.name}</strong><small>LKR {Number(t.min_amount).toLocaleString()} – {Number(t.max_amount).toLocaleString()} · {t.annual_interest_rate}% · up to {t.duration_months} months</small></div><span className={t.is_active?'status status-active':'status status-cancelled'}>{t.is_active?'Active':'Inactive'}</span>{!readOnly && <button type="button" className="button button-sm button-light" disabled={saving} onClick={() => editType(t)} aria-label={'Edit ' + t.name}>Edit</button>}</div>)}</div></section></div></>;
}
