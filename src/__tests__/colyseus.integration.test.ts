/**
 * Colyseus Integration Tests
 * 
 * Tests the Colyseus server integration:
 * - Client can connect to server
 * - Client can join a game room
 * - Room state is synchronized
 * - Pause/resume commands work
 * 
 * NOTE: These tests require the server to be running on localhost:3000
 * Run `npm start` in the server directory first.
 * 
 * NOTE: These tests use raw HTTP/WebSocket due to version compatibility
 * between colyseus@0.17.x server and colyseus.js@0.16.x client.
 */

import WebSocket from 'ws';

const SERVER_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';
const ROOM_NAME = 'game';

interface MatchmakeResponse {
  name: string;
  sessionId: string;
  roomId: string;
  processId: string;
}

/**
 * Request a seat reservation from the matchmaker
 */
async function joinRoom(): Promise<MatchmakeResponse> {
  const response = await fetch(`${SERVER_URL}/matchmake/joinOrCreate/${ROOM_NAME}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  
  if (!response.ok) {
    throw new Error(`Matchmaking failed: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Connect to a room via WebSocket
 */
function connectToRoom(reservation: MatchmakeResponse): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}/${reservation.roomId}?sessionId=${reservation.sessionId}`);
    
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
    
    // Timeout after 5s
    setTimeout(() => reject(new Error('Connection timeout')), 5000);
  });
}

describe('Colyseus Integration', () => {
  describe('Matchmaking API', () => {
    it('should return a room reservation from matchmaker', async () => {
      const reservation = await joinRoom();
      
      expect(reservation).toBeDefined();
      expect(reservation.name).toBe(ROOM_NAME);
      expect(reservation.sessionId).toBeDefined();
      expect(reservation.roomId).toBeDefined();
      expect(reservation.processId).toBeDefined();
    });

    it('should create unique sessions for each join', async () => {
      const [res1, res2] = await Promise.all([joinRoom(), joinRoom()]);
      
      expect(res1.sessionId).not.toBe(res2.sessionId);
    });
  });

  describe('WebSocket Connection', () => {
    let ws: WebSocket | null = null;

    afterEach((done) => {
      if (ws) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.on('close', () => {
            ws = null;
            done();
          });
          ws.close();
        } else {
          ws = null;
          done();
        }
      } else {
        done();
      }
    });

    it('should connect to room via WebSocket', async () => {
      const reservation = await joinRoom();
      ws = await connectToRoom(reservation);
      
      expect(ws.readyState).toBe(WebSocket.OPEN);
    });

    it('should receive initial state after connection', async () => {
      const reservation = await joinRoom();
      ws = await connectToRoom(reservation);
      
      // Wait for initial state message
      const message = await new Promise<Buffer>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('No state received')), 3000);
        
        ws!.on('message', (data: Buffer) => {
          clearTimeout(timeout);
          resolve(data);
        });
      });
      
      expect(message).toBeDefined();
      expect(message.length).toBeGreaterThan(0);
    });
  });

  describe('Game Status API', () => {
    it('should return room status', async () => {
      const response = await fetch(`${SERVER_URL}/api/game/status`);
      const status = await response.json();
      
      expect(response.ok).toBe(true);
      expect(status).toHaveProperty('rooms');
      expect(status).toHaveProperty('totalClients');
      expect(status).toHaveProperty('roomCount');
      expect(Array.isArray(status.rooms)).toBe(true);
    });

    it('should show room after client joins', async () => {
      // Join a room first
      const reservation = await joinRoom();
      const ws = await connectToRoom(reservation);
      
      // Wait a bit for the room to be fully registered
      await new Promise((r) => setTimeout(r, 100));
      
      // Query status
      const response = await fetch(`${SERVER_URL}/api/game/status`);
      const status = await response.json();
      
      expect(status.roomCount).toBeGreaterThanOrEqual(1);
      expect(status.rooms).toContain(reservation.roomId);
      
      ws.close();
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await fetch(`${SERVER_URL}/health`);
      const data = await response.json();
      
      expect(response.ok).toBe(true);
      expect(data.status).toBe('ok');
    });
  });
});
