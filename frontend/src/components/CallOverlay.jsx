import React, { useEffect, useRef } from 'react';
import { useCall } from '../context/CallContext';
import { Phone, Video, PhoneOff, MicOff, VideoOff } from 'lucide-react';

export default function CallOverlay() {
  const { callState, localStream, remoteStream, answerCall, endCall } = useCall();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callState]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callState]);

  const [duration, setDuration] = React.useState(0);

  useEffect(() => {
    let interval;
    if (callState?.status === 'connected') {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      setDuration(0);
    }
    return () => clearInterval(interval);
  }, [callState?.status]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!callState) return null;

  if (callState.status === 'incoming') {
    return (
      <div style={styles.overlay}>
        <div className="glass-panel" style={styles.incomingCard}>
          <div style={styles.avatarLarge}>{callState.otherUser.name.charAt(0).toUpperCase()}</div>
          <h2>{callState.otherUser.name}</h2>
          <p>Incoming {callState.isVideo ? 'Video' : 'Voice'} Call...</p>
          <div style={styles.actionButtons}>
            <button className="btn-primary" style={{...styles.btn, backgroundColor: '#ef4444'}} onClick={endCall}>
              <PhoneOff size={24} />
            </button>
            <button className="btn-primary" style={{...styles.btn, backgroundColor: '#10b981'}} onClick={answerCall}>
              {callState.isVideo ? <Video size={24} /> : <Phone size={24} />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.callContainer}>
        {callState.isVideo ? (
          <div style={styles.videoGrid}>
            <div style={styles.remoteVideoContainer}>
              {remoteStream ? (
                <video ref={remoteVideoRef} autoPlay playsInline style={styles.video} />
              ) : (
                <div style={styles.videoPlaceholder}>Connecting...</div>
              )}
              {callState.status === 'connected' && (
                <div style={styles.videoTimer}>{formatDuration(duration)}</div>
              )}
            </div>
            <div style={styles.localVideoContainer}>
              <video ref={localVideoRef} autoPlay playsInline muted style={styles.video} />
            </div>
          </div>
        ) : (
          <div style={styles.voiceCallContainer}>
            <div style={styles.avatarHuge}>{callState.otherUser.name.charAt(0).toUpperCase()}</div>
            <h2>{callState.otherUser.name}</h2>
            <p>{callState.status === 'connected' ? formatDuration(duration) : 'Calling...'}</p>
            {/* hidden audio elements to play stream */}
            <audio ref={remoteVideoRef} autoPlay />
            <audio ref={localVideoRef} autoPlay muted />
          </div>
        )}

        <div style={styles.controlsBar}>
          <button className="btn-primary" style={styles.controlBtn}>
            <MicOff size={24} />
          </button>
          {callState.isVideo && (
            <button className="btn-primary" style={styles.controlBtn}>
              <VideoOff size={24} />
            </button>
          )}
          <button className="btn-primary" style={{...styles.controlBtn, backgroundColor: '#ef4444'}} onClick={endCall}>
            <PhoneOff size={24} />
          </button>
        </div>
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
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    backdropFilter: 'blur(10px)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomingCard: {
    padding: '40px',
    textAlign: 'center',
    width: '320px',
  },
  avatarLarge: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: 'var(--primary-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2rem',
    fontWeight: 'bold',
    margin: '0 auto 20px',
  },
  avatarHuge: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    backgroundColor: 'var(--primary-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '3rem',
    fontWeight: 'bold',
    margin: '0 auto 20px',
  },
  actionButtons: {
    display: 'flex',
    justifyContent: 'center',
    gap: '20px',
    marginTop: '30px',
  },
  btn: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callContainer: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  videoGrid: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
  },
  remoteVideoContainer: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoTimer: {
    position: 'absolute',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: '4px 12px',
    borderRadius: '20px',
    color: '#fff',
    fontSize: '0.9rem',
    fontWeight: 'bold',
  },
  localVideoContainer: {
    position: 'absolute',
    bottom: '20px',
    right: '20px',
    width: '200px',
    height: '150px',
    backgroundColor: '#222',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '2px solid rgba(255,255,255,0.2)',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  videoPlaceholder: {
    color: '#fff',
    fontSize: '1.2rem',
  },
  voiceCallContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlsBar: {
    height: '100px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '20px',
    background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
  },
  controlBtn: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
  }
};
