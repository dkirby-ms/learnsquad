/**
 * Pure functions for Node operations.
 * No side effects - returns new state.
 */

import type { Node, Resource, EntityId, NodeStatus, GameEvent, Tick, GameEventType } from '../types';
import { processNodeResources, type Producer, type Consumer } from '../systems/resources';

/** Create a new node */
export function createNode(
  id: EntityId,
  name: string,
  position: { x: number; y: number },
  resources: Resource[] = [],
  connectionIds: EntityId[] = []
): Node {
  return {
    id,
    name,
    position: { x: position.x, y: position.y },
    status: 'neutral' as NodeStatus,
    ownerId: null,
    resources,
    connectionIds,
  };
}

/**
 * Process all resources at a node for one tick.
 * Supports optional producers and consumers for advanced resource mechanics.
 */
export function tickNode(
  node: Node,
  currentTick: Tick,
  producers: readonly Producer[] = [],
  consumers: readonly Consumer[] = []
): { node: Node; events: GameEvent[] } {
  return processNodeResources(node, currentTick, producers, consumers);
}

/** Claim a node for a player */
export function claimNode(node: Node, ownerId: EntityId): Node {
  return {
    ...node,
    status: 'claimed' as NodeStatus,
    ownerId,
  };
}

/** Add a connection to a node */
export function addConnection(node: Node, connectionId: EntityId): Node {
  if (node.connectionIds.includes(connectionId)) {
    return node;
  }
  return {
    ...node,
    connectionIds: [...node.connectionIds, connectionId],
  };
}

/** Get neighboring node IDs from connections */
export function getNeighborIds(
  node: Node,
  connections: Record<EntityId, { fromNodeId: EntityId; toNodeId: EntityId }>
): EntityId[] {
  return node.connectionIds
    .map(connId => {
      const conn = connections[connId];
      if (!conn) return null;
      return conn.fromNodeId === node.id ? conn.toNodeId : conn.fromNodeId;
    })
    .filter((id): id is EntityId => id !== null);
}
