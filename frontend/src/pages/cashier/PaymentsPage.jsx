import { repaymentFrequency } from '../../utils/repaymentFrequency';
import { useState } from 'react';
import toast from '../../utils/sweetAlert';
import api, { errorMessage } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../contexts/AuthContext';

export default function PaymentsPage() {
  const { user } = useAuth();
  const readOnly = user.role === 'OWNER';
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loan, setLoan] = useState(null);
  const [form, setForm] = useState({ amount: '', method: 'CASH', paid_at: new Date().toISOString().slice(0, 16), notes: '' });
  const search = async (event) => {
    event?.preventDefault();
    try {
      const { data } = await api.get('/payments/search', { params: { query } });
      setResults(data.data);
      if (data.data.length === 1) selectLoan(data.data[0]);
      else setLoan(null);
    } catch (error) { setResults([]); setLoan(null); toast.error(errorMessage(error)); }
  };
  const selectLoan = async (item) => {
    try {
      const { data } = await api.get(`/payments/loan-detail/${item.id}`);
      const selected = data.data;
      setLoan(selected);
      const next = selected.Schedules?.find((schedule) => schedule.status !== 'PAID');
      setForm({ ...form, amount: next ? (Number(next.amount_due) - Number(next.amount_paid)).toFixed(2) : '' });
    } catch (error) { toast.error(errorMessage(error)); }
  };
  const submit = async (event) => {
    event.preventDefault();
    try {
      const { data } = await api.post('/payments', { loan_id: loan.id, amount: Number(form.amount), method: form.method, paid_at: new Date(form.paid_at).toISOString(), notes: form.notes });
      toast.success(`Payment recorded: ${data.data.receipt_no}`);
      await selectLoan(loan);
    } catch (error) { toast.error(errorMessage(error)); }
  };
  return <>
    <div className="page-title"><div><span className="eyebrow">{readOnly ? 'Owner monitoring' : user.role === 'MANAGER' ? 'Manager operations' : 'Cashier'}</span><h1>{readOnly ? 'Loan and payment details' : 'Office installment payments'}</h1><p>Search by loan number, application number, customer name, NIC, phone or email.</p></div></div>
    <form className="search-panel" onSubmit={search}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Loan no., customer name, NIC, phone, email or application no." required /><button className="button">Search loans</button></form>
    {results.length > 1 && <section className="panel"><div className="panel-head"><div><h2>Matching loans</h2><p>Select the correct customer loan.</p></div></div><div className="table-wrap"><table><thead><tr><th>Loan</th><th>Customer</th><th>NIC / phone</th><th>Application</th><th>Balance</th><th>Status</th><th></th></tr></thead><tbody>{results.map((item) => <tr key={item.id}><td>{item.loan_no}</td><td>{item.Customer?.full_name}<small className="table-subtext">{item.Customer?.email}</small></td><td>{item.Customer?.CustomerProfile?.nic}<small className="table-subtext">{item.Customer?.CustomerProfile?.phone}</small></td><td>{item.LoanApplication?.application_no}</td><td>LKR {Number(item.remaining_balance).toLocaleString()}</td><td><StatusBadge value={item.status} /></td><td><button className="button button-sm" onClick={() => selectLoan(item)}>Select</button></td></tr>)}</tbody></table></div></section>}
    {loan && <div className="two-column payment-columns"><section className="panel"><div className="record-top"><div><small>Selected loan</small><h2>{loan.loan_no}</h2><p>{loan.Customer?.full_name} · {loan.Customer?.CustomerProfile?.nic} · {loan.Customer?.CustomerProfile?.phone}</p></div><StatusBadge value={loan.status} /></div><div className="metric-grid compact-metrics"><article><small>Remaining</small><strong>LKR {Number(loan.remaining_balance).toLocaleString()}</strong></article><article><small>{repaymentFrequency(loan.principal, loan.repayment_frequency) === 'MONTHLY' ? 'Monthly' : 'Weekly'} installment</small><strong>LKR {Number(loan.monthly_installment).toLocaleString()}</strong></article></div><div className="table-wrap short-table" tabIndex={0} role="region" aria-label="Repayment schedule"><table><thead><tr><th>#</th><th>Due</th><th>Outstanding</th><th>Status</th></tr></thead><tbody>{loan.Schedules?.map((schedule) => <tr key={schedule.id}><td>{schedule.installment_no}</td><td>{schedule.due_date}</td><td>LKR {(Number(schedule.amount_due) - Number(schedule.amount_paid)).toLocaleString()}</td><td><StatusBadge value={schedule.status} /></td></tr>)}</tbody></table></div></section>{!readOnly && <section className="panel"><div className="panel-head"><h2>Payment details</h2></div><form onSubmit={submit} className="form-stack"><label className="field"><span>Amount (LKR)</span><input type="number" step="0.01" min="0.01" max={loan.remaining_balance} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required /></label><label className="field"><span>Payment method</span><select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}><option>CASH</option><option>BANK_TRANSFER</option><option>CARD</option><option>OTHER</option></select></label><label className="field"><span>Paid at</span><input type="datetime-local" value={form.paid_at} onChange={(event) => setForm({ ...form, paid_at: event.target.value })} required /></label><label className="field"><span>Notes</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><button className="button">Record office payment</button></form></section>}</div>}
  </>;
}
