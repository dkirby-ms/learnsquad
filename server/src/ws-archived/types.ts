/**
 * WebSocket Message Types
 * 
 * Protocol for client-server communication.
 * All messages are JSON-encoded.
 * 
 * Design decisions:
 * - JSON over binary: debugging > raw perf for now
 * - Type discriminated unions: TypeScript can narrow properly
 * - Delta encoding via changedNodeIds: only serialize what changed
 */

import type {
  GameWorld,
  TickResult,
  Node,
  Connection,
  GameEvent,
  GameSpeed,
  EntityId,
  Tick,
} from '../shared/game-types';

// Re-export game types for convenience
export type { GameWorld, Node, Connection, GameEvent, TickResult };
export { GameSpeed };

// ============================================
// Server -> Client Messages
// ============================================

/** Full game state snapshot (sent on join or resync) */
export interface GameStateUpdate {
  type: 'game_state_update';
  /** Full world state */
  world: GameWorld;
  /** Timestamp for latency calculation */
  serverTime: number;
}

/** Delta update after a tick (only changed data) */
export interface TickComplete {
  type: 'tick_complete';
  /** Tick number that was just processed */
  tick: Tick;
  /** Events emitted during this tick */
  events: readonly GameEvent[];
  /** IDs of nodes that changed (client should request full node if needed) */
  changedNodeIds: readonly EntityId[];
  /** Changed nodes - included for efficiency */
  changedNodes: Readonly<Record<EntityId, Node>>;
  /** Whether game is paused */
  isPaused: boolean;
  /** Current game speed */
  speed: GameSpeed;
  /** Server timestamp */
  serverTime: number;
}

/** Confirmation of room join */
export interface RoomJoined {
  type: 'room_joined';
  roomId: string;
  /** Initial game state */
  world: GameWorld;
  /** Player's client ID in this session */
  clientId: string;
}

/** Room leave confirmation */
export interface RoomLeft {
  type: 'room_left';
  roomId: string;
}

/** Error message */
export interface ServerError {
  type: 'error';
  code: string;
  message: string;
}

/** Pause state changed */
export interface PauseStateChanged {
  type: 'pause_state_changed';
  isPaused: boolean;
  tick: Tick;
}

/** Speed changed */
export interface SpeedChanged {
  type: 'speed_changed';
  speed: GameSpeed;
}

/** Pong response to ping */
export interface Pong {
  type: 'pong';
  clientTime: number;
  serverTime: number;
}

/** All server-to-client message types */
export type ServerMessage =
  | GameStateUpdate
  | TickComplete
  | RoomJoined
  | RoomLeft
  | ServerError
  | PauseStateChanged
  | SpeedChanged
  | Pong;

// ============================================
// Client -> Server Messages
// ============================================

/** Request to join a game room */
export interface JoinRoom {
  type: 'join_room';
  roomId: string;
  /** Optional auth token */
  token?: string;
}

/** Request to leave current room */
export interface LeaveRoom {
  type: 'leave_room';
  roomId: string;
}

/** Request to pause the game */
export interface PauseGame {
  type: 'pause_game';
}

/** Request to resume the game */
export interface ResumeGame {
  type: 'resume_game';
}

/** Set game speed */
export interface SetSpeed {
  type: 'set_speed';
  speed: GameSpeed;
}

/** Generic player action (extensible for future game commands) */
export interface PlayerAction {
  type: 'player_action';
  action: string;
  payload: Record<string, unknown>;
}

/** Request full state resync */
export interface RequestSync {
  type: 'request_sync';
}

/** Ping for latency measurement */
export interface Ping {
  type: 'ping';
  clientTime: number;
}

/** All client-to-server message types */
export type ClientMessage =
  | JoinRoom
  | LeaveRoom
  | PauseGame
  | ResumeGame
  | SetSpeed
  | PlayerAction
  | RequestSync
  | Ping;

// ============================================
// Utility Types
// ============================================

/** Parse a raw message into a typed ClientMessage */
export function parseClientMessage(data: string): ClientMessage | null {
  try {
    const msg = JSON.parse(data);
    if (typeof msg !== 'object' || !msg.type) {
      return null;
    }
    return msg as ClientMessage;
  } catch {
    return null;
  }
}

/** Serialize a ServerMessage for sending */
export function serializeServerMessage(msg: ServerMessage): string {
  return JSON.stringify(msg);
}
