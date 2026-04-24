import React from 'react';

const TypingIndicator = () => {
  return (
    <div style={styles.bubble}>
      <div style={styles.dotContainer}>
        <div style={{...styles.dot, animationDelay: '0ms'}}></div>
        <div style={{...styles.dot, animationDelay: '150ms'}}></div>
        <div style={{...styles.dot, animationDelay: '300ms'}}></div>
      </div>
    </div>
  );
};

const styles = {
  bubble: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--glass-border)',
    borderRadius: '16px',
    borderBottomLeftRadius: '4px',
    padding: '10px 16px',
    width: 'fit-content',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
  },
  dotContainer: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
    height: '14px',
  },
  dot: {
    width: '6px',
    height: '6px',
    background: 'var(--primary-color)',
    borderRadius: '50%',
    animation: 'typing-bounce 1s infinite ease-in-out',
    opacity: 0.7,
  }
};

// Add the keyframe to the global styles or handle via style tag
export default TypingIndicator;
