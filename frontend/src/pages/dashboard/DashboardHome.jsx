import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  MapPinned,
  TrendingUp,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import EmptyState from '../../components/EmptyState';

const icons = {
  file: FileText,
  map: MapPinned,
  wallet: WalletCards,
  alert: AlertTriangle,
  cash: Banknote,
  chart: TrendingUp,
  clock: Clock3,
  check: CheckCircle2,
  users: UsersRound,
};

const roleCopy = {
  OWNER: ['Executive overview', 'Monitor the full MicroFund portfolio, collections and operations.'],
  MANAGER: ['Operations overview', 'Review the loan pipeline, repayments and day-to-day team activity.'],
  AGENT: ['Field activity', 'Stay on top of assigned visits, verifications and collection follow-ups.'],
  CASHIER: ['Payments overview', 'Process repayments, review payment slips and track collections.'],
  CUSTOMER: ['My loan journey', 'Track your applications, active loans, documents and repayments.'],
};

function formatMoney(value) {
  return `LKR ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default function DashboardHome() {
  const { user } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/dashboard/summary').then((response) => setData(response.data.data));
  }, []);

  const today = useMemo(() => new Intl.DateTimeFormat('en-LK', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  }).format(new Date()), []);

  if (!data) return <div className="page-loader small"><span className="spinner" /></div>;

  const [sectionLabel, subtitle] = roleCopy[user.role] || roleCopy.CUSTOMER;

  return <>
    <div className="page-title premium-page-title">
      <div>
        <span className="eyebrow">{sectionLabel}</span>
        <h1>Dashboard</h1>
        <p>{subtitle}</p>
      </div>
      <div className="dashboard-date-card">
        <span><CalendarDays size={19} /></span>
        <div><small>Today</small><strong>{today}</strong></div>
      </div>
    </div>

    <div className={`metric-grid role-${user.role.toLowerCase()}`}>
      {data.cards.map((card, index) => {
        const Icon = icons[card.icon] || FileText;
        return <article className="metric-card" key={`${card.label}-${index}`}>
          <span className={`metric-icon tone-${index % 6}`}><Icon size={22} /></span>
          <div className="metric-copy">
            <small>{card.label}</small>
            <strong>{card.money ? formatMoney(card.value) : Number(card.value ?? 0).toLocaleString()}</strong>
          </div>
          <span className="metric-corner" />
        </article>;
      })}
    </div>

    <section className="panel premium-activity-panel">
      <div className="panel-head">
        <div className="panel-title-with-icon">
          <span><FileText size={18} /></span>
          <div><h2>Recent activity</h2><p>Latest records from your workspace</p></div>
        </div>
        <span className="soft-badge">Live workspace</span>
      </div>
      {data.recent?.length
        ? <div className="simple-list premium-simple-list">
          {data.recent.map((item, index) => <div className="simple-item" key={item.id || index}>
            <span className="number-chip">{String(index + 1).padStart(2, '0')}</span>
            <div>
              <strong>{item.application_no || item.receipt_no || item.LoanApplication?.application_no || `Record #${item.id}`}</strong>
              <small>{item.status || item.Customer?.full_name || item.LoanApplication?.Customer?.full_name || new Date(item.created_at || item.paid_at || item.scheduled_at).toLocaleString()}</small>
            </div>
            <span className="activity-dot" />
          </div>)}
        </div>
        : <EmptyState />}
    </section>
  </>;
}
