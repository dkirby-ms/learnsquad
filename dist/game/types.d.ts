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
export declare enum ResourceType {
    Minerals = "minerals",
    Energy = "energy",
    Alloys = "alloys",
    Research = "research"
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
export declare enum ConnectionType {
    /** Direct connection - always traversable */
    Direct = "direct",
    /** Gateway - may have access restrictions or costs */
    Gateway = "gateway"
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
export declare enum NodeStatus {
    Neutral = "neutral",
    Claimed = "claimed",
    Contested = "contested"
}
/** An interconnected location in the game world */
export interface Node {
    readonly id: EntityId;
    readonly name: string;
    readonly position: {
        readonly x: number;
        readonly y: number;
    };
    readonly status: NodeStatus;
    /** Owner player ID, null if unclaimed */
    readonly ownerId: EntityId | null;
    /** Resources present at this node */
    readonly resources: readonly Resource[];
    /** IDs of connections from this node */
    readonly connectionIds: readonly EntityId[];
}
/** Event types that can occur during simulation */
export declare enum GameEventType {
    ResourceDepleted = "resource_depleted",
    ResourceCapReached = "resource_cap_reached",
    NodeClaimed = "node_claimed",
    TickProcessed = "tick_processed"
}
/** A game event generated during tick processing */
export interface GameEvent {
    readonly type: GameEventType;
    readonly tick: Tick;
    readonly entityId: EntityId;
    readonly data: Readonly<Record<string, unknown>>;
}
/** Game speed settings */
export declare enum GameSpeed {
    Paused = 0,
    Normal = 1,
    Fast = 2,
    VeryFast = 5
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
//# sourceMappingURL=types.d.ts.map