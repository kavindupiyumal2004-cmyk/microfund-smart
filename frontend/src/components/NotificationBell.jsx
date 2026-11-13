import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { io } from 'socket.io-client';
import { Link } from 'react-router-dom';
import toast from '../utils/sweetAlert';
import api, { errorMessage } from '../api/client';

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  const load = async () => {
    try {
      const { data } = await api.get('/notifications', { params: { limit: 8 } });
      setItems(Array.isArray(data?.data) ? data.data : []);
      setUnread(Number(data?.unread || 0));
    } catch (error) {
      console.warn('Notification preview could not be loaded:', errorMessage(error));
    }
  };

  useEffect(() => {
    load();
    const token = localStorage.getItem('microfund_token');
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('notification:new', (item) => {
      if (!item) return;
      setItems((old) => [item, ...old.filter((entry) => entry.id !== item.id)].slice(0, 8));
      setUnread((count) => count + 1);
      toast.info(item.title || 'New notification');
    });

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    const closeOnOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutside);
    return () => document.removeEventListener('mousedown', closeOnOutside);
  }, []);

  const markAll = async () => {
    try {
      await api.patch('/notifications/read-all');
      const readAt = new Date().toISOString();
      setItems((old) => old.map((item) => ({ ...item, read_at: item.read_at || readAt })));
      setUnread(0);
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const markOne = async (item) => {
    if (item.read_at) return;
    try {
      await api.patch(`/notifications/${item.id}/read`);
      const readAt = new Date().toISOString();
      setItems((old) => old.map((entry) => entry.id === item.id ? { ...entry, read_at: readAt } : entry));
      setUnread((count) => Math.max(0, count - 1));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return <div className="notification-wrap" ref={wrapperRef}>
    <button className="notification-button" type="button" onClick={() => setOpen((value) => !value)} aria-label="Notifications" aria-expanded={open}>
      <Bell size={20} />{unread > 0 && <span>{unread > 99 ? '99+' : unread}</span>}
    </button>
    {open && <div className="notification-popover">
      <div className="popover-head"><div><strong>Notifications</strong><small>{unread} unread</small></div><button type="button" disabled={!unread} onClick={markAll}><CheckCheck size={16} /> Mark all read</button></div>
      <div className="notification-list">{items.length === 0 ? <p className="muted pad">No notifications yet.</p> : items.map((item) => <Link key={item.id} to={item.link || '/dashboard/notifications'} className={item.read_at ? 'notification-item' : 'notification-item unread'} onClick={() => { markOne(item); setOpen(false); }}><strong>{item.title}</strong><span>{item.message}</span><small>{item.created_at ? new Date(item.created_at).toLocaleString() : 'Just now'}</small></Link>)}</div>
      <Link to="/dashboard/notifications" className="view-all" onClick={() => setOpen(false)}>View all notifications</Link>
    </div>}
  </div>;
}
