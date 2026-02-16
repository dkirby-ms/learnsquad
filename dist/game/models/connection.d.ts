/**
 * Pure functions for Connection operations.
 * No side effects - returns new state.
 */
import type { Connection, ConnectionType, EntityId } from '../types';
/** Create a new connection between nodes */
export declare function createConnection(id: EntityId, fromNodeId: EntityId, toNodeId: EntityId, type?: ConnectionType, travelTime?: number): Connection;
/** Activate a connection */
export declare function activateConnection(connection: Connection): Connection;
/** Deactivate a connection */
export declare function deactivateConnection(connection: Connection): Connection;
/** Check if a connection links two specific nodes (in either direction) */
export declare function connectsNodes(connection: Connection, nodeA: EntityId, nodeB: EntityId): boolean;
/** Get the other node in a connection */
export declare function getOtherNode(connection: Connection, nodeId: EntityId): EntityId | null;
//# sourceMappingURL=connection.d.ts.map