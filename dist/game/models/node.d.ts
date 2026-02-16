/**
 * Pure functions for Node operations.
 * No side effects - returns new state.
 */
import type { Node, Resource, EntityId, GameEvent, Tick } from '../types';
/** Create a new node */
export declare function createNode(id: EntityId, name: string, position: {
    x: number;
    y: number;
}, resources?: Resource[], connectionIds?: EntityId[]): Node;
/** Process all resources at a node for one tick */
export declare function tickNode(node: Node, currentTick: Tick): {
    node: Node;
    events: GameEvent[];
};
/** Claim a node for a player */
export declare function claimNode(node: Node, ownerId: EntityId): Node;
/** Add a connection to a node */
export declare function addConnection(node: Node, connectionId: EntityId): Node;
/** Get neighboring node IDs from connections */
export declare function getNeighborIds(node: Node, connections: Record<EntityId, {
    fromNodeId: EntityId;
    toNodeId: EntityId;
}>): EntityId[];
//# sourceMappingURL=node.d.ts.map