import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { v4 as uuidv4 } from 'uuid';

const CallContext = createContext();

export const useCall = () => useContext(CallContext);

export const CallProvider = ({ children }) => {
  const { socket, onlineUsers } = useSocket();
  const { user } = useAuth();
  
  const [callState, setCallState] = useState(null); 
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  const peerConnectionRef = useRef(null);
  const audioContextRef = useRef(null);
  const ringtoneIntervalRef = useRef(null);

  // Audio generation for "cring-cring"
  const startRingtone = (isOutgoing) => {
    if (ringtoneIntervalRef.current) return;
    
    const playRing = () => {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = ctx;
      
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.type = isOutgoing ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(isOutgoing ? 440 : 400, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(isOutgoing ? 480 : 450, ctx.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.5);
    };

    playRing();
    ringtoneIntervalRef.current = setInterval(playRing, 2000);
  };

  const stopRingtone = () => {
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  useEffect(() => {
    if (!socket || !user) return;

    socket.on('offer', async (data) => {
      const caller = onlineUsers.find(u => u.id === data.from) || { id: data.from, name: 'User' };
      setCallState({ status: 'incoming', otherUser: caller, isVideo: data.isVideo, offer: data.offer, startTime: Date.now() });
      startRingtone(false);
    });

    socket.on('answer', async (data) => {
      stopRingtone();
      if (peerConnectionRef.current && peerConnectionRef.current.signalingState !== 'stable') {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        setCallState(prev => prev ? { ...prev, status: 'connected', startTime: Date.now() } : null);
      }
    });

    socket.on('ice-candidate', async (data) => {
      if (peerConnectionRef.current && data.candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {}
      }
    });

    socket.on('end_call', () => {
      cleanupCall();
    });

    socket.on('reject_call', () => {
      cleanupCall();
    });

    return () => {
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('end_call');
      socket.off('reject_call');
      stopRingtone();
    };
  }, [socket, user, onlineUsers]);

  const initPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && callState?.otherUser) {
        socket.emit('ice-candidate', {
          to: callState.otherUser.id,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        cleanupCall();
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  const getMediaStream = async (requestedVideo) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Your browser does not support secure media access. Please ensure you are using HTTPS and a modern browser.');
    }

    // Try the full request first
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: true, video: requestedVideo });
    } catch (err) {
      console.warn("Primary media request failed:", err.name, err.message);
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error('Microphone/Camera permission was denied. Please allow access in your browser settings.');
      }

      if (err.name === 'NotFoundError' || err.name === 'NotReadableError' || err.name === 'OverconstrainedError' || err.message.includes('object can not be found')) {
        // If full request failed, try fallbacks
        if (requestedVideo) {
          try {
            console.warn("Video failed, trying audio only...");
            return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          } catch (audioErr) {
            console.warn("Audio also failed, trying video only...");
            try {
              return await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
            } catch (videoErr) {
               throw new Error('No working camera or microphone found. If you are on a local IP, ensure you have accepted the SSL certificate risk.');
            }
          }
        } else {
          // If even audio-only failed
          try {
            console.warn("Audio failed, trying video only...");
            return await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
          } catch (videoErr) {
            throw new Error('No working camera or microphone found. If you are on a local IP, ensure you have accepted the SSL certificate risk.');
          }
        }
      }
      throw err;
    }
  };

  const startCall = async (otherUser, isVideo) => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        alert('Secure connection required for calls.');
        return;
      }
      
      setCallState({ status: 'outgoing', otherUser, isVideo, startTime: Date.now() });
      startRingtone(true);
      
      const stream = await getMediaStream(isVideo);
      setLocalStream(stream);

      const actuallyHasVideo = stream.getVideoTracks().length > 0;
      if (isVideo && !actuallyHasVideo) {
        setCallState(prev => ({ ...prev, isVideo: false }));
      }

      const pc = initPeerConnection();
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('offer', { to: otherUser.id, from: user.id, offer, isVideo: actuallyHasVideo });
    } catch (err) {
      console.error("Call failed", err);
      alert(`Call failed: ${err.message}`);
      cleanupCall();
    }
  };

  const answerCall = async () => {
    if (!callState?.offer) return;
    stopRingtone();
    
    try {
      const stream = await getMediaStream(callState.isVideo);
      setLocalStream(stream);

      const actuallyHasVideo = stream.getVideoTracks().length > 0;
      
      const pc = initPeerConnection();
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(callState.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('answer', { to: callState.otherUser.id, from: user.id, answer });
      setCallState(prev => ({ ...prev, status: 'connected', startTime: Date.now(), isVideo: actuallyHasVideo }));
    } catch (err) {
      console.error("Answer failed", err);
      // Notify caller that we couldn't answer
      if (callState?.otherUser) {
        socket.emit('reject_call', { to: callState.otherUser.id });
      }
      alert(`Could not answer: ${err.message}`);
      cleanupCall();
    }
  };

  const endCall = () => {
    if (callState?.otherUser) {
      socket.emit('end_call', { to: callState.otherUser.id });
      
      // Log the call
      const duration = callState.status === 'connected' ? Math.floor((Date.now() - callState.startTime) / 1000) : 0;
      const durationText = duration > 0 ? `(${Math.floor(duration/60)}m ${duration%60}s)` : '(Missed)';
      socket.emit('call_log', {
        id: uuidv4(),
        from: user.id,
        to: callState.otherUser.id,
        text: `${callState.isVideo ? 'Video' : 'Voice'} call ended ${durationText}`,
        type: 'call-log',
        timestamp: Date.now()
      });
    }
    cleanupCall();
  };

  const cleanupCall = () => {
    stopRingtone();
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    setLocalStream(null);
    setRemoteStream(null);
    setCallState(null);
    setIsMuted(false);
    setIsVideoOff(false);
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  return (
    <CallContext.Provider value={{ 
      callState, localStream, remoteStream, isMuted, isVideoOff,
      startCall, answerCall, endCall, toggleMute, toggleVideo 
    }}>
      {children}
    </CallContext.Provider>
  );
};
