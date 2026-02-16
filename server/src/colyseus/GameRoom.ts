/**
 * GameRoom - Colyseus Room Implementation
 * 
 * Handles multiplayer game sessions with automatic state synchronization.
 * Integrates with Miller's game engine for tick-based simulation.
 */

import { Room, Client } from 'colyseus';
import { GameState, PlayerSchema } from './schema';
import { gameWorldToState, syncWorldToState } from './converters';
import { GameLoop, createGameWorld, type TickResult } from '../shared';
import { GameSpeed } from '../shared/game-types';

/** Message types from client */
export type ClientMessageType =
  | { type: 'pause_game' }
  | { type: 'resume_game' }
  | { type: 'set_speed'; speed: GameSpeed }
  | { type: 'request_sync' }
  | { type: 'ping'; clientTime: number }
  | { type: 'player_action'; action: string; payload: Record<string, unknown> };

/** Room configuration options */
export interface GameRoomOptions {
  tickRate?: number;
  maxPlayers?: number;
}

/**
 * GameRoom - Main Colyseus room for game sessions
 * 
 * Room name: "game" (clients join via client.joinOrCreate("game", options))
 */
export class GameRoom extends Room<{ state: GameState }> {
  private gameLoop!: GameLoop;
  private tickRate: number = 1000;
  private maxPlayers: number = 8;

  /**
   * Called when the room is created
   */
  onCreate(options: GameRoomOptions): void {
    this.tickRate = options.tickRate ?? 1000;
    this.maxPlayers = options.maxPlayers ?? 8;
    this.maxClients = this.maxPlayers;

    // Initialize Colyseus state
    this.setState(new GameState());

    // Create game world and initialize state
    const world = createGameWorld(`room-${this.roomId}`);
    this.state.id = world.id;
    gameWorldToState(world, this.state);
    
    // Debug: Log node count after initialization
    console.log(`[GameRoom] Initialized with ${this.state.nodes.size} nodes`);
    this.state.nodes.forEach((node, id) => {
      console.log(`[GameRoom]   Node ${id}: ${node.name}`);
    });

    // Create game loop and subscribe to ticks
    this.gameLoop = new GameLoop(world, this.tickRate);
    this.gameLoop.subscribe((result) => this.onTick(result));

    // Register message handlers
    this.registerMessageHandlers();

    console.log(`[GameRoom] Room created: ${this.roomId}`);
  }

  /**
   * Called when a client requests to join
   */
  onJoin(client: Client, options?: Record<string, unknown>): void {
    // Create player schema
    const player = new PlayerSchema();
    player.id = options?.userId as string ?? client.sessionId;
    player.sessionId = client.sessionId;
    player.joinedAt = Date.now();
    player.isConnected = true;

    // Add to state (Colyseus auto-syncs this)
    this.state.players.set(client.sessionId, player);

    console.log(`[GameRoom] Client joined: ${client.sessionId} (room: ${this.roomId})`);
  }

  /**
   * Called when a client leaves
   * @param client The client that left
   * @param code Optional disconnect code
   */
  async onLeave(client: Client, code?: number): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    const consented = code === 1000; // Normal close = consented
    
    if (player) {
      player.isConnected = false;
      
      // Allow reconnection for 30 seconds if not consented (browser closed, network issue)
      if (!consented) {
        try {
          console.log(`[GameRoom] Client ${client.sessionId} disconnected. Waiting for reconnect...`);
          await this.allowReconnection(client, 30);
          
          // Client reconnected
          player.isConnected = true;
          console.log(`[GameRoom] Client ${client.sessionId} reconnected`);
          return;
        } catch {
          // Reconnection timeout - remove player
          console.log(`[GameRoom] Client ${client.sessionId} failed to reconnect`);
        }
      }
      
      // Remove player from state
      this.state.players.delete(client.sessionId);
    }

    console.log(`[GameRoom] Client left: ${client.sessionId}`);
  }

  /**
   * Called when the room is disposed
   */
  onDispose(): void {
    this.gameLoop.stop();
    console.log(`[GameRoom] Room disposed: ${this.roomId}`);
  }

  /**
   * Register all message handlers
   */
  private registerMessageHandlers(): void {
    // Pause game
    this.onMessage('pause_game', (_client) => {
      this.pauseGame();
    });

    // Resume game
    this.onMessage('resume_game', (_client) => {
      this.resumeGame();
    });

    // Set speed
    this.onMessage('set_speed', (_client, message: { speed: GameSpeed }) => {
      this.setSpeed(message.speed);
    });

    // Request full state sync (Colyseus handles this automatically, but kept for compatibility)
    this.onMessage('request_sync', (client) => {
      // Send current full state - Colyseus does this automatically but we can force it
      client.send('sync', { currentTick: this.state.currentTick });
    });

    // Ping for latency measurement
    this.onMessage('ping', (client, message: { clientTime: number }) => {
      client.send('pong', {
        clientTime: message.clientTime,
        serverTime: Date.now(),
      });
    });

    // Generic player action (for future game commands)
    this.onMessage('player_action', (client, message: { action: string; payload: Record<string, unknown> }) => {
      console.log(`[GameRoom] Player action from ${client.sessionId}:`, message.action);
      // TODO: Route to game engine when actions are implemented
    });
  }

  /**
   * Handle tick from game loop
   */
  private onTick(result: TickResult): void {
    // Find changed node IDs by comparing with current state
    const changedNodeIds = Object.keys(result.world.nodes);
    
    // Sync world state to Colyseus state
    syncWorldToState(result.world, this.state, changedNodeIds);
  }

  /**
   * Pause the game
   */
  private pauseGame(): void {
    this.gameLoop.stop();
    this.state.isPaused = true;
    
    // Broadcast specific pause event for clients that need it
    this.broadcast('pause_state_changed', {
      isPaused: true,
      tick: this.state.currentTick,
    });
  }

  /**
   * Resume the game
   */
  private resumeGame(): void {
    this.gameLoop.start();
    this.state.isPaused = false;
    
    this.broadcast('pause_state_changed', {
      isPaused: false,
      tick: this.state.currentTick,
    });
  }

  /**
   * Set game speed
   */
  private setSpeed(speed: GameSpeed): void {
    const wasRunning = !this.gameLoop.isPaused();
    
    if (wasRunning) {
      this.gameLoop.stop();
    }
    
    // Update world with new speed
    const world = this.gameLoop.getWorld();
    this.gameLoop.setWorld({
      ...world,
      speed,
    });
    
    this.state.speed = speed;
    
    if (wasRunning) {
      this.gameLoop.start();
    }
    
    this.broadcast('speed_changed', { speed });
  }
}
