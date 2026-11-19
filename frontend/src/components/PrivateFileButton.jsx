import { Download, Eye } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from '../utils/sweetAlert';
import api, { errorMessage } from '../api/client';

function FilePreview({ file, onClose }) {
  const dialog = useRef(null);
  const [src, setSrc] = useState('');
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file.blob);
    setSrc(objectUrl);
    dialog.current.showModal();
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return <dialog className="file-preview" ref={dialog} onClose={onClose} aria-label="Document preview">
    <header><strong>{file.name}</strong><button type="button" className="button button-light" onClick={() => dialog.current.close()}>Close</button></header>
    {src && (file.blob.type === 'application/pdf'
      ? <iframe src={src} title={file.name} />
      : <img src={src} alt={file.name} />)}
  </dialog>;
}

export default function PrivateFileButton({ url, label = 'Preview', download = false, className = 'button button-sm button-light' }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const open = async () => {
    setLoading(true);
    try {
      const response = await api.get(url, { params: { download }, responseType: 'blob' });
      const encoded = response.headers['content-disposition']?.match(/filename\*=UTF-8''(.+)$/i)?.[1];
      const name = encoded ? decodeURIComponent(encoded) : 'Document';
      if (download) {
        const blobUrl = URL.createObjectURL(response.data);
        const anchor = document.createElement('a');
        anchor.href = blobUrl;
        anchor.download = name;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
      } else {
        if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(response.data.type)) {
          throw new Error('Preview is unavailable for this file type. Use Download to open it.');
        }
        setFile({ blob: response.data, name });
      }
    } catch (error) {
      const body = error.response?.data;
      const detail = body instanceof Blob ? await body.text().then(JSON.parse).catch(() => null) : null;
      toast.error(detail?.error?.message || errorMessage(error, 'Unable to open the file.'));
    } finally {
      setLoading(false);
    }
  };
  const Icon = download ? Download : Eye;
  return <><button type="button" className={className} disabled={loading || !url} onClick={open}><Icon size={15} />{loading ? 'Loading…' : label}</button>
    {file && <FilePreview file={file} onClose={() => setFile(null)} />}</>;
}
