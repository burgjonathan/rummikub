import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from 'shared';
import { setupSocketHandlers } from './websocket/handlers.js';

const PORT = process.env.PORT || 3001;

const app = express();
const httpServer = createServer(app);

// Build allowed origins for CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
];

// Add production client URL if set
if (process.env.CLIENT_URL) {
  allowedOrigins.push(process.env.CLIENT_URL);
}

const io = new Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Set up WebSocket handlers
setupSocketHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`🎮 Rummikub server running on http://localhost:${PORT}`);
});
