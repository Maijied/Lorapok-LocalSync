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

    socket.on('end_call', (data) => {
      const recipientSocket = Array.from(connectedUsers.entries()).find(([id, user]) => user.id === data.to);
      if (recipientSocket) {
        io.to(recipientSocket[0]).emit('end_call', data);
      }
    });

    socket.on('reject_call', (data) => {
      const recipientSocket = Array.from(connectedUsers.entries()).find(([id, user]) => user.id === data.to);
      if (recipientSocket) {
        io.to(recipientSocket[0]).emit('reject_call', data);
      }
    });

    socket.on('call_log', async (data) => {
      // data: { id, from, to, text, type: 'call-log', timestamp }
      if (database) {
        try {
          await database.saveMessage({
            id: data.id,
            from: data.from,
            to: data.to,
            groupId: null,
            content: data.text,
            encrypted: false,
            status: 'sent',
            timestamp: data.timestamp
          });
        } catch (e) {
          console.error('Error saving call log:', e);
        }
      }
      
      // Notify recipient if online so they see the log
      const recipientSocketId = userSocketMap.get(data.to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('private_message', data);
      }
    });
    // Group Chat Signaling
    socket.on('create_group', async (groupData) => {
      // Generate a 6-char secret key if not present
      const secretKey = Math.random().toString(36).substring(2, 8).toUpperCase();
      const enrichedGroup = { ...groupData, secretKey };
      
      socket.join(enrichedGroup.id);
      
      // Save to database
      if (database) {
        try {
          await database.saveGroup(enrichedGroup.id, enrichedGroup.name, enrichedGroup.createdBy, secretKey, enrichedGroup.isPublic);
          for (const memberId of enrichedGroup.members) {
            await database.addGroupMember(enrichedGroup.id, memberId);
          }
        } catch (error) {
          console.error('Error saving group to database:', error);
        }
      }

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

    socket.on('join_group_with_key', async (secretKey) => {
      let group = Array.from(publicGroups.values()).find(g => g.secretKey === secretKey);
      
      if (!group && database) {
        // Try searching in database
        try {
          const dbGroup = await database.getGroupBySecretKey(secretKey);
          if (dbGroup) {
            const members = await database.getGroupMembers(dbGroup.id);
            group = {
              id: dbGroup.id,
              name: dbGroup.name,
              members: members.map(m => m.user_id),
              createdBy: dbGroup.created_by,
              isPublic: dbGroup.is_public === 1,
              secretKey: dbGroup.secret_key
            };
          }
        } catch (e) {}
      }

      if (group) {
        const userId = connectedUsers.get(socket.id)?.id;
        if (userId && !group.members.includes(userId)) {
          group.members.push(userId);
          if (database) await database.addGroupMember(group.id, userId);
        }

        socket.join(group.id);
        socket.emit('group_created', group);
        
        // Send chat history
        if (database) {
          const history = await database.getGroupMessages(group.id, 50);
          socket.emit('group_history', { groupId: group.id, messages: history.reverse() });
        }
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

    socket.on('join_group', async (groupId) => {
      socket.join(groupId);
      // Optional: Send history on rejoin
      if (database) {
        const history = await database.getGroupMessages(groupId, 50);
        socket.emit('group_history', { groupId, messages: history.reverse() });
      }
    });

    socket.on('join_public_group', async (data) => {
      const group = publicGroups.get(data.groupId);
      if (group && !group.members.includes(data.user.id)) {
        group.members.push(data.user.id);
        publicGroups.set(data.groupId, group);
        
        if (database) await database.addGroupMember(data.groupId, data.user.id);

        socket.join(data.groupId);
        socket.emit('group_created', group); // Tell the user they joined
        io.emit('public_groups_update', Array.from(publicGroups.values()));

        // Send chat history
        if (database) {
          const history = await database.getGroupMessages(data.groupId, 50);
          socket.emit('group_history', { groupId: data.groupId, messages: history.reverse() });
        }
      }
    });

    socket.on('group_message', async (data) => {
      socket.to(data.groupId).emit('group_message', data);
      // Save to database
      if (database) {
        try {
          await database.saveMessage({
            id: data.id,
            from: data.from,
            to: null,
            groupId: data.groupId,
            content: data.text,
            encrypted: data.encrypted || false,
            status: 'sent',
            timestamp: data.timestamp
          });
        } catch (e) {}
      }
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

