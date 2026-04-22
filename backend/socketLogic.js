export const setupSocket = (io) => {
  // Store connected users (socketId -> userData)
  const connectedUsers = new Map();

  // Store public groups in memory
  const publicGroups = new Map();

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // User registers their presence
    socket.on('register', (userData) => {
      // userData now includes { id, name, dp }
      connectedUsers.set(socket.id, userData);
      io.emit('users_update', Array.from(connectedUsers.values()));
      socket.emit('public_groups_update', Array.from(publicGroups.values()));
      console.log('User registered:', userData.name);
    });

    // Handle private messages
    socket.on('private_message', (data) => {
      const recipientSocket = Array.from(connectedUsers.entries()).find(([id, user]) => user.id === data.to);
      if (recipientSocket) {
        io.to(recipientSocket[0]).emit('private_message', data);
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

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      connectedUsers.delete(socket.id);
      io.emit('users_update', Array.from(connectedUsers.values()));
    });
  });
};
