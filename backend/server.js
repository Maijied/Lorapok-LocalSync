const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const Database = require('./db');
const MessageQueue = require('./messageQueue');
const TokenManager = require('./tokenManager');
const EncryptionManager = require('./encryption');
const { setupSocket } = require('./socketLogic');
const { scheduleBackups } = require('./backup');
const DiscoveryService = require('./discovery');

const app = express();
const server = http.createServer(app);

// Start Discovery Service
const discovery = new DiscoveryService();
discovery.start();

app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

app.use('/uploads', express.static(require('path').join(__dirname, 'uploads')));

const uploadRoute = require('./upload');
app.use('/api/upload', uploadRoute);

app.get('/api/link-preview', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const axios = require('axios');
    const response = await axios.get(url, { timeout: 3000 });
    const html = response.data;
    
    const title = html.match(/<title>(.*?)<\/title>/i)?.[1] || url;
    const description = html.match(/<meta name="description" content="(.*?)"/i)?.[1] || '';
    const image = html.match(/<meta property="og:image" content="(.*?)"/i)?.[1] || '';

    res.json({ title, description, image, url });
  } catch (error) {
    res.json({ title: url, description: '', image: '', url });
  }
});

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

// Initialize token manager
const tokenManager = new TokenManager();

// Initialize encryption manager
const encryptionManager = new EncryptionManager();

// Setup socket with database and message queue
setupSocket(io, database, messageQueue, encryptionManager);

// Schedule daily backups
scheduleBackups();

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
