/**
 * Pure functions for Connection operations.
 * No side effects - returns new state.
 */

import type { Connection, ConnectionType, EntityId } from '../types';

/** Create a new connection between nodes */
export function createConnection(
  id: EntityId,
  fromNodeId: EntityId,
  toNodeId: EntityId,
  type: ConnectionType = 'direct' as ConnectionType,
  travelTime: number = 1
): Connection {
  return {
    id,
    fromNodeId,
    toNodeId,
    type,
    travelTime,
    isActive: true,
  };
}

/** Activate a connection */
export function activateConnection(connection: Connection): Connection {
  return {
    ...connection,
    isActive: true,
  };
}

/** Deactivate a connection */
export function deactivateConnection(connection: Connection): Connection {
  return {
    ...connection,
    isActive: false,
  };
}

/** Check if a connection links two specific nodes (in either direction) */
export function connectsNodes(
  connection: Connection,
  nodeA: EntityId,
  nodeB: EntityId
): boolean {
  return (
    (connection.fromNodeId === nodeA && connection.toNodeId === nodeB) ||
    (connection.fromNodeId === nodeB && connection.toNodeId === nodeA)
  );
}

/** Get the other node in a connection */
export function getOtherNode(connection: Connection, nodeId: EntityId): EntityId | null {
  if (connection.fromNodeId === nodeId) return connection.toNodeId;
  if (connection.toNodeId === nodeId) return connection.fromNodeId;
  return null;
}
