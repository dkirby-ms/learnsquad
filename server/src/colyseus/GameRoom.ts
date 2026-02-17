/**
 * GameRoom - Colyseus Room Implementation
 * 
 * Handles multiplayer game sessions with automatic state synchronization.
 * Integrates with Miller's game engine for tick-based simulation.
 */

import { Room, Client } from 'colyseus';
import { GameState, PlayerSchema, DiplomacySchema } from './schema';
import { gameWorldToState, syncWorldToState } from './converters';
import { GameLoop, createGameWorld, type TickResult } from '../shared';
import { GameSpeed } from '../shared/game-types';
import { randomUUID } from 'crypto';
import xss from 'xss';

/** Message types from client */
export type ClientMessageType =
  | { type: 'pause_game' }
  | { type: 'resume_game' }
  | { type: 'set_speed'; speed: GameSpeed }
  | { type: 'request_sync' }
  | { type: 'ping'; clientTime: number }
  | { type: 'update_focus'; nodeId: string }
  | { type: 'player_activity' }
  | { type: 'claim_node'; nodeId: string }
  | { type: 'abandon_node'; nodeId: string }
  | { type: 'offer_alliance'; targetPlayerId: string }
  | { type: 'accept_alliance'; fromPlayerId: string }
  | { type: 'reject_alliance'; fromPlayerId: string }
  | { type: 'declare_war'; targetPlayerId: string }
  | { type: 'propose_peace'; targetPlayerId: string }
  | { type: 'accept_peace'; fromPlayerId: string }
  | { type: 'send_chat'; content: string }
  | { type: 'player_action'; action: string; payload: Record<string, unknown> };

/** Room configuration options */
export interface GameRoomOptions {
  tickRate?: number;
  maxPlayers?: number;
}

/** Claim action tracking */
interface ClaimAction {
  playerId: string;
  nodeId: string;
  tick: number;
}

/** Diplomatic offer tracking */
interface DiplomaticOffer {
  from: string;
  to: string;
  type: 'alliance' | 'peace';
  tick: number;
}

/** Player color palette */
const PLAYER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
];

/** Chat rate limit configuration */
const CHAT_RATE_LIMIT_MESSAGES = 5;
const CHAT_RATE_LIMIT_WINDOW_MS = 10000; // 10 seconds
const CHAT_MAX_LENGTH = 500;

/** Chat rate limit tracking */
interface ChatRateLimit {
  messages: number[];
  lastChecked: number;
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
  private activeClaims: Map<string, ClaimAction> = new Map();
  private pendingOffers: Map<string, DiplomaticOffer> = new Map();
  private usedColorIndices: Set<number> = new Set();
  private chatRateLimits: Map<string, ChatRateLimit> = new Map();

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

    // Start the game loop automatically (game starts running, not paused)
    this.gameLoop.start();

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
    player.name = options?.name as string ?? `Player ${this.state.players.size + 1}`;
    player.color = this.assignPlayerColor();
    player.joinedAt = Date.now();
    player.isConnected = true;
    player.focusedNodeId = '';
    player.lastActivityTick = this.state.currentTick;

    // Add to state (Colyseus auto-syncs this)
    this.state.players.set(client.sessionId, player);

    console.log(`[GameRoom] Client joined: ${client.sessionId} as ${player.name} (${player.color})`);
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
      
      // Remove any active claims from this player
      this.activeClaims.delete(client.sessionId);
      
      // Clean up chat rate limit tracking
      this.chatRateLimits.delete(client.sessionId);
      
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
      
      // Free up player color
      const colorIndex = PLAYER_COLORS.indexOf(player.color);
      if (colorIndex !== -1) {
        this.usedColorIndices.delete(colorIndex);
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

    // Update player focus
    this.onMessage('update_focus', (client, message: { nodeId: string }) => {
      this.updatePlayerFocus(client, message.nodeId);
    });

    // Player activity ping
    this.onMessage('player_activity', (client) => {
      this.updatePlayerActivity(client);
    });

    // Claim node
    this.onMessage('claim_node', (client, message: { nodeId: string }) => {
      this.claimNode(client, message.nodeId);
    });

    // Abandon node
    this.onMessage('abandon_node', (client, message: { nodeId: string }) => {
      this.abandonNode(client, message.nodeId);
    });

    // Diplomacy handlers
    this.onMessage('offer_alliance', (client, message: { targetPlayerId: string }) => {
      this.offerAlliance(client, message.targetPlayerId);
    });

    this.onMessage('accept_alliance', (client, message: { fromPlayerId: string }) => {
      this.acceptAlliance(client, message.fromPlayerId);
    });

    this.onMessage('reject_alliance', (client, message: { fromPlayerId: string }) => {
      this.rejectAlliance(client, message.fromPlayerId);
    });

    this.onMessage('declare_war', (client, message: { targetPlayerId: string }) => {
      this.declareWar(client, message.targetPlayerId);
    });

    this.onMessage('propose_peace', (client, message: { targetPlayerId: string }) => {
      this.proposePeace(client, message.targetPlayerId);
    });

    this.onMessage('accept_peace', (client, message: { fromPlayerId: string }) => {
      this.acceptPeace(client, message.fromPlayerId);
    });

    // Chat message handler
    this.onMessage('send_chat', (client, message: { content: string }) => {
      this.handleChatMessage(client, message);
    });

    // Generic player action (for future game commands)
    this.onMessage('player_action', (client, message: { action: string; payload: Record<string, unknown> }) => {
      console.log(`[GameRoom] Player action from ${client.sessionId}:`, message.action);
      this.updatePlayerActivity(client);
      // TODO: Route to game engine when actions are implemented
    });
  }

  /**
   * Handle tick from game loop
   */
  private onTick(result: TickResult): void {
    // Find changed node IDs by comparing with current state
    const changedNodeIds = Object.keys(result.world.nodes);
    
    // Sync world state to Colyseus state FIRST
    syncWorldToState(result.world, this.state, changedNodeIds);
    
    // Process active claims AFTER sync (so controlPoints updates aren't overwritten)
    if (this.activeClaims.size > 0) {
      console.log(`[GameRoom] Tick ${this.state.currentTick}: Processing ${this.activeClaims.size} active claim(s)`);
    }
    this.processClaims();
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

  /**
   * Assign a unique color to a player
   */
  private assignPlayerColor(): string {
    // Find first unused color
    for (let i = 0; i < PLAYER_COLORS.length; i++) {
      if (!this.usedColorIndices.has(i)) {
        this.usedColorIndices.add(i);
        return PLAYER_COLORS[i];
      }
    }
    // If all colors used, generate random color
    return `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
  }

  /**
   * Update player focus (what node they're viewing)
   */
  private updatePlayerFocus(client: Client, nodeId: string): void {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.focusedNodeId = nodeId;
      player.lastActivityTick = this.state.currentTick;
    }
  }

  /**
   * Update player activity timestamp
   */
  private updatePlayerActivity(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.lastActivityTick = this.state.currentTick;
    }
  }

  /**
   * Handle claim node request
   */
  private claimNode(client: Client, nodeId: string): void {
    const player = this.state.players.get(client.sessionId);
    const node = this.state.nodes.get(nodeId);
    
    if (!player || !node) {
      console.log(`[GameRoom] Invalid claim: player or node not found`);
      return;
    }

    // Validate: can't claim node you already own
    if (node.ownerId === player.id) {
      console.log(`[GameRoom] Player ${player.name} already owns node ${nodeId}`);
      return;
    }

    // Add to active claims
    this.activeClaims.set(client.sessionId, {
      playerId: player.id,
      nodeId,
      tick: this.state.currentTick,
    });

    player.lastActivityTick = this.state.currentTick;
    console.log(`[GameRoom] Player ${player.name} claiming node ${nodeId}`);
  }

  /**
   * Handle abandon node request
   */
  private abandonNode(client: Client, nodeId: string): void {
    const claim = this.activeClaims.get(client.sessionId);
    
    if (claim && claim.nodeId === nodeId) {
      this.activeClaims.delete(client.sessionId);
      const player = this.state.players.get(client.sessionId);
      console.log(`[GameRoom] Player ${player?.name} abandoned claim on node ${nodeId}`);
    }
  }

  /**
   * Process active claims each tick
   */
  private processClaims(): void {
    for (const [sessionId, claim] of this.activeClaims.entries()) {
      const node = this.state.nodes.get(claim.nodeId);
      const player = this.state.players.get(sessionId);
      
      if (!node || !player) {
        this.activeClaims.delete(sessionId);
        continue;
      }

      // Check if node is contested (multiple players claiming)
      const claimsOnNode = Array.from(this.activeClaims.values())
        .filter(c => c.nodeId === claim.nodeId);
      const isContested = claimsOnNode.length > 1;

      // Update node status
      if (isContested) {
        node.status = 'contested';
      } else if (node.ownerId === '') {
        node.status = 'neutral';
      } else {
        node.status = 'claimed';
      }

      // Process control points
      if (node.ownerId === '' || node.ownerId === claim.playerId) {
        // Neutral or claiming own node: increment
        const oldPoints = node.controlPoints;
        node.controlPoints = Math.min(node.maxControlPoints, node.controlPoints + 10);
        console.log(`[GameRoom] Processing claim: ${node.name} controlPoints ${oldPoints} -> ${node.controlPoints}`);
        
        // Transfer ownership if threshold reached
        if (node.controlPoints >= node.maxControlPoints && node.ownerId === '') {
          node.ownerId = claim.playerId;
          node.status = 'claimed';
          console.log(`[GameRoom] Node ${node.name} claimed by ${player.name}`);
        }
      } else {
        // Contested: decrement
        node.controlPoints = Math.max(0, node.controlPoints - 5);
        
        // Transfer ownership if fully contested
        if (node.controlPoints <= 0) {
          node.ownerId = claim.playerId;
          node.controlPoints = 10;
          node.status = 'claimed';
          console.log(`[GameRoom] Node ${node.name} contested and captured by ${player.name}`);
        }
      }
    }
  }

  /**
   * Get consistent diplomacy relationship ID for two players
   */
  private getDiplomacyId(id1: string, id2: string): string {
    return [id1, id2].sort().join('-');
  }

  /**
   * Get or create diplomacy relation
   */
  private getOrCreateDiplomacy(playerId1: string, playerId2: string): DiplomacySchema {
    const id = this.getDiplomacyId(playerId1, playerId2);
    let relation = this.state.diplomacy.get(id);
    
    if (!relation) {
      relation = new DiplomacySchema();
      relation.id = id;
      [relation.player1Id, relation.player2Id] = [playerId1, playerId2].sort();
      relation.status = 'neutral';
      relation.establishedTick = this.state.currentTick;
      this.state.diplomacy.set(id, relation);
    }
    
    return relation;
  }

  /**
   * Check if player has nodes (required for war)
   */
  private playerHasNodes(playerId: string): boolean {
    for (const node of this.state.nodes.values()) {
      if (node.ownerId === playerId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Offer alliance to another player
   */
  private offerAlliance(client: Client, targetPlayerId: string): void {
    const player = this.state.players.get(client.sessionId);
    
    if (!player) {
      return;
    }

    // Validate: can't ally with yourself
    if (player.id === targetPlayerId) {
      console.log(`[GameRoom] Player ${player.name} tried to ally with themselves`);
      return;
    }

    // Validate: target player exists and is connected
    const targetPlayer = Array.from(this.state.players.values())
      .find(p => p.id === targetPlayerId && p.isConnected);
    
    if (!targetPlayer) {
      console.log(`[GameRoom] Target player ${targetPlayerId} not found or disconnected`);
      return;
    }

    // Check current relation
    const relation = this.getOrCreateDiplomacy(player.id, targetPlayerId);
    if (relation.status === 'allied') {
      console.log(`[GameRoom] Already allied with ${targetPlayer.name}`);
      return;
    }

    // Create pending offer
    const offerId = this.getDiplomacyId(player.id, targetPlayerId);
    this.pendingOffers.set(offerId, {
      from: player.id,
      to: targetPlayerId,
      type: 'alliance',
      tick: this.state.currentTick,
    });

    // Notify target player
    const targetSession = targetPlayer.sessionId;
    const targetClient = Array.from(this.clients).find(c => c.sessionId === targetSession);
    if (targetClient) {
      targetClient.send('alliance_offer', {
        fromPlayerId: player.id,
        fromPlayerName: player.name,
      });
    }

    player.lastActivityTick = this.state.currentTick;
    console.log(`[GameRoom] ${player.name} offered alliance to ${targetPlayer.name}`);
  }

  /**
   * Accept alliance offer
   */
  private acceptAlliance(client: Client, fromPlayerId: string): void {
    const player = this.state.players.get(client.sessionId);
    
    if (!player) {
      return;
    }

    // Find pending offer
    const offerId = this.getDiplomacyId(player.id, fromPlayerId);
    const offer = this.pendingOffers.get(offerId);
    
    if (!offer || offer.type !== 'alliance' || offer.to !== player.id) {
      console.log(`[GameRoom] No valid alliance offer from ${fromPlayerId}`);
      return;
    }

    // Update diplomacy status
    const relation = this.getOrCreateDiplomacy(player.id, fromPlayerId);
    relation.status = 'allied';
    relation.establishedTick = this.state.currentTick;

    // Remove pending offer
    this.pendingOffers.delete(offerId);

    // Notify both players
    const fromPlayer = Array.from(this.state.players.values()).find(p => p.id === fromPlayerId);
    if (fromPlayer) {
      const fromClient = Array.from(this.clients).find(c => c.sessionId === fromPlayer.sessionId);
      if (fromClient) {
        fromClient.send('alliance_formed', {
          withPlayerId: player.id,
          withPlayerName: player.name,
        });
      }
    }

    player.lastActivityTick = this.state.currentTick;
    console.log(`[GameRoom] Alliance formed between ${fromPlayer?.name} and ${player.name}`);
  }

  /**
   * Reject alliance offer
   */
  private rejectAlliance(client: Client, fromPlayerId: string): void {
    const player = this.state.players.get(client.sessionId);
    
    if (!player) {
      return;
    }

    // Find and remove pending offer
    const offerId = this.getDiplomacyId(player.id, fromPlayerId);
    const offer = this.pendingOffers.get(offerId);
    
    if (!offer || offer.type !== 'alliance' || offer.to !== player.id) {
      console.log(`[GameRoom] No valid alliance offer from ${fromPlayerId}`);
      return;
    }

    this.pendingOffers.delete(offerId);

    // Notify sender
    const fromPlayer = Array.from(this.state.players.values()).find(p => p.id === fromPlayerId);
    if (fromPlayer) {
      const fromClient = Array.from(this.clients).find(c => c.sessionId === fromPlayer.sessionId);
      if (fromClient) {
        fromClient.send('alliance_rejected', {
          byPlayerId: player.id,
          byPlayerName: player.name,
        });
      }
    }

    player.lastActivityTick = this.state.currentTick;
    console.log(`[GameRoom] ${player.name} rejected alliance from ${fromPlayer?.name}`);
  }

  /**
   * Declare war on another player
   */
  private declareWar(client: Client, targetPlayerId: string): void {
    const player = this.state.players.get(client.sessionId);
    
    if (!player) {
      return;
    }

    // Validate: can't declare war on yourself
    if (player.id === targetPlayerId) {
      console.log(`[GameRoom] Player ${player.name} tried to declare war on themselves`);
      return;
    }

    // Validate: target player exists
    const targetPlayer = Array.from(this.state.players.values())
      .find(p => p.id === targetPlayerId);
    
    if (!targetPlayer) {
      console.log(`[GameRoom] Target player ${targetPlayerId} not found`);
      return;
    }

    // Validate: both players must have nodes
    if (!this.playerHasNodes(player.id) || !this.playerHasNodes(targetPlayerId)) {
      console.log(`[GameRoom] Both players must have nodes to declare war`);
      return;
    }

    // Update diplomacy status
    const relation = this.getOrCreateDiplomacy(player.id, targetPlayerId);
    relation.status = 'war';
    relation.establishedTick = this.state.currentTick;

    // Notify both players
    const targetClient = Array.from(this.clients).find(c => c.sessionId === targetPlayer.sessionId);
    if (targetClient) {
      targetClient.send('war_declared', {
        byPlayerId: player.id,
        byPlayerName: player.name,
      });
    }

    player.lastActivityTick = this.state.currentTick;
    console.log(`[GameRoom] ${player.name} declared war on ${targetPlayer.name}`);
  }

  /**
   * Propose peace to another player
   */
  private proposePeace(client: Client, targetPlayerId: string): void {
    const player = this.state.players.get(client.sessionId);
    
    if (!player) {
      return;
    }

    // Check current relation
    const relation = this.getOrCreateDiplomacy(player.id, targetPlayerId);
    if (relation.status !== 'war') {
      console.log(`[GameRoom] Not at war with ${targetPlayerId}`);
      return;
    }

    // Validate: target player exists and is connected
    const targetPlayer = Array.from(this.state.players.values())
      .find(p => p.id === targetPlayerId && p.isConnected);
    
    if (!targetPlayer) {
      console.log(`[GameRoom] Target player ${targetPlayerId} not found or disconnected`);
      return;
    }

    // Create pending offer
    const offerId = this.getDiplomacyId(player.id, targetPlayerId);
    this.pendingOffers.set(offerId, {
      from: player.id,
      to: targetPlayerId,
      type: 'peace',
      tick: this.state.currentTick,
    });

    // Notify target player
    const targetClient = Array.from(this.clients).find(c => c.sessionId === targetPlayer.sessionId);
    if (targetClient) {
      targetClient.send('peace_offer', {
        fromPlayerId: player.id,
        fromPlayerName: player.name,
      });
    }

    player.lastActivityTick = this.state.currentTick;
    console.log(`[GameRoom] ${player.name} proposed peace to ${targetPlayer.name}`);
  }

  /**
   * Accept peace offer
   */
  private acceptPeace(client: Client, fromPlayerId: string): void {
    const player = this.state.players.get(client.sessionId);
    
    if (!player) {
      return;
    }

    // Find pending offer
    const offerId = this.getDiplomacyId(player.id, fromPlayerId);
    const offer = this.pendingOffers.get(offerId);
    
    if (!offer || offer.type !== 'peace' || offer.to !== player.id) {
      console.log(`[GameRoom] No valid peace offer from ${fromPlayerId}`);
      return;
    }

    // Update diplomacy status
    const relation = this.getOrCreateDiplomacy(player.id, fromPlayerId);
    relation.status = 'neutral';
    relation.establishedTick = this.state.currentTick;

    // Remove pending offer
    this.pendingOffers.delete(offerId);

    // Notify both players
    const fromPlayer = Array.from(this.state.players.values()).find(p => p.id === fromPlayerId);
    if (fromPlayer) {
      const fromClient = Array.from(this.clients).find(c => c.sessionId === fromPlayer.sessionId);
      if (fromClient) {
        fromClient.send('peace_established', {
          withPlayerId: player.id,
          withPlayerName: player.name,
        });
      }
    }

    player.lastActivityTick = this.state.currentTick;
    console.log(`[GameRoom] Peace established between ${fromPlayer?.name} and ${player.name}`);
  }

  /**
   * Handle chat message from client
   */
  private handleChatMessage(client: Client, message: { content?: string }): void {
    const player = this.state.players.get(client.sessionId);
    
    if (!player) {
      client.send('chat_error', { error: 'Player not found' });
      return;
    }

    // Validate message content exists
    if (typeof message.content !== 'string') {
      client.send('chat_error', { error: 'Invalid message format' });
      return;
    }

    // Trim and validate message
    const trimmedContent = message.content.trim();
    
    if (trimmedContent.length === 0) {
      client.send('chat_error', { error: 'Message cannot be empty' });
      return;
    }
    
    if (trimmedContent.length > CHAT_MAX_LENGTH) {
      client.send('chat_error', { 
        error: `Message too long (max ${CHAT_MAX_LENGTH} characters)` 
      });
      return;
    }

    // Check rate limit
    if (!this.checkChatRateLimit(client.sessionId)) {
      client.send('chat_error', { 
        error: `Rate limit exceeded (max ${CHAT_RATE_LIMIT_MESSAGES} messages per ${CHAT_RATE_LIMIT_WINDOW_MS / 1000} seconds)` 
      });
      return;
    }

    // Sanitize content using xss library
    const sanitizedContent = xss(trimmedContent);

    // Create and broadcast chat message
    this.broadcast('chat_message', {
      id: randomUUID(),
      playerId: player.id,
      playerName: player.name,
      content: sanitizedContent,
      timestamp: Date.now(),
    });

    // Update player activity
    player.lastActivityTick = this.state.currentTick;

    console.log(`[GameRoom] Chat from ${player.name}: ${sanitizedContent.substring(0, 50)}${sanitizedContent.length > 50 ? '...' : ''}`);
  }

  /**
   * Check if client is within chat rate limit
   */
  private checkChatRateLimit(sessionId: string): boolean {
    const now = Date.now();
    let rateLimit = this.chatRateLimits.get(sessionId);

    if (!rateLimit) {
      rateLimit = {
        messages: [],
        lastChecked: now,
      };
      this.chatRateLimits.set(sessionId, rateLimit);
    }

    // Remove messages outside the window (rolling window)
    rateLimit.messages = rateLimit.messages.filter(
      timestamp => now - timestamp < CHAT_RATE_LIMIT_WINDOW_MS
    );

    // Check if under limit
    if (rateLimit.messages.length >= CHAT_RATE_LIMIT_MESSAGES) {
      return false;
    }

    // Add current message timestamp
    rateLimit.messages.push(now);
    rateLimit.lastChecked = now;

    return true;
  }
}
