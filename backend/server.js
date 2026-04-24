const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Database = require('./db');
const MessageQueue = require('./messageQueue');
const { setupSocket } = require('./socketLogic');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Initialize database
const database = new Database();

// Initialize message queue
const messageQueue = new MessageQueue(database);

// Setup socket with database and message queue
setupSocket(io, database, messageQueue);

// Retry failed deliveries every 10 seconds
setInterval(async () => {
  try {
    // Placeholder for retry logic
    // This would retry pending messages to reconnected users
  } catch (error) {
    console.error('Error in retry interval:', error);
  }
}, 10000);

// Start server on all network interfaces to be accessible via Router IP
const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Database: ${require('path').join(__dirname, 'lorapok.db')}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await database.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
