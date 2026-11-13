import { useEffect, useMemo, useState } from 'react';
import { HandCoins, MessageSquareText, RefreshCw, UserRoundCheck, X } from 'lucide-react';
import api, { errorMessage } from '../../api/client';
import toast, { promptValue, Swal } from '../../utils/sweetAlert';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import { useAuth } from '../../contexts/AuthContext';

const money = (value) => `LKR ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CollectionsPage() {
  const { user } = useAuth();
  const readOnly = user.role === 'OWNER';
  const isManager = user.role === 'MANAGER';
  const isAgent = user.role === 'AGENT';
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [agents, setAgents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({ search: '', status: '', priority: '' });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const requests = [api.get('/collections', { params: filters }), api.get('/collections/summary')];
      if (['OWNER', 'MANAGER'].includes(user.role)) requests.push(api.get('/collections/agents'));
      const [listRes, summaryRes, agentsRes] = await Promise.all(requests);
      setRows(listRes.data.data);
      setSummary(summaryRes.data.data);
      if (agentsRes) setAgents(agentsRes.data.data);
    } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };

  useEffect(() => { load(); }, []);

  const open = async (item) => {
    try { setSelected((await api.get(`/collections/${item.id}`)).data.data); } catch (error) { toast.error(errorMessage(error)); }
  };

  const assign = async (item) => {
    const options = Object.fromEntries(agents.map((agent) => [String(agent.id), `${agent.full_name} — ${agent.email}`]));
    const agentId = await promptValue({ title: 'Assign collection case', text: item.case_no, input: 'select', inputOptions: options, inputValue: item.assigned_agent_id ? String(item.assigned_agent_id) : '', required: true, confirmButtonText: 'Assign agent' });
    if (!agentId) return;
    const note = await promptValue({ title: 'Manager instructions', input: 'textarea', confirmButtonText: 'Save assignment', inputAttributes: { maxlength: '1000' } });
    if (note === null) return;
    try {
      await api.patch(`/collections/${item.id}/assign`, { agent_id: Number(agentId), manager_note: note || '' });
      toast.success('Collection case assigned');
      setSelected(null); await load();
    } catch (error) { toast.error(errorMessage(error)); }
  };

  const addActivity = async (item) => {
    const result = await Swal.fire({
      title: 'Add collection follow-up',
      html: `<div class="microfund-swal-form">
        <label>Action<select id="collection-action" class="swal2-select"><option>CALL</option><option>SMS</option><option>FIELD_VISIT</option><option>NOTE</option><option>PROMISE</option><option>ESCALATION</option></select></label>
        <label class="wide">Follow-up note<textarea id="collection-note" class="swal2-textarea" maxlength="3000" placeholder="What happened during the follow-up?"></textarea></label>
        <label>Promise amount (optional)<input id="collection-promise-amount" class="swal2-input" type="number" min="0" step="0.01"></label>
        <label>Promise date (optional)<input id="collection-promise-date" class="swal2-input" type="date"></label>
        <label>Next follow-up (optional)<input id="collection-next-date" class="swal2-input" type="date"></label>
      </div>`,
      showCancelButton: true,
      confirmButtonText: 'Save follow-up',
      focusConfirm: false,
      preConfirm: () => {
        const action_type = document.getElementById('collection-action')?.value;
        const note = document.getElementById('collection-note')?.value?.trim();
        const promise_amount = document.getElementById('collection-promise-amount')?.value;
        const promise_date = document.getElementById('collection-promise-date')?.value;
        const next_followup_date = document.getElementById('collection-next-date')?.value;
        if (!note || note.length < 2) return Swal.showValidationMessage('Enter a follow-up note.');
        if (action_type === 'PROMISE' && (!promise_amount || !promise_date)) return Swal.showValidationMessage('Promise amount and promise date are required for a promise-to-pay.');
        return { action_type, note, promise_amount: promise_amount ? Number(promise_amount) : undefined, promise_date: promise_date || undefined, next_followup_date: next_followup_date || undefined };
      },
    });
    if (!result.isConfirmed) return;
    try {
      await api.post(`/collections/${item.id}/activities`, result.value);
      toast.success('Follow-up saved');
      setSelected((await api.get(`/collections/${item.id}`)).data.data);
      await load();
    } catch (error) { toast.error(errorMessage(error)); }
  };

  const resolve = async (item) => {
    const note = await promptValue({ title: 'Resolve collection case', text: 'Use this only when the case no longer needs collection follow-up.', input: 'textarea', confirmButtonText: 'Resolve case' });
    if (note === null) return;
    try { await api.post(`/collections/${item.id}/resolve`, { note: note || '' }); toast.success('Case resolved'); setSelected(null); await load(); } catch (error) { toast.error(errorMessage(error)); }
  };

  const metrics = useMemo(() => summary ? [
    ['Open cases', summary.open_cases], ['Overdue amount', money(summary.overdue_amount)], ['Promise to pay', summary.promise_to_pay], ['Escalated', summary.escalated], ['Critical', summary.critical],
  ] : [], [summary]);

  return <>
    <div className="page-title"><div><span className="eyebrow">Collections & arrears</span><h1>{isAgent ? 'My overdue follow-ups' : 'Overdue loan collection control'}</h1><p>{readOnly ? 'Owner view is read-only: monitor overdue accounts, agents and follow-up history.' : isAgent ? 'Record calls, field visits, promises and escalation notes for cases assigned to you.' : 'Monitor overdue installments, assign agents and track recovery activity.'}</p></div><button className="button button-light" onClick={load} disabled={busy}><RefreshCw size={16} />Refresh</button></div>
    <div className="metric-grid">{metrics.map(([label, value]) => <article className="metric-card" key={label}><div><small>{label}</small><strong>{value}</strong></div></article>)}</div>
    <section className="panel filter-panel"><div className="filter-bar"><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Case, loan or customer"/><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{['OPEN','CONTACTED','PROMISE_TO_PAY','ESCALATED','RESOLVED'].map((x)=><option key={x}>{x}</option>)}</select><select value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}><option value="">All priorities</option>{['NORMAL','HIGH','CRITICAL'].map((x)=><option key={x}>{x}</option>)}</select><button className="button button-sm" onClick={load}>Search</button></div></section>
    <section className="panel">{rows.length ? <div className="table-wrap"><table><thead><tr><th>Case</th><th>Customer / loan</th><th>Installment</th><th>Overdue</th><th>Agent</th><th>Priority</th><th>Status</th><th>Next action</th><th></th></tr></thead><tbody>{rows.map((item)=><tr key={item.id}><td><strong>{item.case_no}</strong><small className="table-subtext">{item.days_overdue} days overdue</small></td><td>{item.Customer?.full_name}<small className="table-subtext">{item.Loan?.loan_no}</small></td><td>#{item.Installment?.installment_no}<small className="table-subtext">Due {item.Installment?.due_date}</small></td><td>{money(item.overdue_amount)}</td><td>{item.AssignedAgent?.full_name || 'Unassigned'}</td><td><StatusBadge value={item.priority}/></td><td><StatusBadge value={item.status}/></td><td>{item.promise_date ? `Promise: ${item.promise_date}` : item.next_followup_date || '-'}</td><td><button className="button button-sm button-light" onClick={()=>open(item)}>View</button></td></tr>)}</tbody></table></div> : <EmptyState title="No collection cases" text="Overdue installments will automatically appear here when a due date passes with an unpaid balance."/>}</section>
    {selected && <div className="modal-backdrop"><div className="modal modal-wide"><div className="modal-head"><div><span className="eyebrow">Collection case</span><h2>{selected.case_no}</h2><p>{selected.Customer?.full_name} · {selected.Loan?.loan_no}</p></div><button onClick={()=>setSelected(null)}><X/></button></div><div className="record-grid"><p><span>Overdue amount</span>{money(selected.overdue_amount)}</p><p><span>Days overdue</span>{selected.days_overdue}</p><p><span>Installment</span>#{selected.Installment?.installment_no} · {selected.Installment?.due_date}</p><p><span>Assigned agent</span>{selected.AssignedAgent?.full_name || 'Unassigned'}</p><p><span>Priority</span><StatusBadge value={selected.priority}/></p><p><span>Status</span><StatusBadge value={selected.status}/></p><p><span>Promise</span>{selected.promise_date ? `${money(selected.promise_amount)} by ${selected.promise_date}` : '-'}</p><p><span>Next follow-up</span>{selected.next_followup_date || '-'}</p>{selected.manager_note && <p className="wide"><span>Manager note</span>{selected.manager_note}</p>}</div><div className="message-thread"><h3 className="subheading">Follow-up history</h3>{selected.Activities?.length ? selected.Activities.map((activity)=><div className="message-row" key={activity.id}><strong>{activity.action_type.replaceAll('_',' ')} · {activity.Actor?.full_name}</strong><p>{activity.note}</p>{activity.promise_date && <small>Promise: {money(activity.promise_amount)} by {activity.promise_date}</small>}<small>{new Date(activity.created_at).toLocaleString()}</small></div>) : <p>No follow-up activity yet.</p>}</div><div className="modal-sticky-actions">{isManager && selected.status !== 'RESOLVED' && <button className="button button-light" onClick={()=>assign(selected)}><UserRoundCheck size={15}/>Assign agent</button>}{!readOnly && selected.status !== 'RESOLVED' && (isManager || isAgent) && <button className="button" onClick={()=>addActivity(selected)}><MessageSquareText size={15}/>Add follow-up</button>}{isManager && selected.status !== 'RESOLVED' && <button className="button button-secondary" onClick={()=>resolve(selected)}><HandCoins size={15}/>Resolve case</button>}</div></div></div>}
  </>;
}
