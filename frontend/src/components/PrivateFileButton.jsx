import { Download, Eye } from 'lucide-react';
import toast from '../utils/sweetAlert';
import api, { errorMessage } from '../api/client';

export default function PrivateFileButton({ url, label = 'Preview', download = false, className = 'button button-sm button-light' }) {
  const open = async () => {
    try {
      const response = await api.get(`${url}${url.includes('?') ? '&' : '?'}download=${download}`, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(response.data);
      if (download) {
        const anchor = document.createElement('a');
        anchor.href = blobUrl;
        anchor.download = label || 'document';
        anchor.click();
      } else {
        window.open(blobUrl, '_blank', 'noopener,noreferrer');
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
    } catch (error) {
      toast.error(errorMessage(error, 'Unable to open the file.'));
    }
  };
  const Icon = download ? Download : Eye;
  return <button type="button" className={className} onClick={open}><Icon size={15} />{label}</button>;
}
