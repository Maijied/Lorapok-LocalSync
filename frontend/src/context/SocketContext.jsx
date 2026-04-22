import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    // Connect to the same dynamic port where Vite is running
    const newSocket = io('/', {
      autoConnect: false,
    });

    setSocket(newSocket);

    return () => newSocket.close();
  }, []);

  useEffect(() => {
    if (socket && user) {
      socket.connect();
      
      socket.on('connect', () => {
        socket.emit('register', user);
      });

      socket.on('users_update', (users) => {
        // Filter out ourselves from the online users list
        setOnlineUsers(users.filter(u => u.id !== user.id));
      });

      return () => {
        socket.off('connect');
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
