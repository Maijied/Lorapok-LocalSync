import React from 'react';

export default function ConnectionBanner({ status, error }) {
  if (status === 'connected') {
    return null;
  }

  const label =
    status === 'connecting'
      ? 'Connecting to Lorapok Communicator...'
      : error?.startsWith('AUTH_')
        ? 'Session expired. Please unlock again.'
        : 'Disconnected. Messages will sync after reconnection.';

  return <div style={styles.banner}>{label}</div>;
}

const styles = {
  banner: {
    padding: '10px 16px',
    fontSize: '0.82rem',
    color: '#fff',
    background: 'rgba(188, 19, 254, 0.18)',
    borderBottom: '1px solid rgba(188, 19, 254, 0.4)',
  },
};
