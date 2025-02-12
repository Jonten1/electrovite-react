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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const elksUsername = process.env.REACT_APP_ELKS_USERNAME;
const elksPassword = process.env.REACT_APP_ELKS_PASSWORD;

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
  res.json({ success: true });
});

const activeUsers = new Map(); // Store active users and their last heartbeat

app.post('/heartbeat', (req, res) => {
  const { username } = req.body;
  activeUsers.set(username, Date.now());

  // Clean up inactive users (no heartbeat for more than 30 seconds)
  for (const [user, lastBeat] of activeUsers.entries()) {
    if (Date.now() - lastBeat > 30000) {
      activeUsers.delete(user);
    }
  }

  // Return list of active users
  const activeUsersList = Array.from(activeUsers.keys());
  res.json({ activeUsers: activeUsersList });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
