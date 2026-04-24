import React from 'react';

export default function TypingIndicator({ label }) {
  if (!label) {
    return null;
  }

  return (
    <div style={styles.container}>
      <span style={styles.label}>{label}</span>
      <span style={styles.wave}>
        <span style={{ ...styles.dot, animationDelay: '0ms' }} />
        <span style={{ ...styles.dot, animationDelay: '150ms' }} />
        <span style={{ ...styles.dot, animationDelay: '300ms' }} />
      </span>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: 'var(--text-muted)',
    fontSize: '0.82rem',
    padding: '0 4px',
  },
  label: {
    whiteSpace: 'nowrap',
  },
  wave: {
    display: 'inline-flex',
    gap: '4px',
    alignItems: 'center',
  },
  dot: {
    width: '6px',
    height: '6px',
    borderRadius: '999px',
    backgroundColor: 'var(--primary-color)',
    animation: 'typingWave 900ms infinite ease-in-out',
  },
};
