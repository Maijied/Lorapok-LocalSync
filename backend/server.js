const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "*", // allow all origins on local network
    methods: ["GET", "POST"]
  }
});

// Store connected users (socketId -> userData)
const connectedUsers = new Map();

// Store public groups in memory
const publicGroups = new Map();

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // User registers their presence
  socket.on('register', (userData) => {
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
    // groupData: { id, name, members: [userId1, userId2...], isPublic: boolean }
    socket.join(groupData.id);
    
    if (groupData.isPublic) {
      publicGroups.set(groupData.id, groupData);
      io.emit('public_groups_update', Array.from(publicGroups.values()));
    }
    
    // Notify all initial members to join the group
    groupData.members.forEach(memberId => {
      const memberSocket = Array.from(connectedUsers.entries()).find(([id, user]) => user.id === memberId);
      if (memberSocket) {
        io.to(memberSocket[0]).emit('group_created', groupData);
      }
    });
  });

  socket.on('join_group', (groupId) => {
    socket.join(groupId);
  });

  socket.on('join_public_group', (data) => {
    // data: { groupId, user }
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

// Start server on all network interfaces to be accessible via Router IP
const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
