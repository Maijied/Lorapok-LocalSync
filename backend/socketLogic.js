const setupSocket = (io, database, messageQueue, encryptionManager) => {
  // Store connected users (socketId -> userData)
  const connectedUsers = new Map(); // socketId -> userData
  const userSocketMap = new Map(); // userId -> socketId (for quick lookup)

  // Store public groups in memory
  const publicGroups = new Map();

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // User registers their presence
    socket.on('register', async (userData) => {
      // userData now includes { id, name, dp }
      connectedUsers.set(socket.id, userData);
      userSocketMap.set(userData.id, socket.id);

      // Save/update user in database
      if (database) {
        try {
          const pinHash = encryptionManager ? encryptionManager.hashPIN(userData.pin || 'default') : (userData.pin || 'default');
          await database.saveUser(userData.id, userData.name, pinHash, userData.dp);
          await database.updateLastSeen(userData.id);
        } catch (error) {
          console.error('Error saving user to database:', error);
        }
      }

      // Deliver queued messages to this user
      if (messageQueue && database) {
        try {
          const queuedMessages = await messageQueue.deliverQueuedMessages(userData.id, socket);
          if (queuedMessages.length > 0) {
            console.log(`Delivered ${queuedMessages.length} queued messages to ${userData.name}`);
          }
        } catch (error) {
          console.error('Error delivering queued messages:', error);
        }
      }

      io.emit('users_update', Array.from(connectedUsers.values()));
      socket.emit('public_groups_update', Array.from(publicGroups.values()));
      console.log('User registered:', userData.name);
    });

    // Handle private messages
    socket.on('private_message', async (data) => {
      // Save message to database
      if (database) {
        try {
          await database.saveMessage({
            id: data.id,
            from: data.from,
            to: data.to,
            groupId: null,
            content: data.text,
            encrypted: data.encrypted || false,
            status: 'sent',
            timestamp: data.timestamp
          });
        } catch (error) {
          console.error('Error saving message to database:', error);
        }
      }

      // Find recipient
      const recipientSocketId = userSocketMap.get(data.to);

      if (recipientSocketId) {
        // Recipient is online - send immediately
        io.to(recipientSocketId).emit('private_message', data);

        // Mark as delivered in database
        if (database) {
          try {
            await database.updateMessageStatus(data.id, 'delivered');
            await database.saveDeliveryStatus(data.id, data.to, 'delivered');
          } catch (error) {
            console.error('Error updating delivery status:', error);
          }
        }
      } else {
        // Recipient is offline - queue for delivery
        if (messageQueue) {
          await messageQueue.queueForOfflineDelivery(data, data.to);
        }
      }
    });

    // Typing Indicators
    socket.on('typing_start', (data) => {
      // data: { to: recipientId, groupId: groupId }
      if (data.groupId) {
        socket.to(data.groupId).emit('typing_start', {
          userId: connectedUsers.get(socket.id)?.id,
          groupId: data.groupId
        });
      } else if (data.to) {
        const recipientSocketId = userSocketMap.get(data.to);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('typing_start', {
            userId: connectedUsers.get(socket.id)?.id
          });
        }
      }
    });

    socket.on('typing_stop', (data) => {
      // data: { to: recipientId, groupId: groupId }
      if (data.groupId) {
        socket.to(data.groupId).emit('typing_stop', {
          userId: connectedUsers.get(socket.id)?.id,
          groupId: data.groupId
        });
      } else if (data.to) {
        const recipientSocketId = userSocketMap.get(data.to);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('typing_stop', {
            userId: connectedUsers.get(socket.id)?.id
          });
        }
      }
    });

    // Read Receipts
    socket.on('message_read', async (data) => {
      // data: { messageId: id, from: senderId }
      if (database) {
        try {
          await database.updateMessageStatus(data.messageId, 'seen');
          await database.updateReadStatus(data.messageId, connectedUsers.get(socket.id)?.id);
        } catch (error) {
          console.error('Error updating read status:', error);
        }
      }

      // Notify the original sender
      const senderSocketId = userSocketMap.get(data.from);
      if (senderSocketId) {
        io.to(senderSocketId).emit('message_status_update', {
          messageId: data.messageId,
          status: 'seen'
        });
      }
    });

    // WebRTC Signaling
    socket.on('offer', (data) => {
      const recipientSocket = Array.from(connectedUsers.entries()).find(([id, user]) => user.id === data.to);
      if (recipientSocket) {
        io.to(recipientSocket[0]).emit('offer', data);
      }
    });

    socket.on('answer', (data) => {
      const recipientSocket = Array.from(connectedUsers.entries()).find(([id, user]) => user.id === data.to);
      if (recipientSocket) {
        io.to(recipientSocket[0]).emit('answer', data);
      }
    });

    socket.on('ice-candidate', (data) => {
      const recipientSocket = Array.from(connectedUsers.entries()).find(([id, user]) => user.id === data.to);
      if (recipientSocket) {
        io.to(recipientSocket[0]).emit('ice-candidate', data);
      }
    });
    // Group Chat Signaling
    socket.on('create_group', (groupData) => {
      // Generate a 6-char secret key if not present
      const secretKey = Math.random().toString(36).substring(2, 8).toUpperCase();
      const enrichedGroup = { ...groupData, secretKey };
      
      socket.join(enrichedGroup.id);
      
      if (enrichedGroup.isPublic) {
        publicGroups.set(enrichedGroup.id, enrichedGroup);
        io.emit('public_groups_update', Array.from(publicGroups.values()));
      }
      
      // Notify all initial members to join
      enrichedGroup.members.forEach(memberId => {
        const memberSocket = Array.from(connectedUsers.entries()).find(([id, user]) => user.id === memberId);
        if (memberSocket) {
          io.to(memberSocket[0]).emit('group_created', enrichedGroup);
        }
      });
    });

    socket.on('join_group_with_key', (secretKey) => {
      const group = Array.from(publicGroups.values()).find(g => g.secretKey === secretKey);
      if (group) {
        socket.join(group.id);
        socket.emit('group_created', group);
      } else {
        socket.emit('error', 'Invalid Group Key');
      }
    });

    socket.on('send_group_invite', (data) => {
      // data: { toUserId, group }
      const recipientSocket = Array.from(connectedUsers.entries()).find(([id, user]) => user.id === data.toUserId);
      if (recipientSocket) {
        io.to(recipientSocket[0]).emit('group_invite', {
          from: connectedUsers.get(socket.id),
          group: data.group
        });
      }
    });

    socket.on('join_group', (groupId) => {
      socket.join(groupId);
    });

    socket.on('join_public_group', (data) => {
      const group = publicGroups.get(data.groupId);
      if (group && !group.members.includes(data.user.id)) {
        group.members.push(data.user.id);
        publicGroups.set(data.groupId, group);
        
        socket.join(data.groupId);
        socket.emit('group_created', group); // Tell the user they joined
        io.emit('public_groups_update', Array.from(publicGroups.values()));
      }
    });

    socket.on('group_message', (data) => {
      socket.to(data.groupId).emit('group_message', data);
    });

    socket.on('disconnect', async () => {
      const userData = connectedUsers.get(socket.id);
      console.log('User disconnected:', socket.id);

      // Update last seen in database
      if (userData && database) {
        try {
          await database.updateLastSeen(userData.id);
        } catch (error) {
          console.error('Error updating last seen:', error);
        }
      }

      connectedUsers.delete(socket.id);
      if (userData) {
        userSocketMap.delete(userData.id);
      }
      io.emit('users_update', Array.from(connectedUsers.values()));
    });
  });
};

module.exports = { setupSocket };

