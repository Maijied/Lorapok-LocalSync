import React, { useEffect, useRef } from 'react';
import { useCall } from '../context/CallContext';
import { Phone, Video, PhoneOff, Mic, MicOff, VideoOff, Camera } from 'lucide-react';
import { formatAssetUrl } from '../utils/api';

export default function CallOverlay() {
  const { 
    callState, localStream, remoteStream, 
    isMuted, isVideoOff, 
    answerCall, endCall, toggleMute, toggleVideo 
  } = useCall();
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [duration, setDuration] = React.useState(0);

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

  useEffect(() => {
    let interval;
    if (callState?.status === 'connected') {
      interval = setInterval(() => {
        setDuration(Math.floor((Date.now() - callState.startTime) / 1000));
      }, 1000);
    } else {
      setDuration(0);
    }
    return () => clearInterval(interval);
  }, [callState?.status, callState?.startTime]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!callState) return null;

  const otherUser = callState.otherUser;

  if (callState.status === 'incoming') {
    return (
      <div style={styles.overlay}>
        <div className="glass-panel" style={styles.incomingCard}>
          <div style={styles.avatarLarge}>
            {otherUser.dp ? <img src={formatAssetUrl(otherUser.dp)} style={styles.avatarImg} alt="dp" /> : otherUser.name.charAt(0).toUpperCase()}
          </div>
          <h2 style={{margin: '10px 0'}}>{otherUser.name}</h2>
          <p style={{opacity: 0.7, animation: 'pulse 1.5s infinite'}}>Incoming {callState.isVideo ? 'Video' : 'Voice'} Call...</p>
          <div style={styles.actionButtons}>
            <button className="call-btn reject" onClick={endCall}>
              <PhoneOff size={28} />
            </button>
            <button className="call-btn accept" onClick={answerCall}>
              {callState.isVideo ? <Video size={28} /> : <Phone size={28} />}
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
          <div style={styles.videoArea}>
            {remoteStream ? (
              <video ref={remoteVideoRef} autoPlay playsInline style={styles.remoteVideo} />
            ) : (
              <div style={styles.videoPlaceholder}>
                 <div style={styles.avatarHuge}>
                   {otherUser.dp ? <img src={formatAssetUrl(otherUser.dp)} style={styles.avatarImg} alt="dp" /> : otherUser.name.charAt(0).toUpperCase()}
                 </div>
                 <p>{callState.status === 'outgoing' ? 'Ringing...' : 'Connecting...'}</p>
              </div>
            )}
            
            <div style={styles.topBar}>
              <div style={styles.userInfo}>
                <div style={styles.avatarSmall}>
                  {otherUser.dp ? <img src={formatAssetUrl(otherUser.dp)} style={styles.avatarImg} alt="dp" /> : otherUser.name.charAt(0).toUpperCase()}
                </div>
                <span>{otherUser.name}</span>
              </div>
              {callState.status === 'connected' && (
                <div style={styles.durationBadge}>{formatDuration(duration)}</div>
              )}
            </div>

            <div style={styles.localVideoWrapper}>
              <video ref={localVideoRef} autoPlay playsInline muted style={{...styles.localVideo, opacity: isVideoOff ? 0 : 1}} />
              {isVideoOff && <div style={styles.videoOffPlaceholder}><VideoOff size={24} /></div>}
            </div>
          </div>
        ) : (
          <div style={styles.voiceArea}>
            <div style={styles.avatarHuge}>
              {otherUser.dp ? <img src={formatAssetUrl(otherUser.dp)} style={styles.avatarImg} alt="dp" /> : otherUser.name.charAt(0).toUpperCase()}
            </div>
            <h2 style={{fontSize: '2.5rem', marginBottom: '10px'}}>{otherUser.name}</h2>
            <p style={{fontSize: '1.2rem', opacity: 0.6}}>
              {callState.status === 'connected' ? formatDuration(duration) : (callState.status === 'outgoing' ? 'Ringing...' : 'Calling...')}
            </p>
            <audio ref={remoteVideoRef} autoPlay />
            <audio ref={localVideoRef} autoPlay muted />
          </div>
        )}

        <div style={styles.floatingControls}>
          <div className="glass-panel" style={styles.controlsInternal}>
            <button 
              className={`control-btn ${isMuted ? 'active' : ''}`}
              onClick={toggleMute}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
            </button>
            
            {callState.isVideo && (
              <button 
                className={`control-btn ${isVideoOff ? 'active' : ''}`}
                onClick={toggleVideo}
                title={isVideoOff ? "Start Video" : "Stop Video"}
              >
                {isVideoOff ? <VideoOff size={22} /> : <Camera size={22} />}
              </button>
            )}

            <button className="control-btn end-call" onClick={endCall} title="End Call">
              <PhoneOff size={26} />
            </button>
          </div>
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
    backgroundColor: '#05050a',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    overflow: 'hidden',
  },
  incomingCard: {
    padding: '50px',
    textAlign: 'center',
    width: '350px',
    borderRadius: '32px',
    background: 'rgba(255, 255, 255, 0.05)',
  },
  avatarLarge: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    backgroundColor: 'var(--primary-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '3rem',
    margin: '0 auto 20px',
    overflow: 'hidden',
    border: '3px solid var(--primary-color)',
    boxShadow: '0 0 30px rgba(0, 243, 255, 0.3)',
  },
  avatarHuge: {
    width: '180px',
    height: '180px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '5rem',
    margin: '0 auto 30px',
    overflow: 'hidden',
    border: '4px solid var(--primary-color)',
    boxShadow: '0 0 50px rgba(0, 243, 255, 0.2)',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  actionButtons: {
    display: 'flex',
    justifyContent: 'center',
    gap: '30px',
    marginTop: '40px',
  },
  callContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  },
  videoArea: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  remoteVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  topBar: {
    position: 'absolute',
    top: '30px',
    left: '30px',
    right: '30px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 16px',
    background: 'rgba(0,0,0,0.5)',
    borderRadius: '30px',
    backdropFilter: 'blur(10px)',
  },
  avatarSmall: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    overflow: 'hidden',
    backgroundColor: 'var(--primary-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  durationBadge: {
    background: 'rgba(0,0,0,0.5)',
    padding: '8px 16px',
    borderRadius: '30px',
    backdropFilter: 'blur(10px)',
    fontWeight: '600',
    fontFamily: 'monospace',
    letterSpacing: '1px',
  },
  localVideoWrapper: {
    position: 'absolute',
    top: '30px',
    right: '30px',
    width: '150px',
    aspectRatio: '3/4',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
    border: '1px solid rgba(255,255,255,0.2)',
    zIndex: 20,
  },
  localVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  videoOffPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#111',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255,255,255,0.2)',
  },
  voiceArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'radial-gradient(circle at center, #1e293b 0%, #05050a 100%)',
  },
  floatingControls: {
    position: 'absolute',
    bottom: '40px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 100,
  },
  controlsInternal: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    padding: '16px 30px',
    borderRadius: '40px',
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
  },
  videoPlaceholder: {
    textAlign: 'center',
  }
};
