import { useCallback, useEffect, useState } from 'react';
import toast, { promptValue } from '../utils/sweetAlert';
import api, { errorMessage } from '../api/client';
import StatusBadge from './StatusBadge';
import PrivateFileButton from './PrivateFileButton';

function ReviewActions({ source, document, onDone }) {
  const review = async (decision) => {
    const needsNote = decision !== 'ACCEPTED';
    const labels = {
      ACCEPTED: ['Accept document', 'Add an optional review note'],
      REJECTED: ['Reject document', 'Enter the reason the document is being rejected'],
      REUPLOAD_REQUIRED: ['Request re-upload', 'Explain what the customer or agent must correct'],
    };
    const note = await promptValue({
      title: labels[decision][0],
      text: labels[decision][1],
      input: 'textarea',
      required: needsNote,
      validationMessage: 'A review reason is required.',
      confirmButtonText: decision === 'ACCEPTED' ? 'Accept' : 'Save decision',
      icon: decision === 'ACCEPTED' ? 'success' : 'warning',
      inputAttributes: { maxlength: '1000' },
    });
    if (note === null) return;

    try {
      await api.patch(`/documents/${source}/${document.id}/review`, { decision, note: note || '' });
      toast.success('Document review saved');
      await onDone();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return <div className="record-actions compact-actions">
    <button className="button button-sm" type="button" onClick={() => review('ACCEPTED')}>Accept</button>
    <button className="button button-sm button-danger-outline" type="button" onClick={() => review('REJECTED')}>Reject</button>
    <button className="button button-sm button-warning" type="button" onClick={() => review('REUPLOAD_REQUIRED')}>Request re-upload</button>
  </div>;
}

function DocumentCard({ document, source, admin, onDone }) {
  return <article className="document-card">
    <div className="document-card-head"><div><small>{document.document_type?.replaceAll('_', ' ')}</small><strong>{document.title}</strong><span>{document.original_name}</span></div><StatusBadge value={document.status} /></div>
    {document.review_note && <p className="review-note"><b>Review note:</b> {document.review_note}</p>}
    <div className="record-actions"><PrivateFileButton url={document.file_url} /><PrivateFileButton url={document.file_url} label="Download" download /></div>
    {admin && <ReviewActions source={source} document={document} onDone={onDone} />}
  </article>;
}

export default function DocumentReviewPanel({ applicationId, admin = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(`/documents/application/${applicationId}`);
      setData(response.data?.data || null);
    } catch (error) {
      setData(null);
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="page-loader small"><span className="spinner" /></div>;
  if (!data) return <p className="muted-copy">Document information is unavailable.</p>;

  const summary = data.summary || {};
  const customerDocuments = Array.isArray(data.customer_documents) ? data.customer_documents : [];
  const fieldDocuments = Array.isArray(data.field_documents) ? data.field_documents : [];

  return <div className="document-review-panel">
    <div className="document-summary-grid">
      <article><small>Customer documents</small><strong>{summary.customer_accepted || 0}/{summary.customer_total || 0} accepted</strong></article>
      <article><small>Required customer set</small><strong>{summary.required_customer_accepted ? 'Ready' : 'Incomplete'}</strong></article>
      <article><small>Field evidence</small><strong>{summary.field_accepted || 0}/{summary.field_total || 0} accepted</strong></article>
      <article><small>Approval evidence</small><strong>{summary.field_ready ? 'Ready' : 'Incomplete'}</strong></article>
    </div>
    <h3 className="subheading">Customer-submitted documents</h3>
    <div className="document-grid">{customerDocuments.length ? customerDocuments.map((document) => <DocumentCard key={`c-${document.id}`} document={document} source="customer" admin={admin} onDone={load} />) : <p className="muted-copy">No customer documents uploaded yet.</p>}</div>
    <h3 className="subheading">Agent evidence</h3>
    <div className="document-grid">{fieldDocuments.length ? fieldDocuments.map((document) => <DocumentCard key={`f-${document.id}`} document={document} source="field" admin={admin} onDone={load} />) : <p className="muted-copy">No field evidence uploaded yet.</p>}</div>
  </div>;
}
