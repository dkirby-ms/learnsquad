/**
 * Core game types for the simulation layer.
 * 
 * Design principles:
 * - Pure data structures, no methods with side effects
 * - Deterministic: same input always produces same output
 * - Separable: could be translated to Rust/Go
 */

/** Unique identifier for game entities */
export type EntityId = string;

/** Game tick number - all simulation time is measured in ticks */
export type Tick = number;

/** Resource types available in the game */
export enum ResourceType {
  Minerals = 'minerals',
  Energy = 'energy',
  Alloys = 'alloys',
  Research = 'research',
}

/** A resource with current amount and regeneration rate */
export interface Resource {
  readonly type: ResourceType;
  readonly amount: number;
  /** Amount regenerated per tick (can be negative for decay) */
  readonly regenRate: number;
  /** Maximum capacity for this resource */
  readonly maxCapacity: number;
}

/** Connection type between nodes */
export enum ConnectionType {
  /** Direct connection - always traversable */
  Direct = 'direct',
  /** Gateway - may have access restrictions or costs */
  Gateway = 'gateway',
}

/** A link between two nodes */
export interface Connection {
  readonly id: EntityId;
  readonly fromNodeId: EntityId;
  readonly toNodeId: EntityId;
  readonly type: ConnectionType;
  /** Travel cost in ticks */
  readonly travelTime: number;
  /** Whether this connection is currently active */
  readonly isActive: boolean;
}

/** Node status in the game */
export enum NodeStatus {
  Neutral = 'neutral',
  Claimed = 'claimed',
  Contested = 'contested',
}

/** An interconnected location in the game world */
export interface Node {
  readonly id: EntityId;
  readonly name: string;
  readonly position: { readonly x: number; readonly y: number };
  readonly status: NodeStatus;
  /** Owner player ID, null if unclaimed */
  readonly ownerId: EntityId | null;
  /** Resources present at this node */
  readonly resources: readonly Resource[];
  /** IDs of connections from this node */
  readonly connectionIds: readonly EntityId[];
  /** Current control points (progress toward claiming) */
  readonly controlPoints?: number;
  /** Maximum control points needed for full claim */
  readonly maxControlPoints?: number;
}

/** Event types that can occur during simulation */
export enum GameEventType {
  // Resource events
  ResourceDepleted = 'resource_depleted',
  ResourceCapReached = 'resource_cap_reached',
  ResourceProduced = 'resource_produced',
  
  // Node events
  NodeClaimed = 'node_claimed',
  NodeContested = 'node_contested',
  NodeLost = 'node_lost',
  NodeDiscovered = 'node_discovered',
  
  // Connection events
  ConnectionEstablished = 'connection_established',
  ConnectionSevered = 'connection_severed',
  
  // Gateway events
  GatewayActivated = 'gateway_activated',
  GatewayReady = 'gateway_ready',
  GatewayCooldownExpired = 'gateway_cooldown_expired',
  
  // Diplomacy events
  AllianceOffered = 'alliance_offered',
  AllianceFormed = 'alliance_formed',
  AllianceRejected = 'alliance_rejected',
  WarDeclared = 'war_declared',
  PeaceProposed = 'peace_proposed',
  PeaceMade = 'peace_made',
  
  // System events
  TickProcessed = 'tick_processed',
}

/** A game event generated during tick processing */
export interface GameEvent {
  readonly type: GameEventType;
  readonly tick: Tick;
  readonly entityId: EntityId;
  readonly data: Readonly<Record<string, unknown>>;
}

/** Game speed settings */
export enum GameSpeed {
  Paused = 0,
  Normal = 1,
  Fast = 2,
  VeryFast = 5,
}

/** The root game state container */
export interface GameWorld {
  readonly id: EntityId;
  readonly currentTick: Tick;
  readonly speed: GameSpeed;
  readonly isPaused: boolean;
  /** All nodes indexed by ID */
  readonly nodes: Readonly<Record<EntityId, Node>>;
  /** All connections indexed by ID */
  readonly connections: Readonly<Record<EntityId, Connection>>;
  /** Pending events to be processed/emitted */
  readonly eventQueue: readonly GameEvent[];
}

/** Result of processing a game tick */
export interface TickResult {
  readonly world: GameWorld;
  readonly events: readonly GameEvent[];
  readonly processedTick: Tick;
}

// --- Connectivity & Pathfinding Types ---

/** NodeId alias for readability in pathfinding APIs */
export type NodeId = EntityId;

/** Context for evaluating traversal permissions and costs */
export interface TraversalContext {
  /** The entity attempting to traverse (e.g., player ID, fleet ID) */
  readonly traverserId: EntityId;
  /** Current tick for time-based checks */
  readonly currentTick: Tick;
  /** Available resources for cost checks */
  readonly availableResources?: Readonly<Record<ResourceType, number>>;
}

/** Resource cost for traversal or gateway activation */
export interface ResourceCost {
  readonly type: ResourceType;
  readonly amount: number;
}

/** Extended connection properties for gateways */
export interface Gateway extends Connection {
  readonly type: ConnectionType.Gateway;
  /** Resources required to activate the gateway */
  readonly activationCost: readonly ResourceCost[];
  /** Ticks required for activation (cooldown) */
  readonly activationTime: number;
  /** Tick when gateway was last activated (null if never) */
  readonly lastActivatedTick: Tick | null;
  /** Whether gateway is currently cooling down */
  readonly isCoolingDown: boolean;
}

/** A step in a calculated path */
export interface PathStep {
  readonly nodeId: NodeId;
  readonly connectionId: EntityId;
  /** Cumulative cost to reach this step from origin */
  readonly cumulativeCost: number;
}

/** Result of pathfinding between nodes */
export interface Path {
  readonly from: NodeId;
  readonly to: NodeId;
  /** Ordered steps from origin to destination (includes destination, excludes origin) */
  readonly steps: readonly PathStep[];
  /** Total cost of the path */
  readonly totalCost: number;
}

/** Function type for custom cost calculations in pathfinding */
export type CostFunction = (connection: Connection, fromNode: Node, toNode: Node) => number;
