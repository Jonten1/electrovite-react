import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import mongoose from 'mongoose';
import axios from 'axios';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { WebSocketServer } from 'ws';
import http from 'http';

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

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.get('/numbers', async (req, res) => {
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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
