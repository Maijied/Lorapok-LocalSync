import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSocket } from './SocketContext';
import { initDB } from '../utils/db';

const SyncContext = createContext();

export const useSync = () => useContext(SyncContext);

export const SyncProvider = ({ children }) => {
  const { socket, isConnected } = useSocket();
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const syncOfflineMessages = async () => {
      setIsSyncing(true);
      try {
        const db = await initDB();
        const tx = db.transaction('messages', 'readonly');
        const store = tx.objectStore('messages');
        const index = store.index('syncState');
        const pendingMessages = await index.getAll('pending');

        for (const msg of pendingMessages) {
          // Send to server
          socket.emit('private_message', msg);
          
          // Update local status to sent
          const writeTx = db.transaction('messages', 'readwrite');
          const writeStore = writeTx.objectStore('messages');
          await writeStore.put({ ...msg, syncState: 'synced', status: 'sent' });
        }
      } catch (error) {
        console.error('Error syncing offline messages:', error);
      } finally {
        setIsSyncing(false);
      }
    };

    syncOfflineMessages();
  }, [socket, isConnected]);

  const queueMessage = async (message) => {
    try {
      const db = await initDB();
      const tx = db.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      await store.put({ ...message, syncState: 'pending', status: 'pending' });
      
      if (isConnected && socket) {
        socket.emit('private_message', message);
        
        const updateTx = db.transaction('messages', 'readwrite');
        const updateStore = updateTx.objectStore('messages');
        await updateStore.put({ ...message, syncState: 'synced', status: 'sent' });
      }
    } catch (error) {
      console.error('Error queuing message:', error);
    }
  };

  return (
    <SyncContext.Provider value={{ queueMessage, isSyncing }}>
      {children}
    </SyncContext.Provider>
  );
};
