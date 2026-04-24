/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

const CallContext = createContext(null);

export const useCall = () => useContext(CallContext);

export const CallProvider = ({ children }) => {
  const { socket, onlineUsers } = useSocket();
  const { user } = useAuth();
  const [callState, setCallState] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const peerConnectionRef = useRef(null);
  const callStateRef = useRef(null);
  const localStreamRef = useRef(null);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  const cleanupMedia = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  const endCall = useCallback((notifyPeer = true) => {
    const otherUserId = callStateRef.current?.otherUser?.id;
    if (notifyPeer && socket && otherUserId) {
      socket.emit('call_end', { to: otherUserId });
    }

    cleanupMedia();
    setCallState(null);
  }, [cleanupMedia, socket]);

  useEffect(() => {
    if (!socket || !user) {
      return undefined;
    }

    const handleOffer = async (data) => {
      const caller = onlineUsers.find((entry) => entry.id === data.from) || data.fromUser || { id: data.from, name: 'Unknown' };
      setCallState({ status: 'incoming', otherUser: caller, isVideo: data.isVideo, offer: data.offer });
    };

    const handleAnswer = async (data) => {
      if (peerConnectionRef.current && peerConnectionRef.current.signalingState !== 'stable') {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        setCallState((current) => (current ? { ...current, status: 'connected' } : current));
      }
    };

    const handleIceCandidate = async (data) => {
      if (!peerConnectionRef.current || !data.candidate) {
        return;
      }

      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    };

    const handleBusy = () => {
      cleanupMedia();
      setCallState((current) => (current ? { ...current, status: 'busy' } : null));
    };

    const handleUnavailable = () => {
      cleanupMedia();
      setCallState((current) => (current ? { ...current, status: 'unavailable' } : null));
    };

    const handleEnded = () => {
      endCall(false);
    };

    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('call_busy', handleBusy);
    socket.on('call_unavailable', handleUnavailable);
    socket.on('call_ended', handleEnded);
    socket.on('disconnect', handleEnded);

    return () => {
      socket.off('offer', handleOffer);
      socket.off('answer', handleAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('call_busy', handleBusy);
      socket.off('call_unavailable', handleUnavailable);
      socket.off('call_ended', handleEnded);
      socket.off('disconnect', handleEnded);
    };
  }, [cleanupMedia, endCall, onlineUsers, socket, user]);

  const initPeerConnection = () => {
    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && callState?.otherUser?.id) {
        socket.emit('ice-candidate', {
          to: callState.otherUser.id,
          candidate: event.candidate,
        });
      }
    };

    peerConnection.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    peerConnectionRef.current = peerConnection;
    return peerConnection;
  };

  const startCall = async (otherUser, isVideo) => {
    if (!socket || callState) {
      return;
    }

    try {
      setCallState({ status: 'outgoing', otherUser, isVideo });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo });
      setLocalStream(stream);

      const peerConnection = initPeerConnection();
      stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      socket.emit('offer', {
        to: otherUser.id,
        from: user.id,
        offer,
        isVideo,
      });
    } catch (error) {
      console.error('Failed to start call:', error);
      endCall(false);
    }
  };

  const answerCall = async () => {
    if (!callState?.offer) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callState.isVideo });
      setLocalStream(stream);

      const peerConnection = initPeerConnection();
      stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

      await peerConnection.setRemoteDescription(new RTCSessionDescription(callState.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      socket.emit('answer', {
        to: callState.otherUser.id,
        from: user.id,
        answer,
      });

      setCallState((current) => (current ? { ...current, status: 'connected' } : current));
    } catch (error) {
      console.error('Failed to answer call:', error);
      endCall(false);
    }
  };

  return (
    <CallContext.Provider value={{ callState, localStream, remoteStream, startCall, answerCall, endCall }}>
      {children}
    </CallContext.Provider>
  );
};
