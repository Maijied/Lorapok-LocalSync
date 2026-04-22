import { openDB } from 'idb';

const DB_NAME = 'RouterCommDB';
const DB_VERSION = 1;

export const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('currentUser')) {
        db.createObjectStore('currentUser', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('contacts')) {
        db.createObjectStore('contacts', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('messages')) {
        const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
        messageStore.createIndex('chatId', 'chatId', { unique: false });
        messageStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains('groups')) {
        db.createObjectStore('groups', { keyPath: 'id' });
      }
    },
  });
};

export const getCurrentUser = async () => {
  const db = await initDB();
  const tx = db.transaction('currentUser', 'readonly');
  const store = tx.objectStore('currentUser');
  const users = await store.getAll();
  return users.length > 0 ? users[0] : null;
};

export const saveCurrentUser = async (user) => {
  const db = await initDB();
  const tx = db.transaction('currentUser', 'readwrite');
  const store = tx.objectStore('currentUser');
  await store.clear();
  await store.put(user);
};

export const saveContact = async (contact) => {
  const db = await initDB();
  await db.put('contacts', contact);
};

export const getContacts = async () => {
  const db = await initDB();
  return db.getAll('contacts');
};

export const saveMessage = async (message) => {
  const db = await initDB();
  await db.put('messages', message);
};

export const getMessagesByChatId = async (chatId) => {
  const db = await initDB();
  const tx = db.transaction('messages', 'readonly');
  const index = tx.store.index('chatId');
  const messages = await index.getAll(chatId);
  return messages.sort((a, b) => a.timestamp - b.timestamp);
};

export const saveGroup = async (group) => {
  const db = await initDB();
  await db.put('groups', group);
};

export const getGroups = async () => {
  const db = await initDB();
  return db.getAll('groups');
};
