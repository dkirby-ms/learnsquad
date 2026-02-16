"use strict";
/**
 * Pure functions for Node operations.
 * No side effects - returns new state.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNode = createNode;
exports.tickNode = tickNode;
exports.claimNode = claimNode;
exports.addConnection = addConnection;
exports.getNeighborIds = getNeighborIds;
const resource_1 = require("./resource");
/** Create a new node */
function createNode(id, name, position, resources = [], connectionIds = []) {
    return {
        id,
        name,
        position: { x: position.x, y: position.y },
        status: 'neutral',
        ownerId: null,
        resources,
        connectionIds,
    };
}
/** Process all resources at a node for one tick */
function tickNode(node, currentTick) {
    const events = [];
    const newResources = [];
    for (const resource of node.resources) {
        const result = (0, resource_1.tickResource)(resource);
        newResources.push(result.resource);
        if (result.wasDepleted) {
            events.push({
                type: 'resource_depleted',
                tick: currentTick,
                entityId: node.id,
                data: { resourceType: resource.type },
            });
        }
        if (result.wasCapReached) {
            events.push({
                type: 'resource_cap_reached',
                tick: currentTick,
                entityId: node.id,
                data: { resourceType: resource.type },
            });
        }
    }
    return {
        node: {
            ...node,
            resources: newResources,
        },
        events,
    };
}
/** Claim a node for a player */
function claimNode(node, ownerId) {
    return {
        ...node,
        status: 'claimed',
        ownerId,
    };
}
/** Add a connection to a node */
function addConnection(node, connectionId) {
    if (node.connectionIds.includes(connectionId)) {
        return node;
    }
    return {
        ...node,
        connectionIds: [...node.connectionIds, connectionId],
    };
}
/** Get neighboring node IDs from connections */
function getNeighborIds(node, connections) {
    return node.connectionIds
        .map(connId => {
        const conn = connections[connId];
        if (!conn)
            return null;
        return conn.fromNodeId === node.id ? conn.toNodeId : conn.fromNodeId;
    })
        .filter((id) => id !== null);
}
//# sourceMappingURL=node.js.map