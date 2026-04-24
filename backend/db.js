const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'lorapok.db');

class Database {
  constructor() {
    this.db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Database connection error:', err);
      } else {
        console.log('Connected to SQLite database at:', DB_PATH);
      }
    });
    this.initializeTables();
  }

  initializeTables() {
    this.db.serialize(() => {
      // Users table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          pin_hash TEXT NOT NULL,
          dp TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_seen TIMESTAMP
        )
      `);

      // Messages table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          from_user_id TEXT NOT NULL,
          to_user_id TEXT,
          group_id TEXT,
          content TEXT NOT NULL,
          encrypted BOOLEAN DEFAULT 0,
          status TEXT DEFAULT 'sent',
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(from_user_id) REFERENCES users(id),
          FOREIGN KEY(to_user_id) REFERENCES users(id)
        )
      `);

      // Message delivery status table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS message_delivery (
          id TEXT PRIMARY KEY,
          message_id TEXT NOT NULL,
          recipient_id TEXT NOT NULL,
          status TEXT DEFAULT 'sent',
          delivered_at TIMESTAMP,
          read_at TIMESTAMP,
          FOREIGN KEY(message_id) REFERENCES messages(id),
          FOREIGN KEY(recipient_id) REFERENCES users(id)
        )
      `);

      // Groups table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS groups (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_by TEXT NOT NULL,
          secret_key TEXT UNIQUE,
          is_public BOOLEAN DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(created_by) REFERENCES users(id)
        )
      `);

      // Group members table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS group_members (
          id TEXT PRIMARY KEY,
          group_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(group_id) REFERENCES groups(id),
          FOREIGN KEY(user_id) REFERENCES users(id),
          UNIQUE(group_id, user_id)
        )
      `);

      // Message queue for offline delivery
      this.db.run(`
        CREATE TABLE IF NOT EXISTS message_queue (
          id TEXT PRIMARY KEY,
          message_id TEXT NOT NULL,
          recipient_id TEXT NOT NULL,
          queued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          attempts INTEGER DEFAULT 0,
          FOREIGN KEY(message_id) REFERENCES messages(id),
          FOREIGN KEY(recipient_id) REFERENCES users(id)
        )
      `);

      // Create indexes for performance
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_messages_from ON messages(from_user_id)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_user_id)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_messages_group ON messages(group_id)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_delivery_status ON message_delivery(status)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_queue_recipient ON message_queue(recipient_id)`);
    });
  }

  run(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(query, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  get(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  // User methods
  async saveUser(userId, name, pinHash, dp) {
    return this.run(
      'INSERT OR REPLACE INTO users (id, name, pin_hash, dp) VALUES (?, ?, ?, ?)',
      [userId, name, pinHash, dp]
    );
  }

  async getUser(userId) {
    return this.get('SELECT * FROM users WHERE id = ?', [userId]);
  }

  async updateLastSeen(userId) {
    return this.run(
      'UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?',
      [userId]
    );
  }

  // Message methods
  async saveMessage(messageData) {
    const { id, from, to, groupId, content, encrypted, status, timestamp } = messageData;
    return this.run(
      'INSERT INTO messages (id, from_user_id, to_user_id, group_id, content, encrypted, status, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, from, to, groupId, content, encrypted ? 1 : 0, status, timestamp]
    );
  }

  async getPrivateMessages(userId1, userId2, limit = 100) {
    return this.all(
      `SELECT * FROM messages
       WHERE (from_user_id = ? AND to_user_id = ?)
          OR (from_user_id = ? AND to_user_id = ?)
       ORDER BY timestamp DESC LIMIT ?`,
      [userId1, userId2, userId2, userId1, limit]
    );
  }

  async getGroupMessages(groupId, limit = 100) {
    return this.all(
      'SELECT * FROM messages WHERE group_id = ? ORDER BY timestamp DESC LIMIT ?',
      [groupId, limit]
    );
  }

  async updateMessageStatus(messageId, status) {
    return this.run(
      'UPDATE messages SET status = ? WHERE id = ?',
      [status, messageId]
    );
  }

  async getMessage(messageId) {
    return this.get('SELECT * FROM messages WHERE id = ?', [messageId]);
  }

  // Message delivery methods
  async saveDeliveryStatus(messageId, recipientId, status) {
    const id = crypto.randomUUID ? crypto.randomUUID() : require('uuid').v4();
    return this.run(
      'INSERT INTO message_delivery (id, message_id, recipient_id, status) VALUES (?, ?, ?, ?)',
      [id, messageId, recipientId, status]
    );
  }

  async updateDeliveryStatus(messageId, recipientId, status, timestamp = null) {
    const setClause = timestamp ? 'status = ?, delivered_at = ?' : 'status = ?';
    const params = timestamp ? [status, timestamp, messageId, recipientId] : [status, messageId, recipientId];
    return this.run(
      `UPDATE message_delivery SET ${setClause} WHERE message_id = ? AND recipient_id = ?`,
      params
    );
  }

  async updateReadStatus(messageId, recipientId) {
    return this.run(
      'UPDATE message_delivery SET status = ?, read_at = CURRENT_TIMESTAMP WHERE message_id = ? AND recipient_id = ?',
      ['seen', messageId, recipientId]
    );
  }

  async getUndeliveredMessages(recipientId) {
    return this.all(
      `SELECT m.* FROM messages m
       INNER JOIN message_delivery md ON m.id = md.message_id
       WHERE md.recipient_id = ? AND md.status IN ('sent', 'pending')
       ORDER BY m.timestamp ASC`,
      [recipientId]
    );
  }

  // Message queue methods (for offline delivery)
  async queueMessage(messageId, recipientId) {
    const id = crypto.randomUUID ? crypto.randomUUID() : require('uuid').v4();
    return this.run(
      'INSERT OR IGNORE INTO message_queue (id, message_id, recipient_id) VALUES (?, ?, ?)',
      [id, messageId, recipientId]
    );
  }

  async getQueuedMessages(recipientId) {
    return this.all(
      'SELECT message_id FROM message_queue WHERE recipient_id = ? ORDER BY queued_at ASC LIMIT 100',
      [recipientId]
    );
  }

  async removeFromQueue(messageId, recipientId) {
    return this.run(
      'DELETE FROM message_queue WHERE message_id = ? AND recipient_id = ?',
      [messageId, recipientId]
    );
  }

  async incrementQueueAttempts(messageId, recipientId) {
    return this.run(
      'UPDATE message_queue SET attempts = attempts + 1 WHERE message_id = ? AND recipient_id = ?',
      [messageId, recipientId]
    );
  }

  // Group methods
  async saveGroup(groupId, name, createdBy, secretKey, isPublic) {
    return this.run(
      'INSERT OR REPLACE INTO groups (id, name, created_by, secret_key, is_public) VALUES (?, ?, ?, ?, ?)',
      [groupId, name, createdBy, secretKey, isPublic ? 1 : 0]
    );
  }

  async getGroup(groupId) {
    return this.get('SELECT * FROM groups WHERE id = ?', [groupId]);
  }

  async getGroupBySecretKey(secretKey) {
    return this.get('SELECT * FROM groups WHERE secret_key = ?', [secretKey]);
  }

  async getAllGroups() {
    return this.all('SELECT * FROM groups ORDER BY created_at DESC');
  }

  // Group members methods
  async addGroupMember(groupId, userId) {
    const id = crypto.randomUUID ? crypto.randomUUID() : require('uuid').v4();
    return this.run(
      'INSERT OR IGNORE INTO group_members (id, group_id, user_id) VALUES (?, ?, ?)',
      [id, groupId, userId]
    );
  }

  async getGroupMembers(groupId) {
    return this.all(
      'SELECT user_id FROM group_members WHERE group_id = ?',
      [groupId]
    );
  }

  async removeGroupMember(groupId, userId) {
    return this.run(
      'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

module.exports = Database;
