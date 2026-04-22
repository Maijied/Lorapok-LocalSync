import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

const CallContext = createContext();

export const useCall = () => useContext(CallContext);

export const CallProvider = ({ children }) => {
  const { socket, onlineUsers } = useSocket();
  const { user } = useAuth();
  
  const [callState, setCallState] = useState(null); // { status: 'incoming'|'outgoing'|'connected', otherUser: Object, isVideo: boolean }
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  
  const peerConnectionRef = useRef(null);

  useEffect(() => {
    if (!socket || !user) return;

    socket.on('offer', async (data) => {
      const caller = onlineUsers.find(u => u.id === data.from) || { id: data.from, name: 'Unknown' };
      setCallState({ status: 'incoming', otherUser: caller, isVideo: data.isVideo, offer: data.offer });
    });

    socket.on('answer', async (data) => {
      if (peerConnectionRef.current && peerConnectionRef.current.signalingState !== 'stable') {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });

    socket.on('ice-candidate', async (data) => {
      if (peerConnectionRef.current && data.candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error("Error adding received ice candidate", e);
        }
      }
    });

    return () => {
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
    };
  }, [socket, user, onlineUsers]);

  const initPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }, // standard free stun server
      ],
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

    peerConnectionRef.current = pc;
    return pc;
  };

  const startCall = async (otherUser, isVideo) => {
    try {
      setCallState({ status: 'outgoing', otherUser, isVideo });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo });
      setLocalStream(stream);

      const pc = initPeerConnection();
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('offer', {
        to: otherUser.id,
        from: user.id,
        offer,
        isVideo,
      });
    } catch (err) {
      console.error("Failed to start call", err);
      setCallState(null);
    }
  };

  const answerCall = async () => {
    if (!callState || !callState.offer) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callState.isVideo });
      setLocalStream(stream);

      const pc = initPeerConnection();
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(callState.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('answer', {
        to: callState.otherUser.id,
        from: user.id,
        answer,
      });

      setCallState(prev => ({ ...prev, status: 'connected' }));
    } catch (err) {
      console.error("Failed to answer call", err);
      endCall();
    }
  };

  const endCall = () => {
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
  };

  return (
    <CallContext.Provider value={{ callState, localStream, remoteStream, startCall, answerCall, endCall }}>
      {children}
    </CallContext.Provider>
  );
};
