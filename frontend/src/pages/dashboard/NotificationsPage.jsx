import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck, CreditCard, FileCheck2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../../api/client';
import EmptyState from '../../components/EmptyState';
import toast from '../../utils/sweetAlert';

const iconFor = (type = '') => {
  const value = String(type).toUpperCase();
  if (value.includes('PAYMENT')) return CreditCard;
  if (value.includes('DOCUMENT') || value.includes('APPLICATION')) return FileCheck2;
  if (value.includes('SECURITY') || value.includes('VERIFY')) return ShieldCheck;
  return Bell;
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await api.get('/notifications', { params: { limit: 100 } });
      const nextItems = Array.isArray(response.data?.data) ? response.data.data : [];
      setItems(nextItems);
      setUnread(Number(response.data?.unread || 0));
    } catch (error) {
      const message = errorMessage(error, 'Unable to load notifications.');
      setItems([]);
      setUnread(0);
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markAllRead = async () => {
    if (!unread) return;
    try {
      await api.patch('/notifications/read-all');
      const readAt = new Date().toISOString();
      setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at || readAt })));
      setUnread(0);
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const openNotification = async (item) => {
    try {
      if (!item.read_at) {
        await api.patch(`/notifications/${item.id}/read`);
        const readAt = new Date().toISOString();
        setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: readAt } : entry));
        setUnread((count) => Math.max(0, count - 1));
      }
      if (item.link && item.link.startsWith('/')) navigate(item.link);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return <>
    <div className="page-title">
      <div><span className="eyebrow">Updates</span><h1>Notifications</h1><p>Important events related to your account and assigned work.</p></div>
      <div className="notification-page-actions">
        <span className="notification-count-chip">{unread} unread</span>
        <button className="button button-light" type="button" disabled={!unread || loading} onClick={markAllRead}><CheckCheck size={17} />Mark all read</button>
      </div>
    </div>

    <section className="panel notification-page-panel">
      {loading ? <div className="page-loader small"><span className="spinner" /></div>
        : loadError ? <div className="notification-error-state"><Bell size={34} /><h3>Notifications could not be loaded</h3><p>{loadError}</p><button className="button button-sm" type="button" onClick={load}><RefreshCw size={16} />Try again</button></div>
          : items.length ? <div className="notification-page-list">{items.map((item) => {
            const Icon = iconFor(item.type);
            return <button key={item.id} type="button" className={item.read_at ? 'notice-row' : 'notice-row unread'} onClick={() => openNotification(item)}>
              <span className={`notice-icon notice-${String(item.type || 'info').toLowerCase()}`}><Icon size={19} /></span>
              <div className="notice-content"><div className="notice-title-line"><strong>{item.title}</strong>{!item.read_at && <i>New</i>}</div><p>{item.message}</p><small>{item.created_at ? new Date(item.created_at).toLocaleString() : 'Just now'}</small></div>
            </button>;
          })}</div>
            : <EmptyState title="No notifications" text="New application, visit, approval and payment events will appear here." />}
    </section>
  </>;
}
