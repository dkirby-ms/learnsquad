/**
 * Client-side game state store.
 * 
 * Holds the current GameWorld state received from the Colyseus server.
 * State updates come through Colyseus schema synchronization.
 * Uses a simple pub/sub pattern for React integration.
 */

import {
  GameWorld,
  GameEvent,
  GameSpeed,
  Tick,
} from '../game/types';

/** Maximum number of events to keep in history */
const MAX_EVENT_HISTORY = 100;

/** Maximum number of tick snapshots to keep */
const MAX_TICK_HISTORY = 10;

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
 * With Colyseus, state updates come through schema synchronization.
 * This store receives full snapshots on each state change.
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

  /** Apply a full world snapshot (from Colyseus state sync) */
  applySnapshot(world: GameWorld): void {
    this.world = world;
    this.recordTick(world.currentTick);
    this.notify();
  }

  /** Add events to history (from Colyseus 'events' message) */
  addEvents(events: GameEvent[]): void {
    this.eventHistory = [...events, ...this.eventHistory].slice(0, MAX_EVENT_HISTORY);
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
