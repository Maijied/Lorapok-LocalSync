import { openDB } from 'idb';

const DB_NAME = 'LorapokCommunicatorDB';
const DB_VERSION = 2;

export const initDB = async () =>
  openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('currentUser')) {
        db.createObjectStore('currentUser', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('contacts')) {
        db.createObjectStore('contacts', { keyPath: 'id' });
      }

      let messageStore;
      if (!db.objectStoreNames.contains('messages')) {
        messageStore = db.createObjectStore('messages', { keyPath: 'id' });
      } else {
        messageStore = db.transaction.objectStore('messages');
      }

      if (!messageStore.indexNames.contains('chatId')) {
        messageStore.createIndex('chatId', 'chatId', { unique: false });
      }
      if (!messageStore.indexNames.contains('status')) {
        messageStore.createIndex('status', 'status', { unique: false });
      }
      if (!messageStore.indexNames.contains('timestamp')) {
        messageStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains('groups')) {
        db.createObjectStore('groups', { keyPath: 'id' });
      }
    },
  });

export const getCurrentUser = async () => {
  const db = await initDB();
  const users = await db.getAll('currentUser');
  return users[0] || null;
};

export const saveCurrentUser = async (user) => {
  const db = await initDB();
  const tx = db.transaction('currentUser', 'readwrite');
  await tx.objectStore('currentUser').clear();
  await tx.objectStore('currentUser').put(user);
  await tx.done;
};

export const clearCurrentUser = async () => {
  const db = await initDB();
  await db.clear('currentUser');
};

export const saveContact = async (contact) => {
  const db = await initDB();
  await db.put('contacts', contact);
};

export const getContacts = async () => {
  const db = await initDB();
  return db.getAll('contacts');
};

export const upsertMessage = async (message) => {
  const db = await initDB();
  const existing = await db.get('messages', message.id);
  const merged = {
    ...existing,
    ...message,
    status: message.status || existing?.status || 'pending',
    deliveredAt: message.deliveredAt ?? existing?.deliveredAt ?? null,
    seenAt: message.seenAt ?? existing?.seenAt ?? null,
  };

  await db.put('messages', merged);
  return merged;
};

export const saveMessage = upsertMessage;

export const updateMessageStatus = async (messageId, updates) => {
  const db = await initDB();
  const existing = await db.get('messages', messageId);
  if (!existing) {
    return null;
  }

  const updated = {
    ...existing,
    ...updates,
    status: updates.status || existing.status,
    deliveredAt: updates.deliveredAt ?? existing.deliveredAt ?? null,
    seenAt: updates.seenAt ?? existing.seenAt ?? null,
  };

  await db.put('messages', updated);
  return updated;
};

export const getMessagesByChatId = async (chatId) => {
  const db = await initDB();
  const messages = await db.getAllFromIndex('messages', 'chatId', chatId);
  return messages.sort((a, b) => a.timestamp - b.timestamp);
};

export const saveGroup = async (group) => {
  const db = await initDB();
  await db.put('groups', group);
};

export const saveGroups = async (groups) => {
  const db = await initDB();
  const tx = db.transaction('groups', 'readwrite');
  const store = tx.objectStore('groups');
  await store.clear();
  for (const group of groups) {
    await store.put(group);
  }
  await tx.done;
};

export const getGroups = async () => {
  const db = await initDB();
  return db.getAll('groups');
};
