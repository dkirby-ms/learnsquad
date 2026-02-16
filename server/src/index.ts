// Polyfill Symbol.metadata for @colyseus/schema v4 (TC39 Stage 3 feature not yet in Node.js)
// @ts-expect-error - Symbol.metadata may not exist in type definitions yet
Symbol.metadata ??= Symbol('Symbol.metadata');

import dotenv from 'dotenv';
// Load env vars FIRST, before importing modules that depend on them
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import config, { listen } from '@colyseus/tools';
import { matchMaker, Server } from 'colyseus';
import authRoutes from './routes/auth';
import oauthRoutes from './routes/oauth';
import { GameRoom } from './colyseus';

const PORT = parseInt(process.env.PORT || '3000', 10);
const TICK_RATE = parseInt(process.env.TICK_RATE || '1000', 10);

// Colyseus configuration using @colyseus/tools
const appConfig = config({
  // Initialize game server with rooms
  initializeGameServer: (gameServer: Server) => {
    gameServer.define('game', GameRoom, { tickRate: TICK_RATE });
  },
  
  // Express middleware and routes
  initializeExpress: (app: express.Application) => {
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

    // Game status endpoint using Colyseus matchmaker
    app.get('/api/game/status', async (_req, res) => {
      try {
        const rooms = await matchMaker.query({ name: 'game' });
        const totalClients = rooms.reduce((sum: number, room: { clients: number }) => sum + room.clients, 0);
        res.json({
          rooms: rooms.map((r: { roomId: string }) => r.roomId),
          totalClients,
          roomCount: rooms.length,
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to query rooms' });
      }
    });
  },
});

// Start the server
listen(appConfig, PORT).then((gameServer) => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Colyseus WebSocket server available at ws://localhost:${PORT}`);
  console.log(`Matchmaking available at http://localhost:${PORT}/matchmake/`);
  console.log(`Room type: "game" (use client.joinOrCreate("game") to connect)`);
});

export { appConfig };
export default appConfig;
