import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import mongoose from 'mongoose';
import axios from 'axios';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { WebSocketServer } from 'ws';
import http from 'http';
import session from 'express-session';
import WebSocket from 'ws';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const elksUsername = process.env.ELKS_USERNAME;
const elksPassword = process.env.ELKS_PASSWORD;

const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5000',
    'http://localhost:5173', // Your frontend URL
    'http://localhost:5174',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'ngrok-skip-browser-warning',
  ],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

// Apply CORS before other middleware
app.use(cors(corsOptions));

// Add OPTIONS handling for all routes
app.options('*', cors(corsOptions));

// Middleware
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }),
);

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (username && password) {
    req.session.user = { username };
    notifyUsersOnLogin(username);
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

const authenticate = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
};

app.get('/numbers', authenticate, async (req, res) => {
  try {
    if (!elksUsername || !elksPassword) {
      throw new Error('46elks API credentials not configured');
    }

    const authString = Buffer.from(`${elksUsername}:${elksPassword}`).toString(
      'base64',
    );

    const response = await axios.get('https://api.46elks.com/a1/numbers', {
      headers: {
        Authorization: `Basic ${authString}`,
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching numbers:', error);
    res.status(500).json({ message: 'Error fetching numbers' });
  }
});

app.post('/make-call', async (req, res) => {
  try {
    const { phoneNumber, webrtcNumber } = req.body;
    const virtualNumber = process.env.ELKS_NUMBER;
    console.log('elksUsername', elksUsername);
    console.log('elksPassword', elksPassword);

    const authKey = Buffer.from(`${elksUsername}:${elksPassword}`).toString(
      'base64',
    );
    const url = 'https://api.46elks.com/a1/calls';

    // First call the WebRTC number, then connect to the target number
    const data = new URLSearchParams({
      from: virtualNumber,
      to: `+${webrtcNumber}`, // Call our WebRTC client first
      voice_start: JSON.stringify({
        connect: `+${phoneNumber}`, // Then connect to the target number
      }),
    }).toString();

    const config = {
      headers: {
        Authorization: `Basic ${authKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    const response = await axios.post(url, data, config);
    console.log('Outgoing call initiated:', response.data);
    res.json(response.data);
  } catch (error) {
    console.error('Error making outgoing call:', error);
    res.status(500).json({ error: 'Failed to make call' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: 'Failed to logout' });
    } else {
      res.json({ success: true });
    }
  });
});

app.post('/transfer-call', async (req, res) => {
  try {
    const { fromNumber, toNumber } = req.body;
    const virtualNumber = process.env.ELKS_NUMBER;
    const authKey = Buffer.from(`${elksUsername}:${elksPassword}`).toString(
      'base64',
    );

    const url = 'https://api.46elks.com/a1/calls';
    const data = new URLSearchParams({
      from: virtualNumber, // Use virtual number as the caller
      to: `+${toNumber}`, // Call the transfer target
      voice_start: JSON.stringify({
        connect: `+${fromNumber}`, // Connect to the original caller
        timeout: '45', // Add timeout to ensure connection
        busy_no_answer: 'busy', // Handle busy/no answer cases
      }),
    }).toString();

    const config = {
      headers: {
        Authorization: `Basic ${authKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    const response = await axios.post(url, data, config);
    console.log('Call transfer initiated:', response.data);
    res.json(response.data);
  } catch (error) {
    console.error('Error transferring call:', error);
    res.status(500).json({ error: 'Failed to transfer call' });
  }
});

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

const activeUsers = new Map(); // Store active users and their WebSocket connections

// Helper function to log current users
const logActiveUsers = () => {
  console.log('\nCurrently connected users:');
  if (activeUsers.size === 0) {
    console.log('No users connected');
  } else {
    activeUsers.forEach((_, username) => {
      console.log(`- ${username}`);
    });
  }
  console.log(); // Empty line for readability
};

const notifyUsersToReregister = (senderUsername) => {
  activeUsers.forEach((ws, user) => {
    if (user !== senderUsername && ws?.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'reregister',
          from: senderUsername,
          action: 'call_ended',
        }),
      );
      console.log(
        `📢 Notifying ${user} to reregister (triggered by ${senderUsername} - call ended)`,
      );
    }
  });
};

// Add new function for login notifications
const notifyUsersOnLogin = (username) => {
  activeUsers.forEach((ws, user) => {
    if (user !== username && ws?.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'reregister',
          from: username,
          action: 'user_login',
        }),
      );
      console.log(
        `📢 Notifying ${user} to reregister (triggered by ${username} - login)`,
      );
    }
  });
};

// Add periodic reregister function
const broadcastPeriodicReregister = () => {
  console.log('\n⏰ Broadcasting periodic reregister request');
  console.log(activeUsers);
  activeUsers.forEach((ws, username) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'reregister',
          from: 'system',
          action: 'periodic_sync',
        }),
      );
      console.log(`📢 Sending periodic reregister to ${username}`);
    }
  });
  logActiveUsers();
};

// Start periodic reregister (every 3 minutes)
setInterval(broadcastPeriodicReregister, 3 * 60 * 1000);

wss.on('connection', (ws) => {
  let username = '';

  const broadcastUserList = () => {
    const userList = Array.from(activeUsers.keys());
    activeUsers.forEach((clientWs) => {
      if (clientWs?.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            type: 'userList',
            users: userList,
          }),
        );
      }
    });
  };

  ws.on('message', (message) => {
    const data = JSON.parse(message.toString());
    console.log('\n📨 Received WebSocket message:', data);

    if (data.type === 'register') {
      username = data.username;
      activeUsers.set(username, ws);
      console.log(`\n👤 WebSocket connected for user: ${username}`);
      broadcastUserList(); // Broadcast updated user list
      logActiveUsers();
    }

    if (data.type === 'reregister') {
      console.log(`\n📞 Reregister request from ${data.from} - ${data.action}`);
      // Notify all other users to reregister
      activeUsers.forEach((clientWs, user) => {
        if (user !== data.from && clientWs?.readyState === WebSocket.OPEN) {
          clientWs.send(
            JSON.stringify({
              type: 'reregister',
              from: data.from,
              action: data.action,
            }),
          );
          console.log(
            `📢 Notifying ${user} to reregister (triggered by ${data.from} - ${data.action})`,
          );
        }
      });
    }
  });

  ws.on('close', () => {
    if (username) {
      activeUsers.delete(username);
      console.log(`\n🚫 User disconnected: ${username}`);
      broadcastUserList(); // Broadcast updated user list
      logActiveUsers();
    }
  });
});

// Endpoint to get current active users
app.get('/users', (req, res) => {
  const userList = Array.from(activeUsers.keys());
  res.json({ users: userList });
});

app.post('/ping', (req, res) => {
  const { username } = req.body;
  console.log('\n📍 Ping from:', username);

  if (!activeUsers.has(username)) {
    activeUsers.set(username, null);
    console.log(`Added user ${username} to active users`);
  }

  logActiveUsers();
  res.json({ success: true });
});

app.post('/call-ended', (req, res) => {
  const { username } = req.body;
  console.log('\n📞 Call ended by:', username);
  notifyUsersToReregister(username);
  res.json({ success: true });
});

// Start server
server.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log('Waiting for connections...\n');
});

export default app;
