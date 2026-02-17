/**
 * Colyseus E2E Integration Tests
 * 
 * Comprehensive tests for the Colyseus multiplayer server integration.
 * Tests verify:
 * - Client can connect to server
 * - Room join works correctly
 * - Initial state sync (4 nodes arrive correctly)
 * - Pause/resume game functionality
 * - Multiple clients can connect simultaneously
 * 
 * NOTE: These tests require the server to be running on localhost:3000
 * Run `npm start` in the server directory first.
 * 
 * Phase 6 fixes (now tested):
 * - @colyseus/sdk v0.17 client for proper schema deserialization
 * - Symbol.metadata polyfill + useDefineForClassFields:false for schema decorators
 */

import WebSocket from 'ws';
import { Client, Room } from '@colyseus/sdk';

const SERVER_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';
const ROOM_NAME = 'game';

/** Expected initial game world state */
const EXPECTED_NODES = ['node-1', 'node-2', 'node-3', 'node-4'];
const EXPECTED_NODE_NAMES: Record<string, string> = {
  'node-1': 'Sol System',
  'node-2': 'Alpha Centauri',
  'node-3': 'Sirius',
  'node-4': 'Proxima',
};

interface MatchmakeResponse {
  name: string;
  sessionId: string;
  roomId: string;
  processId: string;
}

/**
 * Request a seat reservation from the matchmaker (raw HTTP approach)
 */
async function joinRoomHTTP(): Promise<MatchmakeResponse> {
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
 * Connect to a room via raw WebSocket (for basic connectivity tests)
 */
function connectToRoomWS(reservation: MatchmakeResponse): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}/${reservation.roomId}?sessionId=${reservation.sessionId}`);
    
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
    
    // Timeout after 5s
    setTimeout(() => reject(new Error('Connection timeout')), 5000);
  });
}

/**
 * Create a Colyseus client and join a room (SDK approach for state sync tests)
 */
async function joinWithSDK(): Promise<Room> {
  const client = new Client(WS_URL);
  return client.joinOrCreate(ROOM_NAME, {});
}

/**
 * Wait for a specific state condition to be true
 */
function waitForState<T>(
  room: Room,
  predicate: (state: T) => boolean,
  timeoutMs = 3000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for state condition'));
    }, timeoutMs);

    const check = (state: T) => {
      if (predicate(state)) {
        clearTimeout(timeout);
        resolve(state);
      }
    };

    // Check immediately if state exists
    if (room.state && predicate(room.state as T)) {
      clearTimeout(timeout);
      resolve(room.state as T);
      return;
    }

    room.onStateChange((state) => check(state as T));
  });
}

describe('Colyseus E2E Integration', () => {
  jest.setTimeout(15000); // Extend timeout for E2E tests

  describe('Matchmaking API', () => {
    it('should return a room reservation from matchmaker', async () => {
      const reservation = await joinRoomHTTP();
      
      expect(reservation).toBeDefined();
      expect(reservation.name).toBe(ROOM_NAME);
      expect(reservation.sessionId).toBeDefined();
      expect(reservation.roomId).toBeDefined();
      expect(reservation.processId).toBeDefined();
    });

    it('should create unique sessions for each join', async () => {
      const [res1, res2] = await Promise.all([joinRoomHTTP(), joinRoomHTTP()]);
      
      expect(res1.sessionId).not.toBe(res2.sessionId);
    });
  });

  describe('WebSocket Connection (raw)', () => {
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
      const reservation = await joinRoomHTTP();
      ws = await connectToRoomWS(reservation);
      
      expect(ws.readyState).toBe(WebSocket.OPEN);
    });

    it('should receive initial state after connection', async () => {
      const reservation = await joinRoomHTTP();
      ws = await connectToRoomWS(reservation);
      
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

  describe('State Synchronization (SDK)', () => {
    let room: Room | null = null;

    afterEach(async () => {
      if (room) {
        room.leave();
        room = null;
        // Give server time to process the leave
        await new Promise((r) => setTimeout(r, 100));
      }
    });

    it('should join room and receive state via SDK', async () => {
      room = await joinWithSDK();
      
      expect(room).toBeDefined();
      expect(room.sessionId).toBeDefined();
      expect(room.state).toBeDefined();
    });

    it('should receive exactly 4 nodes in initial state', async () => {
      room = await joinWithSDK();
      
      // Wait for state with nodes
      const state = await waitForState<any>(
        room,
        (s) => s?.nodes && s.nodes.size >= 4,
        5000
      );
      
      expect(state.nodes.size).toBe(4);
    });

    it('should receive all expected node IDs', async () => {
      room = await joinWithSDK();
      
      const state = await waitForState<any>(
        room,
        (s) => s?.nodes && s.nodes.size >= 4,
        5000
      );
      
      const nodeIds = Array.from(state.nodes.keys());
      for (const expectedId of EXPECTED_NODES) {
        expect(nodeIds).toContain(expectedId);
      }
    });

    it('should receive correct node names', async () => {
      room = await joinWithSDK();
      
      const state = await waitForState<any>(
        room,
        (s) => s?.nodes && s.nodes.size >= 4,
        5000
      );
      
      for (const [id, expectedName] of Object.entries(EXPECTED_NODE_NAMES)) {
        const node = state.nodes.get(id);
        expect(node).toBeDefined();
        expect(node.name).toBe(expectedName);
      }
    });

    it('should start in paused state', async () => {
      room = await joinWithSDK();
      
      const state = await waitForState<any>(
        room,
        (s) => s?.isPaused !== undefined,
        5000
      );
      
      expect(state.isPaused).toBe(true);
    });

    it('should have connections defined', async () => {
      room = await joinWithSDK();
      
      const state = await waitForState<any>(
        room,
        (s) => s?.connections && s.connections.size >= 1,
        5000
      );
      
      // Should have 3 connections
      expect(state.connections.size).toBe(3);
    });

    it('should have valid node resources', async () => {
      room = await joinWithSDK();
      
      const state = await waitForState<any>(
        room,
        (s) => s?.nodes && s.nodes.size >= 4,
        5000
      );
      
      // Sol System (node-1) should have 2 resources: Energy and Minerals
      const solSystem = state.nodes.get('node-1');
      expect(solSystem).toBeDefined();
      expect(solSystem.resources.length).toBe(2);
      
      // Check resource types exist
      const resourceTypes = Array.from(solSystem.resources).map((r: any) => r.type);
      expect(resourceTypes).toContain('energy');
      expect(resourceTypes).toContain('minerals');
    });
  });

  describe('Pause/Resume Functionality', () => {
    let room: Room | null = null;

    afterEach(async () => {
      if (room) {
        room.leave();
        room = null;
        await new Promise((r) => setTimeout(r, 100));
      }
    });

    it('should handle resume_game message', async () => {
      room = await joinWithSDK();
      
      // Wait for initial state
      await waitForState<any>(
        room,
        (s) => s?.isPaused !== undefined,
        5000
      );
      
      // Send resume message
      room.send('resume_game');
      
      // Wait for state to update
      const state = await waitForState<any>(
        room,
        (s) => s?.isPaused === false,
        3000
      );
      
      expect(state.isPaused).toBe(false);
    });

    it('should handle pause_game message after resume', async () => {
      room = await joinWithSDK();
      
      // Wait for initial state
      await waitForState<any>(
        room,
        (s) => s?.isPaused !== undefined,
        5000
      );
      
      // Resume first
      room.send('resume_game');
      await waitForState<any>(room, (s) => s?.isPaused === false, 3000);
      
      // Then pause
      room.send('pause_game');
      const state = await waitForState<any>(
        room,
        (s) => s?.isPaused === true,
        3000
      );
      
      expect(state.isPaused).toBe(true);
    });

    it('should receive pause_state_changed message on pause', (done) => {
      let completed = false;
      let localRoom: Room | null = null;
      
      joinWithSDK().then((r) => {
        room = r;
        localRoom = r;
        
        // Listen for broadcast message
        room.onMessage('pause_state_changed', (message) => {
          if (!completed) {
            completed = true;
            expect(message).toHaveProperty('isPaused');
            expect(message).toHaveProperty('tick');
            done();
          }
        });
        
        // Resume then pause to trigger the message
        setTimeout(() => {
          if (localRoom && localRoom.connection.isOpen) {
            localRoom.send('resume_game');
            setTimeout(() => {
              if (localRoom && localRoom.connection.isOpen) {
                localRoom.send('pause_game');
              }
            }, 200);
          }
        }, 500);
      });
    });
  });

  describe('Multiple Clients', () => {
    let rooms: Room[] = [];

    afterEach(async () => {
      for (const room of rooms) {
        room.leave();
      }
      rooms = [];
      await new Promise((r) => setTimeout(r, 200));
    });

    it('should allow two clients to connect', async () => {
      const room1 = await joinWithSDK();
      const room2 = await joinWithSDK();
      
      rooms = [room1, room2];
      
      expect(room1.sessionId).toBeDefined();
      expect(room2.sessionId).toBeDefined();
      expect(room1.sessionId).not.toBe(room2.sessionId);
    });

    it('should sync same state to multiple clients', async () => {
      const room1 = await joinWithSDK();
      const room2 = await joinWithSDK();
      
      rooms = [room1, room2];
      
      // Wait for both to receive state
      const [state1, state2] = await Promise.all([
        waitForState<any>(room1, (s) => s?.nodes?.size >= 4, 5000),
        waitForState<any>(room2, (s) => s?.nodes?.size >= 4, 5000),
      ]);
      
      // Both should have same node count
      expect(state1.nodes.size).toBe(state2.nodes.size);
      expect(state1.currentTick).toBe(state2.currentTick);
    });

    it('should show correct player count in status API', async () => {
      const room1 = await joinWithSDK();
      const room2 = await joinWithSDK();
      
      rooms = [room1, room2];
      
      // Wait for connections to stabilize
      await new Promise((r) => setTimeout(r, 300));
      
      const response = await fetch(`${SERVER_URL}/api/game/status`);
      const status = await response.json();
      
      // Should have at least 2 clients (may be more if other rooms exist)
      expect(status.totalClients).toBeGreaterThanOrEqual(2);
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
      const reservation = await joinRoomHTTP();
      const ws = await connectToRoomWS(reservation);
      
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
