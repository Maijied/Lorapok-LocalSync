const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'lorapok.db');

class Database {
  constructor() {
    this.db = new sqlite3.Database(DB_PATH, (error) => {
      if (error) {
        console.error('Database connection error:', error);
      } else {
        console.log('Connected to SQLite database at:', DB_PATH);
      }
    });

    this.initialize();
  }

  initialize() {
    this.db.serialize(() => {
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

      this.db.run(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          chat_id TEXT,
          from_user_id TEXT NOT NULL,
          sender_name TEXT,
          to_user_id TEXT,
          group_id TEXT,
          content TEXT,
          type TEXT DEFAULT 'text',
          file_data TEXT,
          encrypted BOOLEAN DEFAULT 0,
          status TEXT DEFAULT 'sent',
          timestamp INTEGER NOT NULL,
          delivered_at INTEGER,
          seen_at INTEGER,
          FOREIGN KEY(from_user_id) REFERENCES users(id),
          FOREIGN KEY(to_user_id) REFERENCES users(id)
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS message_delivery (
          id TEXT PRIMARY KEY,
          message_id TEXT NOT NULL,
          recipient_id TEXT NOT NULL,
          status TEXT DEFAULT 'sent',
          delivered_at INTEGER,
          read_at INTEGER,
          UNIQUE(message_id, recipient_id),
          FOREIGN KEY(message_id) REFERENCES messages(id),
          FOREIGN KEY(recipient_id) REFERENCES users(id)
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS groups_table (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_by TEXT NOT NULL,
          secret_key TEXT UNIQUE,
          is_public BOOLEAN DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(created_by) REFERENCES users(id)
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS group_members (
          id TEXT PRIMARY KEY,
          group_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(group_id, user_id),
          FOREIGN KEY(group_id) REFERENCES groups_table(id),
          FOREIGN KEY(user_id) REFERENCES users(id)
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS message_queue (
          id TEXT PRIMARY KEY,
          message_id TEXT NOT NULL,
          recipient_id TEXT NOT NULL,
          event_type TEXT DEFAULT 'private_message',
          queued_at INTEGER DEFAULT (strftime('%s','now') * 1000),
          attempts INTEGER DEFAULT 0,
          UNIQUE(message_id, recipient_id),
          FOREIGN KEY(message_id) REFERENCES messages(id),
          FOREIGN KEY(recipient_id) REFERENCES users(id)
        )
      `);

      this.migrateLegacySchema();

      this.db.run('CREATE INDEX IF NOT EXISTS idx_messages_group_id ON messages(group_id)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_message_delivery_recipient ON message_delivery(recipient_id)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_message_queue_recipient ON message_queue(recipient_id)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id)');
    });
  }

  migrateLegacySchema() {
    const ensureColumn = (table, column, definition) => {
      this.db.all(`PRAGMA table_info(${table})`, (error, rows) => {
        if (error) {
          console.error(`Failed to inspect table ${table}:`, error);
          return;
        }

        const hasColumn = rows.some((row) => row.name === column);
        if (!hasColumn) {
          this.db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`, (alterError) => {
            if (alterError) {
              console.error(`Failed to alter ${table}.${column}:`, alterError);
            }
          });
        }
      });
    };

    ensureColumn('messages', 'chat_id', 'TEXT');
    ensureColumn('messages', 'sender_name', 'TEXT');
    ensureColumn('messages', 'type', "TEXT DEFAULT 'text'");
    ensureColumn('messages', 'file_data', 'TEXT');
    ensureColumn('messages', 'delivered_at', 'INTEGER');
    ensureColumn('messages', 'seen_at', 'INTEGER');
    ensureColumn('message_queue', 'event_type', "TEXT DEFAULT 'private_message'");
  }

  run(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(query, params, function onRun(error) {
        if (error) {
          reject(error);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(query, params, (error, row) => {
        if (error) {
          reject(error);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  all(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(query, params, (error, rows) => {
        if (error) {
          reject(error);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  generateId() {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`;
  }

  sanitizeUser(user) {
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      dp: user.dp || '',
      createdAt: user.created_at || null,
      lastSeen: user.last_seen || null,
    };
  }

  mapMessageRow(row) {
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      chatId: row.chat_id || this.createPrivateChatId(row.from_user_id, row.to_user_id),
      from: row.from_user_id,
      fromName: row.sender_name || null,
      to: row.to_user_id || null,
      groupId: row.group_id || null,
      text: row.content || '',
      type: row.type || 'text',
      fileData: row.file_data || null,
      timestamp: Number(row.timestamp),
      status: row.status || 'sent',
      deliveredAt: row.delivered_at ? Number(row.delivered_at) : null,
      seenAt: row.seen_at ? Number(row.seen_at) : null,
    };
  }

  createPrivateChatId(userA, userB) {
    if (!userA || !userB) {
      return null;
    }

    return [userA, userB].sort().join('_');
  }

  async saveUser(userId, name, pinHash, dp) {
    return this.run(
      `
        INSERT INTO users (id, name, pin_hash, dp, last_seen)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          pin_hash = excluded.pin_hash,
          dp = excluded.dp,
          last_seen = CURRENT_TIMESTAMP
      `,
      [userId, name, pinHash, dp]
    );
  }

  async getUser(userId) {
    return this.get('SELECT * FROM users WHERE id = ?', [userId]);
  }

  async updateLastSeen(userId) {
    return this.run('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
  }

  async listUsers() {
    return this.all('SELECT * FROM users ORDER BY name COLLATE NOCASE ASC');
  }

  async saveMessage(message) {
    const payload = {
      id: message.id,
      chatId: message.chatId || this.createPrivateChatId(message.from, message.to),
      from: message.from,
      fromName: message.fromName || null,
      to: message.to || null,
      groupId: message.groupId || null,
      text: message.text || '',
      type: message.type || 'text',
      fileData: message.fileData || null,
      encrypted: message.encrypted ? 1 : 0,
      status: message.status || 'sent',
      timestamp: Number(message.timestamp || Date.now()),
      deliveredAt: message.deliveredAt || null,
      seenAt: message.seenAt || null,
    };

    await this.run(
      `
        INSERT INTO messages (
          id, chat_id, from_user_id, to_user_id, group_id, content, type, file_data,
          sender_name, encrypted, status, timestamp, delivered_at, seen_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          chat_id = excluded.chat_id,
          to_user_id = excluded.to_user_id,
          group_id = excluded.group_id,
          content = excluded.content,
          type = excluded.type,
          file_data = excluded.file_data,
          sender_name = COALESCE(excluded.sender_name, messages.sender_name),
          encrypted = excluded.encrypted,
          status = excluded.status,
          timestamp = excluded.timestamp,
          delivered_at = COALESCE(excluded.delivered_at, messages.delivered_at),
          seen_at = COALESCE(excluded.seen_at, messages.seen_at)
      `,
      [
        payload.id,
        payload.chatId,
        payload.from,
        payload.to,
        payload.groupId,
        payload.text,
        payload.type,
        payload.fileData,
        payload.fromName,
        payload.encrypted,
        payload.status,
        payload.timestamp,
        payload.deliveredAt,
        payload.seenAt,
      ]
    );

    return payload;
  }

  async getMessage(messageId) {
    const row = await this.get('SELECT * FROM messages WHERE id = ?', [messageId]);
    return this.mapMessageRow(row);
  }

  async updateMessageStatus(messageId, status, timestamps = {}) {
    const current = await this.get('SELECT delivered_at, seen_at FROM messages WHERE id = ?', [messageId]);
    const deliveredAt = timestamps.deliveredAt ?? current?.delivered_at ?? null;
    const seenAt = timestamps.seenAt ?? current?.seen_at ?? null;

    await this.run(
      'UPDATE messages SET status = ?, delivered_at = ?, seen_at = ? WHERE id = ?',
      [status, deliveredAt, seenAt, messageId]
    );

    return this.getMessage(messageId);
  }

  async upsertDeliveryStatus(messageId, recipientId, status, timestamps = {}) {
    await this.run(
      `
        INSERT INTO message_delivery (id, message_id, recipient_id, status, delivered_at, read_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(message_id, recipient_id) DO UPDATE SET
          status = excluded.status,
          delivered_at = COALESCE(excluded.delivered_at, message_delivery.delivered_at),
          read_at = COALESCE(excluded.read_at, message_delivery.read_at)
      `,
      [
        this.generateId(),
        messageId,
        recipientId,
        status,
        timestamps.deliveredAt || null,
        timestamps.readAt || null,
      ]
    );
  }

  async markMessageDelivered(messageId, recipientId, deliveredAt = Date.now()) {
    await this.upsertDeliveryStatus(messageId, recipientId, 'delivered', { deliveredAt });
    return this.updateMessageStatus(messageId, 'delivered', { deliveredAt });
  }

  async markMessageSeen(messageId, recipientId, seenAt = Date.now()) {
    await this.upsertDeliveryStatus(messageId, recipientId, 'seen', { readAt: seenAt });
    return this.updateMessageStatus(messageId, 'seen', { seenAt });
  }

  async getPrivateMessages(userId, otherUserId, limit = 200) {
    const rows = await this.all(
      `
        SELECT *
        FROM messages
        WHERE group_id IS NULL
          AND (
            (from_user_id = ? AND to_user_id = ?)
            OR (from_user_id = ? AND to_user_id = ?)
          )
        ORDER BY timestamp ASC
        LIMIT ?
      `,
      [userId, otherUserId, otherUserId, userId, limit]
    );

    return rows.map((row) => this.mapMessageRow(row));
  }

  async getGroupMessages(groupId, limit = 200) {
    const rows = await this.all(
      `
        SELECT *
        FROM messages
        WHERE group_id = ?
        ORDER BY timestamp ASC
        LIMIT ?
      `,
      [groupId, limit]
    );

    return rows.map((row) => this.mapMessageRow(row));
  }

  async queueMessage(messageId, recipientId, eventType = 'private_message') {
    return this.run(
      `
        INSERT INTO message_queue (id, message_id, recipient_id, event_type, queued_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(message_id, recipient_id) DO UPDATE SET
          event_type = excluded.event_type,
          queued_at = excluded.queued_at
      `,
      [this.generateId(), messageId, recipientId, eventType, Date.now()]
    );
  }

  async getQueuedMessages(recipientId) {
    return this.all(
      `
        SELECT q.message_id, q.recipient_id, q.event_type, q.attempts
        FROM message_queue q
        WHERE q.recipient_id = ?
        ORDER BY q.queued_at ASC
      `,
      [recipientId]
    );
  }

  async removeFromQueue(messageId, recipientId) {
    return this.run('DELETE FROM message_queue WHERE message_id = ? AND recipient_id = ?', [messageId, recipientId]);
  }

  async incrementQueueAttempts(messageId, recipientId) {
    return this.run(
      'UPDATE message_queue SET attempts = attempts + 1 WHERE message_id = ? AND recipient_id = ?',
      [messageId, recipientId]
    );
  }

  async saveGroup(group) {
    const secretKey = group.secretKey || Math.random().toString(36).slice(2, 8).toUpperCase();
    await this.run(
      `
        INSERT INTO groups_table (id, name, created_by, secret_key, is_public)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          created_by = excluded.created_by,
          secret_key = excluded.secret_key,
          is_public = excluded.is_public
      `,
      [group.id, group.name, group.createdBy, secretKey, group.isPublic ? 1 : 0]
    );

    const memberIds = Array.from(new Set(group.members || []));
    for (const memberId of memberIds) {
      await this.addGroupMember(group.id, memberId);
    }

    return this.getGroup(group.id);
  }

  async getGroup(groupId) {
    const group = await this.get('SELECT * FROM groups_table WHERE id = ?', [groupId]);
    if (!group) {
      return null;
    }

    const members = await this.getGroupMembers(groupId);
    return {
      id: group.id,
      name: group.name,
      createdBy: group.created_by,
      secretKey: group.secret_key,
      isPublic: Boolean(group.is_public),
      members,
      createdAt: group.created_at,
    };
  }

  async getGroupBySecretKey(secretKey) {
    const group = await this.get('SELECT * FROM groups_table WHERE secret_key = ?', [secretKey]);
    return group ? this.getGroup(group.id) : null;
  }

  async addGroupMember(groupId, userId) {
    return this.run(
      `
        INSERT INTO group_members (id, group_id, user_id)
        VALUES (?, ?, ?)
        ON CONFLICT(group_id, user_id) DO NOTHING
      `,
      [this.generateId(), groupId, userId]
    );
  }

  async getGroupMembers(groupId) {
    const rows = await this.all('SELECT user_id FROM group_members WHERE group_id = ? ORDER BY joined_at ASC', [groupId]);
    return rows.map((row) => row.user_id);
  }

  async getGroupsForUser(userId) {
    const rows = await this.all(
      `
        SELECT DISTINCT g.id
        FROM groups_table g
        INNER JOIN group_members gm ON gm.group_id = g.id
        WHERE gm.user_id = ?
        ORDER BY g.created_at DESC
      `,
      [userId]
    );

    const groups = await Promise.all(rows.map((row) => this.getGroup(row.id)));
    return groups.filter(Boolean);
  }

  async getPublicGroups(excludedUserId = null) {
    const rows = await this.all(
      `
        SELECT id
        FROM groups_table
        WHERE is_public = 1
        ORDER BY created_at DESC
      `
    );

    const groups = await Promise.all(rows.map((row) => this.getGroup(row.id)));
    if (!excludedUserId) {
      return groups.filter(Boolean);
    }

    return groups.filter((group) => group && !group.members.includes(excludedUserId));
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}

module.exports = Database;
