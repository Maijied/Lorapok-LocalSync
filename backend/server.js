const express = require('express');
const http = require('http');
const os = require('os');
const cors = require('cors');
const { Server } = require('socket.io');
const Database = require('./db');
const MessageQueue = require('./messageQueue');
const TokenManager = require('./tokenManager');
const EncryptionManager = require('./encryption');
const { setupSocket } = require('./socketLogic');

const app = express();
const server = http.createServer(app);

const database = new Database();
const messageQueue = new MessageQueue(database);
const tokenManager = new TokenManager();
const encryptionManager = new EncryptionManager();

app.use(cors());
app.use(express.json({ limit: '20mb' }));

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const sanitizeUser = (user) => database.sanitizeUser(user);

const buildServerMeta = (port) => {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  Object.values(interfaces).forEach((networkSet) => {
    (networkSet || []).forEach((entry) => {
      if (entry.family === 'IPv4' && !entry.internal) {
        addresses.push(`http://${entry.address}:${port}`);
      }
    });
  });

  return {
    name: 'Lorapok Communicator',
    port,
    primaryUrl: addresses[0] || `http://localhost:${port}`,
    urls: addresses.length > 0 ? addresses : [`http://localhost:${port}`],
  };
};

app.get('/meta', (req, res) => {
  const port = Number(process.env.PORT || 4000);
  res.json(buildServerMeta(port));
});

app.post('/auth/register', async (req, res) => {
  try {
    const { id, name, pin, dp } = req.body || {};
    if (!id || !name || !pin) {
      return res.status(400).json({ error: 'id, name and pin are required' });
    }

    const pinHash = encryptionManager.hashPIN(pin);
    await database.saveUser(id, name, pinHash, dp || '');

    const user = await database.getUser(id);
    const safeUser = sanitizeUser(user);

    return res.json({
      user: safeUser,
      accessToken: tokenManager.generateAccessToken(id, safeUser),
      refreshToken: tokenManager.generateRefreshToken(id),
    });
  } catch (error) {
    console.error('Register failed:', error);
    return res.status(500).json({ error: 'Failed to register user' });
  }
});

app.post('/auth/unlock', async (req, res) => {
  try {
    const { id, pin } = req.body || {};
    if (!id || !pin) {
      return res.status(400).json({ error: 'id and pin are required' });
    }

    const user = await database.getUser(id);
    if (!user || !encryptionManager.verifyPIN(pin, user.pin_hash)) {
      return res.status(401).json({ error: 'Invalid PIN' });
    }

    const safeUser = sanitizeUser(user);
    return res.json({
      user: safeUser,
      accessToken: tokenManager.generateAccessToken(id, safeUser),
      refreshToken: tokenManager.generateRefreshToken(id),
    });
  } catch (error) {
    console.error('Unlock failed:', error);
    return res.status(500).json({ error: 'Failed to unlock user' });
  }
});

app.post('/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(400).json({ error: 'refreshToken is required' });
    }

    const decoded = tokenManager.verifyRefreshToken(refreshToken);
    if (!decoded?.userId) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const user = await database.getUser(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const safeUser = sanitizeUser(user);
    return res.json({
      user: safeUser,
      accessToken: tokenManager.generateAccessToken(decoded.userId, safeUser),
    });
  } catch (error) {
    console.error('Refresh failed:', error);
    return res.status(500).json({ error: 'Failed to refresh token' });
  }
});

setupSocket(io, database, messageQueue, tokenManager);

const PORT = Number(process.env.PORT || 4000);
server.listen(PORT, '0.0.0.0', () => {
  const meta = buildServerMeta(PORT);
  console.log(`Lorapok Communicator server is running on port ${PORT}`);
  console.log(`Primary URL: ${meta.primaryUrl}`);
  console.log(`Database: ${require('path').join(__dirname, 'lorapok.db')}`);
});

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await database.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
