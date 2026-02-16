"use strict";
/**
 * Pure functions for Connection operations.
 * No side effects - returns new state.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createConnection = createConnection;
exports.activateConnection = activateConnection;
exports.deactivateConnection = deactivateConnection;
exports.connectsNodes = connectsNodes;
exports.getOtherNode = getOtherNode;
/** Create a new connection between nodes */
function createConnection(id, fromNodeId, toNodeId, type = 'direct', travelTime = 1) {
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
function activateConnection(connection) {
    return {
        ...connection,
        isActive: true,
    };
}
/** Deactivate a connection */
function deactivateConnection(connection) {
    return {
        ...connection,
        isActive: false,
    };
}
/** Check if a connection links two specific nodes (in either direction) */
function connectsNodes(connection, nodeA, nodeB) {
    return ((connection.fromNodeId === nodeA && connection.toNodeId === nodeB) ||
        (connection.fromNodeId === nodeB && connection.toNodeId === nodeA));
}
/** Get the other node in a connection */
function getOtherNode(connection, nodeId) {
    if (connection.fromNodeId === nodeId)
        return connection.toNodeId;
    if (connection.toNodeId === nodeId)
        return connection.fromNodeId;
    return null;
}
//# sourceMappingURL=connection.js.map