"use strict";
/**
 * Pure functions for GameWorld operations.
 * No side effects - returns new state.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGameWorld = createGameWorld;
exports.addNode = addNode;
exports.updateNode = updateNode;
exports.addConnection = addConnection;
exports.advanceTick = advanceTick;
exports.setSpeed = setSpeed;
exports.pause = pause;
exports.unpause = unpause;
exports.queueEvents = queueEvents;
exports.clearEventQueue = clearEventQueue;
exports.getNode = getNode;
exports.getAllNodes = getAllNodes;
exports.getAllConnections = getAllConnections;
exports.setNodes = setNodes;
/** Create a new empty game world */
function createGameWorld(id = 'world-1') {
    return {
        id,
        currentTick: 0,
        speed: 1,
        isPaused: true,
        nodes: {},
        connections: {},
        eventQueue: [],
    };
}
/** Add a node to the world */
function addNode(world, node) {
    return {
        ...world,
        nodes: {
            ...world.nodes,
            [node.id]: node,
        },
    };
}
/** Update a node in the world */
function updateNode(world, node) {
    if (!world.nodes[node.id]) {
        return world;
    }
    return {
        ...world,
        nodes: {
            ...world.nodes,
            [node.id]: node,
        },
    };
}
/** Add a connection to the world */
function addConnection(world, connection) {
    return {
        ...world,
        connections: {
            ...world.connections,
            [connection.id]: connection,
        },
    };
}
/** Update world tick */
function advanceTick(world) {
    return {
        ...world,
        currentTick: world.currentTick + 1,
    };
}
/** Set game speed */
function setSpeed(world, speed) {
    return {
        ...world,
        speed,
        isPaused: speed === 0,
    };
}
/** Pause the game */
function pause(world) {
    return {
        ...world,
        isPaused: true,
    };
}
/** Unpause the game */
function unpause(world) {
    return {
        ...world,
        isPaused: false,
    };
}
/** Add events to the event queue */
function queueEvents(world, events) {
    return {
        ...world,
        eventQueue: [...world.eventQueue, ...events],
    };
}
/** Clear the event queue */
function clearEventQueue(world) {
    return {
        ...world,
        eventQueue: [],
    };
}
/** Get a node by ID */
function getNode(world, nodeId) {
    return world.nodes[nodeId];
}
/** Get all nodes as array */
function getAllNodes(world) {
    return Object.values(world.nodes);
}
/** Get all connections as array */
function getAllConnections(world) {
    return Object.values(world.connections);
}
/** Replace entire nodes state (used after tick processing) */
function setNodes(world, nodes) {
    return {
        ...world,
        nodes,
    };
}
//# sourceMappingURL=world.js.map