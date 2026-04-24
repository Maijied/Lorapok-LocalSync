/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { getBackendBaseUrl } from '../utils/network';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const { user, accessToken, refreshAccessToken, handleSessionExpired } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [connectionError, setConnectionError] = useState('');

  const socket = useMemo(() => {
    if (!user || !accessToken) {
      return null;
    }

    return io(getBackendBaseUrl(), {
      autoConnect: false,
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
    });
  }, [accessToken, user]);

  useEffect(() => {
    if (!socket || !user || !accessToken) {
      return undefined;
    }

    let active = true;

    const handleConnect = () => {
      if (!active) {
        return;
      }

      setConnectionStatus('connected');
      setConnectionError('');
    };

    const handleDisconnect = () => {
      if (!active) {
        return;
      }

      setConnectionStatus('disconnected');
    };

    const handleUsersUpdate = (users) => {
      setOnlineUsers(users.filter((entry) => entry.id !== user.id));
    };

    const handleConnectError = async (error) => {
      if (!active) {
        return;
      }

      const code = error?.message || 'SOCKET_ERROR';
      setConnectionError(code);
      setConnectionStatus('disconnected');

      if (!code.startsWith('AUTH_')) {
        return;
      }

      try {
        const freshToken = await refreshAccessToken();
        if (!active) {
          return;
        }

        socket.auth = { token: freshToken };
        socket.connect();
      } catch (refreshError) {
        console.error('Socket token refresh failed:', refreshError);
        await handleSessionExpired();
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('users_update', handleUsersUpdate);
    socket.connect();

    return () => {
      active = false;
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('users_update', handleUsersUpdate);
      socket.disconnect();
    };
  }, [accessToken, handleSessionExpired, refreshAccessToken, socket, user]);

  const value = useMemo(
    () => ({
      socket,
      onlineUsers: user && accessToken ? onlineUsers : [],
      connectionStatus: user && accessToken ? connectionStatus : 'disconnected',
      connectionError,
      isConnected: Boolean(user && accessToken && connectionStatus === 'connected'),
    }),
    [socket, onlineUsers, connectionStatus, connectionError, user, accessToken]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};
