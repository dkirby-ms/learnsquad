/**
 * Core type definitions for the game simulation layer.
 * 
 * DESIGN: Pure data types with no dependencies on external systems.
 * This module should be extractable to Rust/Go with minimal changes.
 */

// ============================================================================
// Resource System
// ============================================================================

export type ResourceType = 'minerals' | 'energy' | 'research' | 'influence';

export interface Resource {
  readonly type: ResourceType;
  quantity: number;
  /** Amount regenerated per tick (can be negative for depleting resources) */
  regenRate: number;
  /** Maximum capacity. -1 means unlimited */
  maxCapacity: number;
}

export interface ResourceMap {
  [key: string]: Resource;
}

// ============================================================================
// World Topology
// ============================================================================

export type ConnectionType = 'direct' | 'gateway';

export interface Connection {
  readonly id: string;
  readonly type: ConnectionType;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  /** Cost in ticks to traverse this connection */
  readonly traversalCost: number;
  /** Whether this connection is currently active/usable */
  active: boolean;
}

export interface NodePosition {
  readonly x: number;
  readonly y: number;
  /** Optional z for 3D positioning */
  readonly z?: number;
}

export interface NodeMetadata {
  readonly name: string;
  readonly description?: string;
  /** Custom properties for game-specific data */
  readonly properties?: Record<string, unknown>;
}

export interface Node {
  readonly id: string;
  readonly position: NodePosition;
  readonly metadata: NodeMetadata;
  resources: ResourceMap;
  /** IDs of outgoing connections from this node */
  readonly connectionIds: string[];
}

// ============================================================================
// Game State
// ============================================================================

export interface GameWorld {
  readonly nodes: Map<string, Node>;
  readonly connections: Map<string, Connection>;
  /** Global resources not tied to any node */
  globalResources: ResourceMap;
}

// ============================================================================
// Time & Tick System
// ============================================================================

export type GameSpeed = 0 | 1 | 2 | 3 | 4 | 5;

export interface TimeState {
  /** Current tick number (monotonically increasing) */
  currentTick: number;
  /** Game speed multiplier. 0 = paused */
  speed: GameSpeed;
  /** Milliseconds per tick at speed 1 */
  readonly baseTickDuration: number;
}

// ============================================================================
// Event System
// ============================================================================

export type GameEventType =
  | 'resource_change'
  | 'connection_toggle'
  | 'node_created'
  | 'node_destroyed'
  | 'tick_processed';

export interface GameEvent {
  readonly id: string;
  readonly type: GameEventType;
  readonly tick: number;
  readonly timestamp: number;
  readonly payload: unknown;
}

export interface ResourceChangePayload {
  readonly nodeId: string | null; // null for global resources
  readonly resourceType: ResourceType;
  readonly delta: number;
  readonly newQuantity: number;
}

export interface ConnectionTogglePayload {
  readonly connectionId: string;
  readonly active: boolean;
}

// ============================================================================
// Random Number Generation (for determinism)
// ============================================================================

export interface SeededRandom {
  /** Current seed state */
  seed: number;
  /** Get next random float [0, 1) */
  next(): number;
  /** Get random integer in range [min, max] inclusive */
  nextInt(min: number, max: number): number;
}

// ============================================================================
// Game Loop State
// ============================================================================

export interface GameLoopState {
  readonly world: GameWorld;
  readonly time: TimeState;
  readonly eventQueue: GameEvent[];
  readonly eventHistory: GameEvent[];
  readonly random: SeededRandom;
}

// ============================================================================
// Tick Processing
// ============================================================================

export interface TickResult {
  readonly tick: number;
  readonly events: GameEvent[];
  readonly duration: number; // Processing time in ms
}

/** Pure function type for tick processors */
export type TickProcessor = (state: GameLoopState) => TickResult;
