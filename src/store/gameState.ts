/**
 * Client-side game state store.
 * 
 * Holds the current GameWorld state received from the server and provides
 * methods for applying delta updates efficiently. Uses a simple pub/sub
 * pattern for React integration.
 */

import {
  GameWorld,
  GameEvent,
  GameSpeed,
  Tick,
  EntityId,
  Node,
  Connection,
} from '../game/types';

/** Maximum number of events to keep in history */
const MAX_EVENT_HISTORY = 100;

/** Maximum number of tick snapshots to keep */
const MAX_TICK_HISTORY = 10;

/** Message types from the WebSocket server */
export enum ServerMessageType {
  /** Full world state snapshot */
  WorldSnapshot = 'world_snapshot',
  /** Incremental state update */
  WorldDelta = 'world_delta',
  /** Game events from tick processing */
  Events = 'events',
  /** Tick processed notification */
  TickProcessed = 'tick_processed',
  /** Game speed/pause state changed */
  SpeedChanged = 'speed_changed',
  /** Error from server */
  Error = 'error',
  /** Connection established */
  Connected = 'connected',
}

/** Message types to the WebSocket server */
export enum ClientMessageType {
  /** Request to join a game */
  JoinGame = 'join_game',
  /** Request to pause the game */
  Pause = 'pause',
  /** Request to resume the game */
  Resume = 'resume',
  /** Request to set game speed */
  SetSpeed = 'set_speed',
  /** Ping for keep-alive */
  Ping = 'ping',
}

/** Server message structure */
export interface ServerMessage {
  type: ServerMessageType;
  payload: unknown;
}

/** Client message structure */
export interface ClientMessage {
  type: ClientMessageType;
  payload?: unknown;
}

/** World snapshot payload */
export interface WorldSnapshotPayload {
  world: GameWorld;
}

/** World delta payload - partial updates to world state */
export interface WorldDeltaPayload {
  tick: Tick;
  nodes?: Record<EntityId, Partial<Node>>;
  connections?: Record<EntityId, Partial<Connection>>;
  speed?: GameSpeed;
  isPaused?: boolean;
}

/** Events payload */
export interface EventsPayload {
  events: GameEvent[];
}

/** Speed changed payload */
export interface SpeedChangedPayload {
  speed: GameSpeed;
  isPaused: boolean;
}

/** Tick snapshot for history */
interface TickSnapshot {
  tick: Tick;
  timestamp: number;
}

/** Subscriber callback type */
type Subscriber = () => void;

/**
 * Game state store - manages client-side game state.
 * 
 * Design: Simple observable store, not using Redux/Zustand for now to keep
 * dependencies minimal. Can be upgraded if state complexity warrants it.
 */
class GameStateStore {
  private world: GameWorld | null = null;
  private eventHistory: GameEvent[] = [];
  private tickHistory: TickSnapshot[] = [];
  private subscribers: Set<Subscriber> = new Set();

  /** Get current world state */
  getWorld(): GameWorld | null {
    return this.world;
  }

  /** Get event history (most recent first) */
  getEventHistory(): readonly GameEvent[] {
    return this.eventHistory;
  }

  /** Get tick history for latency/performance tracking */
  getTickHistory(): readonly TickSnapshot[] {
    return this.tickHistory;
  }

  /** Get current tick, or 0 if no world loaded */
  getCurrentTick(): Tick {
    return this.world?.currentTick ?? 0;
  }

  /** Check if game is paused */
  isPaused(): boolean {
    return this.world?.isPaused ?? true;
  }

  /** Get current game speed */
  getSpeed(): GameSpeed {
    return this.world?.speed ?? GameSpeed.Paused;
  }

  /** Apply a full world snapshot */
  applySnapshot(world: GameWorld): void {
    this.world = world;
    this.recordTick(world.currentTick);
    this.notify();
  }

  /** Apply a delta update to the world */
  applyDelta(delta: WorldDeltaPayload): void {
    if (!this.world) {
      console.warn('Received delta but no world snapshot exists');
      return;
    }

    // Build updated nodes
    let updatedNodes: Record<EntityId, Node> = { ...this.world.nodes };
    if (delta.nodes) {
      for (const [id, nodeUpdate] of Object.entries(delta.nodes)) {
        const existing = updatedNodes[id];
        if (existing) {
          updatedNodes[id] = { ...existing, ...nodeUpdate };
        } else {
          // New node - needs all required fields, but delta should provide them
          updatedNodes[id] = nodeUpdate as Node;
        }
      }
    }

    // Build updated connections
    let updatedConnections: Record<EntityId, Connection> = { ...this.world.connections };
    if (delta.connections) {
      for (const [id, connUpdate] of Object.entries(delta.connections)) {
        const existing = updatedConnections[id];
        if (existing) {
          updatedConnections[id] = { ...existing, ...connUpdate };
        } else {
          updatedConnections[id] = connUpdate as Connection;
        }
      }
    }

    this.world = {
      ...this.world,
      currentTick: delta.tick,
      nodes: updatedNodes,
      connections: updatedConnections,
      speed: delta.speed ?? this.world.speed,
      isPaused: delta.isPaused ?? this.world.isPaused,
    };

    this.recordTick(delta.tick);
    this.notify();
  }

  /** Add events to history */
  addEvents(events: GameEvent[]): void {
    this.eventHistory = [...events, ...this.eventHistory].slice(0, MAX_EVENT_HISTORY);
    this.notify();
  }

  /** Update speed/pause state */
  updateSpeed(speed: GameSpeed, isPaused: boolean): void {
    if (!this.world) return;

    this.world = {
      ...this.world,
      speed,
      isPaused,
    };
    this.notify();
  }

  /** Clear all state (on disconnect) */
  clear(): void {
    this.world = null;
    this.eventHistory = [];
    this.tickHistory = [];
    this.notify();
  }

  /** Subscribe to state changes */
  subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private recordTick(tick: Tick): void {
    this.tickHistory = [
      { tick, timestamp: Date.now() },
      ...this.tickHistory,
    ].slice(0, MAX_TICK_HISTORY);
  }

  private notify(): void {
    for (const subscriber of this.subscribers) {
      subscriber();
    }
  }
}

/** Singleton store instance */
export const gameStateStore = new GameStateStore();

/**
 * Parse a server message and apply it to the store.
 * Returns true if the message was handled.
 */
export function handleServerMessage(message: ServerMessage): boolean {
  switch (message.type) {
    case ServerMessageType.WorldSnapshot: {
      const payload = message.payload as WorldSnapshotPayload;
      gameStateStore.applySnapshot(payload.world);
      return true;
    }

    case ServerMessageType.WorldDelta: {
      const payload = message.payload as WorldDeltaPayload;
      gameStateStore.applyDelta(payload);
      return true;
    }

    case ServerMessageType.Events: {
      const payload = message.payload as EventsPayload;
      gameStateStore.addEvents(payload.events);
      return true;
    }

    case ServerMessageType.SpeedChanged: {
      const payload = message.payload as SpeedChangedPayload;
      gameStateStore.updateSpeed(payload.speed, payload.isPaused);
      return true;
    }

    case ServerMessageType.TickProcessed:
    case ServerMessageType.Connected:
      // Informational, no action needed
      return true;

    case ServerMessageType.Error:
      console.error('Server error:', message.payload);
      return true;

    default:
      console.warn('Unknown server message type:', message.type);
      return false;
  }
}
