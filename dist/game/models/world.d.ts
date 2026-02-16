/**
 * Pure functions for GameWorld operations.
 * No side effects - returns new state.
 */
import type { GameWorld, Node, Connection, EntityId, GameSpeed, GameEvent } from '../types';
/** Create a new empty game world */
export declare function createGameWorld(id?: EntityId): GameWorld;
/** Add a node to the world */
export declare function addNode(world: GameWorld, node: Node): GameWorld;
/** Update a node in the world */
export declare function updateNode(world: GameWorld, node: Node): GameWorld;
/** Add a connection to the world */
export declare function addConnection(world: GameWorld, connection: Connection): GameWorld;
/** Update world tick */
export declare function advanceTick(world: GameWorld): GameWorld;
/** Set game speed */
export declare function setSpeed(world: GameWorld, speed: GameSpeed): GameWorld;
/** Pause the game */
export declare function pause(world: GameWorld): GameWorld;
/** Unpause the game */
export declare function unpause(world: GameWorld): GameWorld;
/** Add events to the event queue */
export declare function queueEvents(world: GameWorld, events: readonly GameEvent[]): GameWorld;
/** Clear the event queue */
export declare function clearEventQueue(world: GameWorld): GameWorld;
/** Get a node by ID */
export declare function getNode(world: GameWorld, nodeId: EntityId): Node | undefined;
/** Get all nodes as array */
export declare function getAllNodes(world: GameWorld): Node[];
/** Get all connections as array */
export declare function getAllConnections(world: GameWorld): Connection[];
/** Replace entire nodes state (used after tick processing) */
export declare function setNodes(world: GameWorld, nodes: Readonly<Record<EntityId, Node>>): GameWorld;
//# sourceMappingURL=world.d.ts.map