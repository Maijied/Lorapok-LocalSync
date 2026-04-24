import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { getBackendUrl } from '../utils/api';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    let newSocket;

    const initSocket = async () => {
      const backendUrl = await getBackendUrl();
      console.log('Connecting to backend at:', backendUrl);

      newSocket = io(backendUrl, {
        autoConnect: false,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      setSocket(newSocket);
    };

    initSocket();

    return () => {
      if (newSocket) newSocket.close();
    };
  }, []);

  useEffect(() => {
    if (socket && user) {
      socket.connect();
      
      socket.on('connect', () => {
        console.log('Socket connected, registering user:', user.name);
        socket.emit('register', user);
      });

      socket.on('connect_error', (err) => {
        console.warn('Socket connection error:', err.message);
      });

      socket.on('users_update', (users) => {
        // Filter out ourselves from the online users list
        setOnlineUsers(users.filter(u => u.id !== user.id));
      });

      return () => {
        socket.off('connect');
        socket.off('connect_error');
        socket.off('users_update');
        socket.disconnect();
      };
    }
  }, [socket, user]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
};
