import { repaymentFrequency } from '../../utils/repaymentFrequency';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';

export default function MyLoansPage() {
  const [data, setData] = useState([]);
  useEffect(() => { api.get('/applications/my-loans').then((response) => setData(response.data.data)); }, []);
  return <>
    <div className="page-title"><div><span className="eyebrow">Repayment tracking</span><h1>My loans</h1><p>See balances, installment dates and accepted payment history.</p></div><Link className="button" to="/dashboard/payment-slips">Upload payment slip</Link></div>
    {data.length ? data.map((loan) => <section className="panel loan-panel" key={loan.id}><div className="record-top"><div><small>Loan number</small><h2>{loan.loan_no}</h2><p>{loan.LoanApplication?.LoanType?.name}</p></div><StatusBadge value={loan.status} /></div><div className="metric-grid compact-metrics"><article><small>Principal</small><strong>LKR {Number(loan.principal).toLocaleString()}</strong></article><article><small>Total payable</small><strong>LKR {Number(loan.total_payable).toLocaleString()}</strong></article><article><small>Remaining balance</small><strong>LKR {Number(loan.remaining_balance).toLocaleString()}</strong></article><article><small>{repaymentFrequency(loan.principal, loan.repayment_frequency) === 'MONTHLY' ? 'Monthly' : 'Weekly'} installment</small><strong>LKR {Number(loan.monthly_installment).toLocaleString()}</strong></article></div><div className="loan-policy-note"><strong>{repaymentFrequency(loan.principal, loan.repayment_frequency) === 'MONTHLY' ? 'Monthly repayment' : 'Weekly repayment'}</strong><span> · Late payments become overdue, but no extra late-payment interest is added.</span></div><div className="table-wrap"><table><thead><tr><th>#</th><th>Due date</th><th>Amount due</th><th>Paid</th><th>Outstanding</th><th>Status</th></tr></thead><tbody>{loan.Schedules?.map((schedule) => <tr key={schedule.id}><td>{schedule.installment_no}</td><td>{new Date(`${schedule.due_date}T00:00:00`).toLocaleDateString()}</td><td>LKR {Number(schedule.amount_due).toLocaleString()}</td><td>LKR {Number(schedule.amount_paid).toLocaleString()}</td><td>LKR {(Number(schedule.amount_due) - Number(schedule.amount_paid)).toLocaleString()}</td><td><StatusBadge value={schedule.status} /></td></tr>)}</tbody></table></div></section>) : <section className="panel"><EmptyState title="No loans yet" text="Approved loans and repayment schedules will appear here." /></section>}
  </>;
}
