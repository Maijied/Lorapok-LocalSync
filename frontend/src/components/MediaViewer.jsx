import React from 'react';
import { Download, X } from 'lucide-react';

export default function MediaViewer({ fileUrl, fileName, type, onClose }) {
  if (!fileUrl) return null;

  const handleDownload = async (e) => {
    e.stopPropagation();
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName || 'download';
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        a.remove();
      }, 1000);
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.controls}>
        <button 
          onClick={handleDownload}
          style={styles.controlBtn}
        >
          <Download size={24} />
        </button>
        <button 
          onClick={onClose}
          style={styles.controlBtn}
        >
          <X size={24} />
        </button>
      </div>
      
      <div style={styles.content} onClick={e => e.stopPropagation()}>
        {type === 'image' ? (
          <img 
            src={fileUrl} 
            alt={fileName} 
            style={styles.media}
          />
        ) : type === 'video' ? (
          <video 
            src={fileUrl} 
            controls 
            autoPlay 
            style={styles.media}
          />
        ) : (
          <div style={styles.fallback}>
            <p style={{marginBottom: '20px'}}>Preview not available for this format.</p>
            <button onClick={handleDownload} className="btn-primary" style={{border: 'none', cursor: 'pointer'}}>
              Download File
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    backgroundColor: 'rgba(5, 5, 10, 0.85)',
    backdropFilter: 'blur(20px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  controls: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    display: 'flex',
    gap: '15px',
    zIndex: 1001,
  },
  controlBtn: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '50%',
    width: '50px',
    height: '50px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  content: {
    maxWidth: '90%',
    maxHeight: '90%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 50px rgba(0, 0, 0, 0.5)',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    background: 'rgba(0, 0, 0, 0.4)',
  },
  media: {
    maxWidth: '100%',
    maxHeight: '85vh',
    objectFit: 'contain',
    display: 'block',
  },
  fallback: {
    padding: '40px',
    textAlign: 'center',
    color: '#fff',
  }
};
