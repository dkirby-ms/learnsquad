import dotenv from 'dotenv';
// Load env vars FIRST, before importing modules that depend on them
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import authRoutes from './routes/auth';
import oauthRoutes from './routes/oauth';
import { createWSServer } from './ws';

const app = express();
const PORT = process.env.PORT || 3000;
const WS_PATH = process.env.WS_PATH || '/ws';
const TICK_RATE = parseInt(process.env.TICK_RATE || '1000', 10);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth/oauth', oauthRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Create HTTP server for both Express and WebSocket
const httpServer = createServer(app);

// Initialize WebSocket server attached to HTTP server
const wsServer = createWSServer({
  httpServer,
  path: WS_PATH,
  tickRate: TICK_RATE,
});

// Game status endpoint
app.get('/api/game/status', (_req, res) => {
  const roomManager = wsServer.getRoomManager();
  res.json({
    clients: wsServer.getClientCount(),
    rooms: roomManager.getRoomIds(),
    totalClients: roomManager.getTotalClients(),
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server available at ws://localhost:${PORT}${WS_PATH}`);
});

export { app, wsServer };
export default app;
