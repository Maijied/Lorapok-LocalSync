const normalizePrivateMessage = (database, senderId, payload) => ({
  id: payload.id,
  chatId: payload.chatId || database.createPrivateChatId(senderId, payload.to),
  from: senderId,
  fromName: payload.fromName || null,
  to: payload.to,
  text: payload.text || '',
  type: payload.type || 'text',
  fileData: payload.fileData || null,
  timestamp: Number(payload.timestamp || Date.now()),
  status: payload.status || 'pending',
});

const normalizeGroupMessage = (payload, senderId) => ({
  id: payload.id,
  chatId: payload.chatId || payload.groupId,
  from: senderId,
  fromName: payload.fromName || null,
  to: null,
  groupId: payload.groupId,
  text: payload.text || '',
  type: payload.type || 'text',
  fileData: payload.fileData || null,
  timestamp: Number(payload.timestamp || Date.now()),
  status: payload.status || 'pending',
});

const generateGroupKey = () => Math.random().toString(36).slice(2, 8).toUpperCase();

const setupSocket = (io, database, messageQueue, tokenManager) => {
  const connectedUsers = new Map();
  const userSocketMap = new Map();
  const typingBySocket = new Map();
  const activeCalls = new Set();

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('AUTH_REQUIRED'));
    }

    const decoded = tokenManager.verifyAccessToken(token);
    if (!decoded?.userId) {
      return next(new Error('AUTH_INVALID'));
    }

    try {
      const user = await database.getUser(decoded.userId);
      if (!user) {
        return next(new Error('AUTH_USER_MISSING'));
      }

      socket.user = database.sanitizeUser(user);
      return next();
    } catch (error) {
      console.error('Socket auth failed:', error);
      return next(new Error('AUTH_FAILED'));
    }
  });

  const emitUsersUpdate = () => {
    io.emit('users_update', Array.from(connectedUsers.values()));
  };

  const emitPublicGroupsUpdate = async () => {
    const publicGroups = await database.getPublicGroups();
    io.emit('public_groups_update', publicGroups);
  };

  const emitStoppedTyping = (socket) => {
    const typing = typingBySocket.get(socket.id);
    if (!typing) {
      return;
    }

    if (typing.to) {
      const recipientSocketId = userSocketMap.get(typing.to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('user_stopped_typing', {
          from: socket.user.id,
          to: typing.to,
        });
      }
    }

    if (typing.groupId) {
      socket.to(typing.groupId).emit('user_stopped_typing', {
        from: socket.user.id,
        groupId: typing.groupId,
      });
    }

    typingBySocket.delete(socket.id);
  };

  io.on('connection', async (socket) => {
    const user = socket.user;
    connectedUsers.set(socket.id, user);
    userSocketMap.set(user.id, socket.id);

    await database.updateLastSeen(user.id);

    const groups = await database.getGroupsForUser(user.id);
    groups.forEach((group) => socket.join(group.id));

    socket.emit('session_ready', {
      user,
      groups,
      publicGroups: await database.getPublicGroups(user.id),
    });

    emitUsersUpdate();
    await emitPublicGroupsUpdate();
    await messageQueue.deliverQueuedMessages(user.id, socket, io, { userSocketMap });

    socket.on('sync_private_history', async (payload = {}) => {
      if (!payload.withUserId) {
        return;
      }

      const messages = await database.getPrivateMessages(user.id, payload.withUserId);
      socket.emit('sync_private_history', {
        withUserId: payload.withUserId,
        chatId: database.createPrivateChatId(user.id, payload.withUserId),
        messages,
      });
    });

    socket.on('sync_group_history', async (payload = {}) => {
      if (!payload.groupId) {
        return;
      }

      const group = await database.getGroup(payload.groupId);
      if (!group || !group.members.includes(user.id)) {
        return;
      }

      socket.join(group.id);
      const messages = await database.getGroupMessages(payload.groupId);
      socket.emit('sync_group_history', {
        groupId: payload.groupId,
        messages,
      });
    });

    socket.on('private_message', async (payload) => {
      if (!payload?.id || !payload?.to) {
        return;
      }

      const message = normalizePrivateMessage(database, user.id, { ...payload, fromName: user.name });
      await database.saveMessage({ ...message, status: 'sent' });
      await database.upsertDeliveryStatus(message.id, message.to, 'sent');

      socket.emit('message_delivered', {
        messageId: message.id,
        status: 'sent',
        timestamp: message.timestamp,
      });

      const recipientSocketId = userSocketMap.get(message.to);
      if (recipientSocketId) {
        const deliveredMessage = await database.markMessageDelivered(message.id, message.to, Date.now());
        io.to(recipientSocketId).emit('private_message', deliveredMessage || { ...message, status: 'delivered' });
        socket.emit('message_delivered', {
          messageId: message.id,
          status: 'delivered',
          timestamp: deliveredMessage.deliveredAt,
        });
      } else {
        await messageQueue.queueForOfflineDelivery(message, message.to, 'private_message');
      }
    });

    socket.on('message_read', async (payload) => {
      if (!payload?.messageId || !payload?.from) {
        return;
      }

      const updated = await database.markMessageSeen(payload.messageId, user.id, Date.now());
      const senderSocketId = userSocketMap.get(payload.from);

      if (senderSocketId) {
        io.to(senderSocketId).emit('message_read', {
          messageId: payload.messageId,
          status: 'seen',
          timestamp: updated?.seenAt || Date.now(),
        });
      }
    });

    socket.on('user_typing', (payload = {}) => {
      const event = {
        from: user.id,
        fromName: user.name,
        to: payload.to || null,
        groupId: payload.groupId || null,
      };

      typingBySocket.set(socket.id, event);

      if (payload.to) {
        const recipientSocketId = userSocketMap.get(payload.to);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('user_typing', event);
        }
      }

      if (payload.groupId) {
        socket.to(payload.groupId).emit('user_typing', event);
      }
    });

    socket.on('user_stopped_typing', () => {
      emitStoppedTyping(socket);
    });

    socket.on('create_group', async (payload) => {
      const group = await database.saveGroup({
        id: payload.id,
        name: payload.name,
        createdBy: user.id,
        isPublic: Boolean(payload.isPublic),
        secretKey: payload.secretKey || generateGroupKey(),
        members: Array.from(new Set([user.id, ...(payload.members || [])])),
      });

      for (const memberId of group.members) {
        const memberSocketId = userSocketMap.get(memberId);
        if (memberSocketId) {
          io.to(memberSocketId).emit('group_created', group);
          io.sockets.sockets.get(memberSocketId)?.join(group.id);
        }
      }

      await emitPublicGroupsUpdate();
    });

    socket.on('join_group_with_key', async (secretKey) => {
      const group = await database.getGroupBySecretKey((secretKey || '').toUpperCase());
      if (!group) {
        socket.emit('error', 'Invalid group key');
        return;
      }

      await database.addGroupMember(group.id, user.id);
      const updatedGroup = await database.getGroup(group.id);
      socket.join(updatedGroup.id);
      socket.emit('group_created', updatedGroup);
      await emitPublicGroupsUpdate();
    });

    socket.on('join_group', async (groupId) => {
      const group = await database.getGroup(groupId);
      if (!group || !group.members.includes(user.id)) {
        return;
      }

      socket.join(groupId);
      socket.emit('group_created', group);
    });

    socket.on('join_public_group', async (payload = {}) => {
      const group = await database.getGroup(payload.groupId);
      if (!group || !group.isPublic) {
        return;
      }

      await database.addGroupMember(group.id, user.id);
      const updatedGroup = await database.getGroup(group.id);
      socket.join(group.id);
      socket.emit('group_created', updatedGroup);
      await emitPublicGroupsUpdate();
    });

    socket.on('send_group_invite', (payload) => {
      const recipientSocketId = userSocketMap.get(payload?.toUserId);
      if (!recipientSocketId) {
        return;
      }

      io.to(recipientSocketId).emit('group_invite', {
        from: user,
        group: payload.group,
      });
    });

    socket.on('group_message', async (payload) => {
      if (!payload?.id || !payload?.groupId) {
        return;
      }

      const group = await database.getGroup(payload.groupId);
      if (!group || !group.members.includes(user.id)) {
        return;
      }

      const message = normalizeGroupMessage({ ...payload, fromName: user.name }, user.id);
      await database.saveMessage({ ...message, status: 'sent' });

      socket.emit('message_delivered', {
        messageId: message.id,
        status: 'sent',
        timestamp: message.timestamp,
      });

      const delivery = await messageQueue.sendGroupMessage(message, group.members, userSocketMap, io);
      if (delivery.deliveredTo.length > 0) {
        const updated = await database.updateMessageStatus(message.id, 'delivered', { deliveredAt: Date.now() });
        socket.emit('message_delivered', {
          messageId: message.id,
          status: 'delivered',
          timestamp: updated?.deliveredAt || Date.now(),
        });
      }
    });

    socket.on('offer', (payload) => {
      const recipientSocketId = userSocketMap.get(payload?.to);
      if (!recipientSocketId) {
        socket.emit('call_unavailable', { to: payload?.to });
        return;
      }

      if (activeCalls.has(user.id) || activeCalls.has(payload.to)) {
        socket.emit('call_busy', { to: payload.to });
        return;
      }

      activeCalls.add(user.id);
      activeCalls.add(payload.to);
      io.to(recipientSocketId).emit('offer', { ...payload, fromUser: user });
    });

    socket.on('answer', (payload) => {
      const recipientSocketId = userSocketMap.get(payload?.to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('answer', payload);
      }
    });

    socket.on('ice-candidate', (payload) => {
      const recipientSocketId = userSocketMap.get(payload?.to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('ice-candidate', payload);
      }
    });

    socket.on('call_end', (payload) => {
      activeCalls.delete(user.id);
      if (payload?.to) {
        activeCalls.delete(payload.to);
        const recipientSocketId = userSocketMap.get(payload.to);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('call_ended', { from: user.id });
        }
      }
    });

    socket.on('disconnect', async () => {
      emitStoppedTyping(socket);
      activeCalls.delete(user.id);

      connectedUsers.delete(socket.id);
      if (userSocketMap.get(user.id) === socket.id) {
        userSocketMap.delete(user.id);
      }

      await database.updateLastSeen(user.id);
      emitUsersUpdate();
    });
  });
};

module.exports = { setupSocket };
