import express from 'express';
import { createServer } from 'http';
import { existsSync } from 'fs';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from 'shared';
import { setupSocketHandlers } from './websocket/handlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

const app = express();
const httpServer = createServer(app);

// Build allowed origins for CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://burgjonathan.github.io',
];

// Add production client URL if set
if (process.env.CLIENT_URL) {
  allowedOrigins.push(process.env.CLIENT_URL);
}

console.log('Allowed CORS origins:', allowedOrigins);

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

// Serve static client files in production
if (isProduction) {
  const clientDistPath = join(__dirname, '../../client/dist');
  
  if (existsSync(clientDistPath)) {
    // Serve static assets
    app.use(express.static(clientDistPath));
    
    // SPA fallback - serve index.html for all non-API routes
    app.get('*', (req, res) => {
      res.sendFile(join(clientDistPath, 'index.html'));
    });
    
    console.log(`📁 Serving static files from ${clientDistPath}`);
  } else {
    console.warn(`⚠️ Client dist not found at ${clientDistPath}`);
  }
}

// Set up WebSocket handlers
setupSocketHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`🎮 Rummikub server running on http://localhost:${PORT}`);
});
