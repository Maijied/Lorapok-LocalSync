import React, { useState, useEffect } from 'react';

export default function LinkPreview({ url }) {
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const host = window.location.hostname;
        const response = await fetch(`http://${host}:4000/api/link-preview?url=${encodeURIComponent(url)}`);
        const data = await response.json();
        setMetadata(data);
      } catch (error) {
        console.error('Link preview failed:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, [url]);

  if (loading) return <div style={styles.loading}>Loading preview...</div>;
  if (!metadata || (!metadata.title && !metadata.image)) return null;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={styles.container}>
      {metadata.image && (
        <div style={styles.imageContainer}>
          <img src={metadata.image} alt="preview" style={styles.image} />
        </div>
      )}
      <div style={styles.info}>
        <h4 style={styles.title}>{metadata.title}</h4>
        {metadata.description && <p style={styles.description}>{metadata.description}</p>}
        <span style={styles.url}>{new URL(url).hostname}</span>
      </div>
    </a>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
    overflow: 'hidden',
    marginTop: '8px',
    textDecoration: 'none',
    color: 'inherit',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    maxWidth: '300px',
  },
  imageContainer: {
    width: '100%',
    height: '150px',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  info: {
    padding: '12px',
  },
  title: {
    margin: '0 0 4px 0',
    fontSize: '0.9rem',
    fontWeight: '700',
    color: 'var(--primary-color)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  description: {
    margin: 0,
    fontSize: '0.75rem',
    opacity: 0.7,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  url: {
    fontSize: '0.7rem',
    opacity: 0.5,
    marginTop: '4px',
    display: 'block',
  },
  loading: {
    fontSize: '0.7rem',
    opacity: 0.5,
    marginTop: '4px',
    fontStyle: 'italic',
  }
};
