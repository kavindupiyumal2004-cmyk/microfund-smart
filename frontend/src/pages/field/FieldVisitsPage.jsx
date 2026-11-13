import { useEffect, useState } from 'react';
import { FileUp, X } from 'lucide-react';
import toast from '../../utils/sweetAlert';
import api, { errorMessage } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import PrivateFileButton from '../../components/PrivateFileButton';
import DocumentReviewPanel from '../../components/DocumentReviewPanel';

const reportInitial = { residence_verified: false, income_verified: false, business_verified: false, documents_verified: false, guarantor_verified: false, recommendation: 'APPROVE', comments: '' };
const evidenceInitial = { document_type: 'RESIDENCE_PHOTO', title: '', file: null };

export default function FieldVisitsPage() {
  const [data, setData] = useState([]);
  const [active, setActive] = useState(null);
  const [report, setReport] = useState(reportInitial);
  const [evidence, setEvidence] = useState(evidenceInitial);
  const [busy, setBusy] = useState(false);
  const load = () => api.get('/field/visits').then((response) => setData(response.data.data));
  useEffect(() => { load().catch((error) => toast.error(errorMessage(error))); }, []);

  const submitReport = async (event) => {
    event.preventDefault();
    setBusy(true);
    try { await api.post(`/field/visits/${active.id}/report`, report); toast.success('Verification report submitted'); setReport(reportInitial); setActive(null); await load(); } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };
  const uploadEvidence = async (event) => {
    event.preventDefault();
    if (!evidence.file) return toast.error('Select a file.');
    setBusy(true);
    try {
      const payload = new FormData();
      payload.append('document', evidence.file);
      payload.append('document_type', evidence.document_type);
      payload.append('title', evidence.title || evidence.document_type.replaceAll('_', ' '));
      await api.post(`/documents/field/visit/${active.id}`, payload, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Field evidence uploaded separately');
      setEvidence(evidenceInitial);
      await load();
      const updated = (await api.get('/field/visits')).data.data.find((visit) => visit.id === active.id);
      setActive(updated || active);
    } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };

  return <>
    <div className="page-title"><div><span className="eyebrow">Agent</span><h1>Assigned field visits</h1><p>View customer documents, upload each field evidence item and submit the verification report.</p></div></div>
    <section className="panel">{data.length ? <div className="card-list">{data.map((visit) => <article className="record-card" key={visit.id}><div className="record-top"><div><small>{visit.LoanApplication?.application_no}</small><h3>{visit.LoanApplication?.Customer?.full_name}</h3><p>{visit.LoanApplication?.Customer?.CustomerProfile?.phone} · {visit.LoanApplication?.Customer?.CustomerProfile?.address_line1}</p></div><StatusBadge value={visit.status} /></div><div className="record-grid"><p><span>Scheduled</span>{new Date(visit.scheduled_at).toLocaleString()}</p><p><span>Area</span>{visit.LoanApplication?.Area?.name}</p><p><span>Requested</span>LKR {Number(visit.LoanApplication?.requested_amount).toLocaleString()}</p><p><span>Priority</span>{visit.priority}</p><p><span>Evidence uploaded</span>{visit.FieldDocuments?.length || 0}</p><p className="wide"><span>Purpose</span>{visit.LoanApplication?.purpose}</p></div><div className="record-actions"><button className="button button-sm" onClick={() => setActive(visit)}>{visit.status === 'COMPLETED' ? 'View visit file' : 'Open verification workspace'}</button>{visit.status === 'SCHEDULED' && <button className="button button-sm button-light" onClick={async () => { try { await api.patch(`/field/visits/${visit.id}/status`, { status: 'IN_PROGRESS' }); toast.success('Visit started'); await load(); } catch (error) { toast.error(errorMessage(error)); } }}>Start visit</button>}</div>{visit.VerificationReport && <div className="verification-summary"><strong>Report submitted: {visit.VerificationReport.recommendation}</strong><p>{visit.VerificationReport.comments}</p></div>}</article>)}</div> : <EmptyState title="No visits assigned" text="New scheduled visits will appear here and trigger a notification." />}</section>
    {active && <div className="modal-backdrop"><div className="modal modal-wide"><div className="modal-head"><div><span className="eyebrow">Field verification workspace</span><h2>{active.LoanApplication?.Customer?.full_name}</h2><p>{active.LoanApplication?.application_no}</p></div><button onClick={() => setActive(null)}><X /></button></div><div className="workspace-grid"><section><h3 className="subheading">Customer uploaded documents</h3><DocumentReviewPanel applicationId={active.LoanApplication.id} /></section><section><h3 className="subheading">Upload field evidence separately</h3><form onSubmit={uploadEvidence} className="form-stack evidence-form"><label className="field"><span>Evidence type</span><select value={evidence.document_type} onChange={(event) => setEvidence({ ...evidence, document_type: event.target.value })}><option>RESIDENCE_PHOTO</option><option>BUSINESS_PHOTO</option><option>INCOME_EVIDENCE</option><option>SIGNED_FORM</option><option>VISIT_REPORT</option><option>OTHER</option></select></label><label className="field"><span>Title</span><input value={evidence.title} onChange={(event) => setEvidence({ ...evidence, title: event.target.value })} placeholder="Optional title" /></label><label className="file-field"><FileUp /><span>Select evidence</span><input type="file" accept="image/*,.pdf" onChange={(event) => setEvidence({ ...evidence, file: event.target.files?.[0] || null })} /><small>{evidence.file?.name || 'PDF, JPG, PNG or WEBP'}</small></label><button className="button button-sm" disabled={busy}>Upload evidence</button></form><div className="document-grid single-column field-evidence-list">{active.FieldDocuments?.map((document) => <article className="document-card" key={document.id}><div className="document-card-head"><div><small>{document.document_type.replaceAll('_', ' ')}</small><strong>{document.title}</strong></div><StatusBadge value={document.status} /></div>{document.review_note && <p className="review-note">{document.review_note}</p>}<PrivateFileButton url={`/files/field-document/${document.id}`} /></article>)}</div></section></div>{!active.VerificationReport && <section className="verification-form-section"><h3 className="subheading">Final verification report</h3><form onSubmit={submitReport} className="form-stack"><div className="check-grid">{[['residence_verified', 'Residence verified'], ['income_verified', 'Income verified'], ['business_verified', 'Business verified'], ['documents_verified', 'Documents verified'], ['guarantor_verified', 'Guarantor verified']].map(([key, label]) => <label className="check-card" key={key}><input type="checkbox" checked={report[key]} onChange={(event) => setReport({ ...report, [key]: event.target.checked })} /><span>{label}</span></label>)}</div><label className="field"><span>Recommendation</span><select value={report.recommendation} onChange={(event) => setReport({ ...report, recommendation: event.target.value })}><option>APPROVE</option><option>REJECT</option><option>REVIEW_AGAIN</option></select></label><label className="field"><span>Detailed comments</span><textarea minLength="10" rows="5" value={report.comments} onChange={(event) => setReport({ ...report, comments: event.target.value })} required /></label><button className="button" disabled={busy}>{busy ? 'Submitting...' : 'Submit final verification report'}</button></form></section>}</div></div>}
  </>;
}
