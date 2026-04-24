import React from 'react';

export default function MediaViewer({ media, onClose }) {
  if (!media) {
    return null;
  }

  const isImage = media.type === 'image';

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div className="glass-panel" style={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <h3 style={{ margin: 0 }}>{media.name || 'Attachment Preview'}</h3>
            <p style={styles.subtle}>{isImage ? 'Image preview' : 'File attachment'}</p>
          </div>
          <button type="button" style={styles.closeButton} onClick={onClose}>
            Close
          </button>
        </div>

        <div style={styles.content}>
          {isImage ? (
            <img src={media.src} alt={media.name || 'attachment'} style={styles.image} />
          ) : (
            <div style={styles.fileCard}>
              <p style={{ marginBottom: '10px' }}>This attachment is ready to download.</p>
              <a href={media.src} download={media.name} className="btn-primary" style={styles.downloadLink}>
                Download File
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    zIndex: 1200,
  },
  modal: {
    width: '100%',
    maxWidth: '960px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    padding: '18px 20px',
    borderBottom: '1px solid var(--glass-border)',
  },
  subtle: {
    margin: '4px 0 0 0',
    color: 'var(--text-muted)',
    fontSize: '0.82rem',
  },
  closeButton: {
    border: '1px solid var(--glass-border)',
    background: 'transparent',
    color: 'var(--text-light)',
    padding: '10px 14px',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  content: {
    padding: '20px',
    overflow: 'auto',
    display: 'grid',
    placeItems: 'center',
  },
  image: {
    width: '100%',
    maxWidth: '860px',
    maxHeight: '72vh',
    objectFit: 'contain',
    borderRadius: '12px',
  },
  fileCard: {
    textAlign: 'center',
    padding: '32px',
  },
  downloadLink: {
    display: 'inline-flex',
    textDecoration: 'none',
  },
};
