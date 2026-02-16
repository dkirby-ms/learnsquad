/**
 * WebSocket Server
 * 
 * Main entry point for WebSocket connections.
 * Handles connection lifecycle, message routing, and room management.
 */

import { WebSocket, WebSocketServer } from 'ws';
import type { Server as HttpServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { RoomManager, type GameRoom } from './rooms';
import {
  type ClientMessage,
  type ServerMessage,
  parseClientMessage,
  serializeServerMessage,
} from './types';
import { getTickBroadcaster } from './tick-broadcaster';

/** Client connection state */
interface ClientState {
  id: string;
  ws: WebSocket;
  currentRoomId: string | null;
  connectedAt: number;
}

/** WebSocket server options */
export interface WSServerOptions {
  /** Port to listen on (ignored if httpServer provided) */
  port?: number;
  /** Existing HTTP server to attach to */
  httpServer?: HttpServer;
  /** Base tick rate in ms (default: 1000) */
  tickRate?: number;
  /** Path for WebSocket endpoint (default: '/ws') */
  path?: string;
}

/**
 * Game WebSocket Server
 * 
 * Manages WebSocket connections and routes messages to rooms.
 */
export class GameWSServer {
  private wss: WebSocketServer;
  private clients: Map<string, ClientState> = new Map();
  private roomManager: RoomManager;
  
  constructor(options: WSServerOptions = {}) {
    const { tickRate = 1000, path = '/ws' } = options;
    
    this.roomManager = new RoomManager(tickRate);
    
    // Create WebSocket server
    if (options.httpServer) {
      this.wss = new WebSocketServer({
        server: options.httpServer,
        path,
      });
    } else {
      this.wss = new WebSocketServer({
        port: options.port ?? 8080,
        path,
      });
    }
    
    this.setupConnectionHandlers();
    console.log(`[WSServer] WebSocket server initialized`);
  }

  /** Get room manager for external access */
  getRoomManager(): RoomManager {
    return this.roomManager;
  }

  /** Get connected client count */
  getClientCount(): number {
    return this.clients.size;
  }

  /** Gracefully shut down the server */
  close(): void {
    // Close all client connections
    for (const client of this.clients.values()) {
      client.ws.close(1000, 'Server shutting down');
    }
    
    // Close WebSocket server
    this.wss.close();
    
    console.log('[WSServer] Shut down complete');
  }

  private setupConnectionHandlers(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = this.generateClientId();
      
      const clientState: ClientState = {
        id: clientId,
        ws,
        currentRoomId: null,
        connectedAt: Date.now(),
      };
      
      this.clients.set(clientId, clientState);
      console.log(`[WSServer] Client connected: ${clientId}`);
      
      // Message handler
      ws.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
        this.handleMessage(clientId, data);
      });
      
      // Close handler
      ws.on('close', () => {
        this.handleDisconnect(clientId);
      });
      
      // Error handler
      ws.on('error', (error: Error) => {
        console.error(`[WSServer] Client error (${clientId}):`, error.message);
        this.handleDisconnect(clientId);
      });
    });
    
    this.wss.on('error', (error: Error) => {
      console.error('[WSServer] Server error:', error.message);
    });
  }

  private handleMessage(clientId: string, rawData: Buffer | ArrayBuffer | Buffer[]): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    // Parse message
    const dataStr = rawData.toString();
    const message = parseClientMessage(dataStr);
    
    if (!message) {
      this.sendError(client.ws, 'INVALID_MESSAGE', 'Could not parse message');
      return;
    }
    
    // Route message
    this.routeMessage(client, message);
  }

  private routeMessage(client: ClientState, message: ClientMessage): void {
    switch (message.type) {
      case 'join_room':
        this.handleJoinRoom(client, message.roomId);
        break;
        
      case 'leave_room':
        this.handleLeaveRoom(client, message.roomId);
        break;
        
      default:
        // All other messages go to the current room
        if (client.currentRoomId) {
          const room = this.roomManager.get(client.currentRoomId);
          if (room) {
            room.handleMessage(client.id, message);
          }
        } else {
          this.sendError(client.ws, 'NOT_IN_ROOM', 'You must join a room first');
        }
        break;
    }
  }

  private handleJoinRoom(client: ClientState, roomId: string): void {
    // Leave current room if in one
    if (client.currentRoomId) {
      this.handleLeaveRoom(client, client.currentRoomId);
    }
    
    // Join new room
    const room = this.roomManager.getOrCreate(roomId);
    room.addClient(client.id, client.ws);
    client.currentRoomId = roomId;
    
    // Register with tick broadcaster for metrics
    getTickBroadcaster().registerRoom(room);
    
    console.log(`[WSServer] Client ${client.id} joined room ${roomId}`);
  }

  private handleLeaveRoom(client: ClientState, roomId: string): void {
    const room = this.roomManager.get(roomId);
    if (room) {
      room.removeClient(client.id);
      
      // Remove empty rooms
      if (room.clientCount === 0) {
        getTickBroadcaster().unregisterRoom(room);
        this.roomManager.remove(roomId);
      }
    }
    
    client.currentRoomId = null;
    console.log(`[WSServer] Client ${client.id} left room ${roomId}`);
  }

  private handleDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    // Leave current room
    if (client.currentRoomId) {
      this.handleLeaveRoom(client, client.currentRoomId);
    }
    
    this.clients.delete(clientId);
    console.log(`[WSServer] Client disconnected: ${clientId}`);
  }

  private sendError(ws: WebSocket, code: string, message: string): void {
    if (ws.readyState === WebSocket.OPEN) {
      const errorMsg: ServerMessage = {
        type: 'error',
        code,
        message,
      };
      ws.send(serializeServerMessage(errorMsg));
    }
  }

  private generateClientId(): string {
    // Use first 8 chars of UUID for readability
    return uuidv4().slice(0, 8);
  }
}

/**
 * Create and attach WebSocket server to existing HTTP server
 */
export function createWSServer(options: WSServerOptions = {}): GameWSServer {
  return new GameWSServer(options);
}

/**
 * Create standalone WebSocket server
 */
export function createStandaloneWSServer(port: number = 8080): GameWSServer {
  return new GameWSServer({ port });
}
