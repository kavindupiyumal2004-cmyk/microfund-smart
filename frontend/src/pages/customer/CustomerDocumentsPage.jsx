import { useEffect, useState } from 'react';
import { FileCheck2, UploadCloud } from 'lucide-react';
import toast from '../../utils/sweetAlert';
import api, { errorMessage } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import PrivateFileButton from '../../components/PrivateFileButton';

const types = [
  ['NIC_FRONT', 'NIC front'], ['NIC_BACK', 'NIC back'], ['RESIDENCE_PROOF', 'Residence confirmation'],
  ['INCOME_PROOF', 'Income proof'], ['OTHER', 'Other supporting document'],
];

export default function CustomerDocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [form, setForm] = useState({ type: 'NIC_FRONT', title: '', file: null });
  const [busy, setBusy] = useState(false);
  const load = () => Promise.all([api.get('/documents/customer/mine'), api.get('/documents/customer/readiness')]).then(([docs, ready]) => { setDocuments(docs.data.data); setReadiness(ready.data.data); });
  useEffect(() => { load().catch((error) => toast.error(errorMessage(error))); }, []);
  const upload = async (event) => {
    event.preventDefault();
    if (!form.file) return toast.error('Select a document.');
    setBusy(true);
    try {
      const payload = new FormData();
      payload.append('document', form.file);
      payload.append('title', form.title || types.find(([value]) => value === form.type)?.[1] || form.type);
      await api.post(`/documents/customer/${form.type}/reupload`, payload, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Document uploaded for review');
      setForm({ type: form.type, title: '', file: null });
      await load();
    } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };
  return <>
    <div className="page-title"><div><span className="eyebrow">Identity verification</span><h1>My documents</h1><p>Track every document separately and replace rejected files.</p></div></div>
    {readiness && <div className="metric-grid compact-metrics document-readiness">{readiness.required.map((item) => <article key={item.type}><small>{item.type.replaceAll('_', ' ')}</small><strong><StatusBadge value={item.status} /></strong></article>)}</div>}
    <div className="two-column">
      <section className="panel"><div className="panel-head"><div><h2>Current documents</h2><p>Manager reviews each file independently.</p></div></div><div className="document-grid single-column">{documents.map((document) => <article className="document-card" key={document.id}><div className="document-card-head"><div><small>{document.document_type.replaceAll('_', ' ')}</small><strong>{document.title}</strong><span>{document.original_name} · version {document.version}</span></div><StatusBadge value={document.status} /></div>{document.review_note && <p className="review-note"><b>Manager note:</b> {document.review_note}</p>}<div className="record-actions"><PrivateFileButton url={document.file_url} /><PrivateFileButton url={document.file_url} label="Download" download /></div></article>)}</div></section>
      <section className="panel"><div className="panel-head"><div><h2>Upload or replace</h2><p>Re-upload creates a new version without deleting the audit history.</p></div></div><form onSubmit={upload} className="form-stack"><label className="field"><span>Document type</span><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{types.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="field"><span>Document title</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Optional custom title" /></label><label className="file-field"><UploadCloud /><span>Select document</span><input type="file" accept="image/*,.pdf" onChange={(event) => setForm({ ...form, file: event.target.files?.[0] || null })} /><small>{form.file?.name || 'PDF, JPG, PNG or WEBP'}</small></label><button className="button" disabled={busy}>{busy ? 'Uploading...' : 'Upload for review'}</button></form></section>
    </div>
  </>;
}
