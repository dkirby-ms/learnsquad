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
  EntityId,
} from '../game/types';

/** Maximum number of events to keep in history */
const MAX_EVENT_HISTORY = 100;

/** Maximum number of tick snapshots to keep */
const MAX_TICK_HISTORY = 10;

/** Player data synced from server */
export interface Player {
  id: EntityId;
  sessionId: string;
  name: string;
  color: string;
  joinedAt: number;
  isConnected: boolean;
  focusedNodeId: string;
  lastActivityTick: number;
}

/** Diplomatic status between two players */
export type DiplomaticStatus = 'neutral' | 'allied' | 'war';

/** Diplomatic relation between two players */
export interface DiplomaticRelation {
  player1Id: EntityId;
  player2Id: EntityId;
  status: DiplomaticStatus;
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
 * With Colyseus, state updates come through schema synchronization.
 * This store receives full snapshots on each state change.
 */
class GameStateStore {
  private world: GameWorld | null = null;
  private players: Map<EntityId, Player> = new Map();
  private diplomaticRelations: Map<string, DiplomaticRelation> = new Map();
  private eventHistory: GameEvent[] = [];
  private tickHistory: TickSnapshot[] = [];
  private subscribers: Set<Subscriber> = new Set();
  
  // Cached arrays for useSyncExternalStore (must return stable references)
  private cachedPlayersArray: Player[] = [];
  private cachedRelationsArray: DiplomaticRelation[] = [];

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

  /** Get all players */
  getPlayers(): Player[] {
    return this.cachedPlayersArray;
  }

  /** Get a specific player by ID */
  getPlayer(playerId: EntityId): Player | undefined {
    return this.players.get(playerId);
  }

  /** Get all diplomatic relations */
  getDiplomaticRelations(): DiplomaticRelation[] {
    return this.cachedRelationsArray;
  }

  /** Get diplomatic status between two players */
  getDiplomaticStatus(player1Id: EntityId, player2Id: EntityId): DiplomaticStatus {
    const key = this.makeDiplomacyKey(player1Id, player2Id);
    const relation = this.diplomaticRelations.get(key);
    return relation?.status ?? 'neutral';
  }

  /** Update diplomatic relations (from server sync) */
  updateDiplomaticRelations(relations: DiplomaticRelation[]): void {
    this.diplomaticRelations.clear();
    relations.forEach((relation) => {
      const key = this.makeDiplomacyKey(relation.player1Id, relation.player2Id);
      this.diplomaticRelations.set(key, relation);
    });
    // Update cached array for stable reference
    this.cachedRelationsArray = Array.from(this.diplomaticRelations.values());
    this.notify();
  }

  /** Get all relations involving a specific player */
  getPlayerRelations(playerId: EntityId): DiplomaticRelation[] {
    return this.getDiplomaticRelations().filter(
      (rel) => rel.player1Id === playerId || rel.player2Id === playerId
    );
  }

  private makeDiplomacyKey(player1Id: EntityId, player2Id: EntityId): string {
    // Always use sorted order to ensure consistent key
    return [player1Id, player2Id].sort().join(':');
  }

  /** Update players data (from Colyseus schema sync) */
  updatePlayers(playerData: Player[]): void {
    this.players.clear();
    playerData.forEach((player) => {
      this.players.set(player.id, player);
    });
    // Update cached array for stable reference
    this.cachedPlayersArray = Array.from(this.players.values());
    this.notify();
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
    this.players.clear();
    this.diplomaticRelations.clear();
    this.eventHistory = [];
    this.tickHistory = [];
    // Reset cached arrays
    this.cachedPlayersArray = [];
    this.cachedRelationsArray = [];
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
    this.subscribers.forEach((subscriber) => {
      subscriber();
    });
  }
}

/** Singleton store instance */
export const gameStateStore = new GameStateStore();
