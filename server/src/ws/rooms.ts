/**
 * Game Room Management
 * 
 * Handles game instances and client connections.
 * Each room has its own game loop and connected clients.
 */

import { WebSocket } from 'ws';
import {
  GameLoop,
  createGameWorld,
  type GameWorld,
  type TickResult,
  GameSpeed,
} from '../shared';
import {
  type ServerMessage,
  type ClientMessage,
  serializeServerMessage,
  parseClientMessage,
} from './types';
import { createGameStateUpdate, createTickComplete } from './serialization';

/** Connected client in a room */
export interface RoomClient {
  id: string;
  ws: WebSocket;
  joinedAt: number;
}

/** A game room instance */
export class GameRoom {
  readonly id: string;
  private clients: Map<string, RoomClient> = new Map();
  private gameLoop: GameLoop;
  private previousWorld: GameWorld;
  
  /** Base tick rate in ms (1000 = 1 tick/second at normal speed) */
  private readonly tickRate: number;
  
  constructor(id: string, tickRate: number = 1000) {
    this.id = id;
    this.tickRate = tickRate;
    
    // Create initial world
    const world = createGameWorld(`room-${id}`);
    this.previousWorld = world;
    this.gameLoop = new GameLoop(world, tickRate);
    
    // Subscribe to tick events for broadcasting
    this.gameLoop.subscribe((result) => this.onTick(result));
  }

  /** Get current number of clients */
  get clientCount(): number {
    return this.clients.size;
  }

  /** Get current game world */
  getWorld(): GameWorld {
    return this.gameLoop.getWorld();
  }

  /** Check if game is paused */
  isPaused(): boolean {
    return this.gameLoop.isPaused();
  }

  /** Add a client to the room */
  addClient(clientId: string, ws: WebSocket): void {
    const client: RoomClient = {
      id: clientId,
      ws,
      joinedAt: Date.now(),
    };
    
    this.clients.set(clientId, client);
    
    // Send join confirmation with initial state
    this.sendToClient(clientId, {
      type: 'room_joined',
      roomId: this.id,
      world: this.gameLoop.getWorld(),
      clientId,
    });
  }

  /** Remove a client from the room */
  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.clients.delete(clientId);
      
      // Don't send leave confirmation if socket is closed
      if (client.ws.readyState === WebSocket.OPEN) {
        this.sendToClient(clientId, {
          type: 'room_left',
          roomId: this.id,
        });
      }
    }
  }

  /** Handle incoming client message */
  handleMessage(clientId: string, message: ClientMessage): void {
    switch (message.type) {
      case 'pause_game':
        this.pause();
        break;
        
      case 'resume_game':
        this.resume();
        break;
        
      case 'set_speed':
        this.setSpeed(message.speed);
        break;
        
      case 'request_sync':
        this.sendFullState(clientId);
        break;
        
      case 'ping':
        this.sendToClient(clientId, {
          type: 'pong',
          clientTime: message.clientTime,
          serverTime: Date.now(),
        });
        break;
        
      case 'player_action':
        // TODO: Process player actions when game mechanics require them
        console.log(`[Room ${this.id}] Player action:`, message.action);
        break;
        
      default:
        // Unknown message type - ignore
        break;
    }
  }

  /** Pause the game */
  pause(): void {
    this.gameLoop.stop();
    this.broadcast({
      type: 'pause_state_changed',
      isPaused: true,
      tick: this.gameLoop.getCurrentTick(),
    });
  }

  /** Resume the game */
  resume(): void {
    this.gameLoop.start();
    this.broadcast({
      type: 'pause_state_changed',
      isPaused: false,
      tick: this.gameLoop.getCurrentTick(),
    });
  }

  /** Set game speed */
  setSpeed(speed: GameSpeed): void {
    // Need to stop and restart to apply new speed
    const wasRunning = !this.isPaused();
    if (wasRunning) {
      this.gameLoop.stop();
    }
    
    // Update world with new speed
    const world = this.gameLoop.getWorld();
    this.gameLoop.setWorld({
      ...world,
      speed,
    });
    
    if (wasRunning) {
      this.gameLoop.start();
    }
    
    this.broadcast({
      type: 'speed_changed',
      speed,
    });
  }

  /** Send full state to a specific client */
  sendFullState(clientId: string): void {
    const msg = createGameStateUpdate(this.gameLoop.getWorld());
    this.sendToClient(clientId, msg);
  }

  /** Clean up resources */
  destroy(): void {
    this.gameLoop.stop();
    this.clients.clear();
  }

  /** Called after each tick - broadcast delta to all clients */
  private onTick(result: TickResult): void {
    const msg = createTickComplete(result, this.previousWorld);
    this.previousWorld = result.world;
    this.broadcast(msg);
  }

  /** Broadcast a message to all clients */
  private broadcast(msg: ServerMessage): void {
    const data = serializeServerMessage(msg);
    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
      }
    }
  }

  /** Send a message to a specific client */
  private sendToClient(clientId: string, msg: ServerMessage): void {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(serializeServerMessage(msg));
    }
  }
}

/**
 * Room Manager - handles creation and lookup of game rooms
 */
export class RoomManager {
  private rooms: Map<string, GameRoom> = new Map();
  private readonly tickRate: number;

  constructor(tickRate: number = 1000) {
    this.tickRate = tickRate;
  }

  /** Get or create a room by ID */
  getOrCreate(roomId: string): GameRoom {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = new GameRoom(roomId, this.tickRate);
      this.rooms.set(roomId, room);
      console.log(`[RoomManager] Created room: ${roomId}`);
    }
    return room;
  }

  /** Get a room by ID (returns undefined if not found) */
  get(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  /** Remove a room */
  remove(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.destroy();
      this.rooms.delete(roomId);
      console.log(`[RoomManager] Removed room: ${roomId}`);
    }
  }

  /** Get all room IDs */
  getRoomIds(): string[] {
    return Array.from(this.rooms.keys());
  }

  /** Get total client count across all rooms */
  getTotalClients(): number {
    let total = 0;
    for (const room of this.rooms.values()) {
      total += room.clientCount;
    }
    return total;
  }

  /** Clean up empty rooms */
  pruneEmptyRooms(): void {
    for (const [roomId, room] of this.rooms) {
      if (room.clientCount === 0) {
        this.remove(roomId);
      }
    }
  }
}
