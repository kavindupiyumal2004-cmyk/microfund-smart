import { Inbox } from 'lucide-react';
export default function EmptyState({ title = 'Nothing here yet', text = 'New information will appear here.' }) { return <div className="empty"><Inbox size={38} /><h3>{title}</h3><p>{text}</p></div>; }
