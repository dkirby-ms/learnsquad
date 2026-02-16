/**
 * Pure functions for GameWorld operations.
 * No side effects - returns new state.
 */

import type {
  GameWorld,
  Node,
  Connection,
  EntityId,
  GameSpeed,
  GameEvent,
  Tick,
} from '../types';

/** Create a new empty game world */
export function createGameWorld(id: EntityId = 'world-1'): GameWorld {
  return {
    id,
    currentTick: 0,
    speed: 1 as GameSpeed,
    isPaused: true,
    nodes: {},
    connections: {},
    eventQueue: [],
  };
}

/** Add a node to the world */
export function addNode(world: GameWorld, node: Node): GameWorld {
  return {
    ...world,
    nodes: {
      ...world.nodes,
      [node.id]: node,
    },
  };
}

/** Update a node in the world */
export function updateNode(world: GameWorld, node: Node): GameWorld {
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
export function addConnection(world: GameWorld, connection: Connection): GameWorld {
  return {
    ...world,
    connections: {
      ...world.connections,
      [connection.id]: connection,
    },
  };
}

/** Update world tick */
export function advanceTick(world: GameWorld): GameWorld {
  return {
    ...world,
    currentTick: world.currentTick + 1,
  };
}

/** Set game speed */
export function setSpeed(world: GameWorld, speed: GameSpeed): GameWorld {
  return {
    ...world,
    speed,
    isPaused: speed === 0,
  };
}

/** Pause the game */
export function pause(world: GameWorld): GameWorld {
  return {
    ...world,
    isPaused: true,
  };
}

/** Unpause the game */
export function unpause(world: GameWorld): GameWorld {
  return {
    ...world,
    isPaused: false,
  };
}

/** Add events to the event queue */
export function queueEvents(world: GameWorld, events: readonly GameEvent[]): GameWorld {
  return {
    ...world,
    eventQueue: [...world.eventQueue, ...events],
  };
}

/** Clear the event queue */
export function clearEventQueue(world: GameWorld): GameWorld {
  return {
    ...world,
    eventQueue: [],
  };
}

/** Get a node by ID */
export function getNode(world: GameWorld, nodeId: EntityId): Node | undefined {
  return world.nodes[nodeId];
}

/** Get all nodes as array */
export function getAllNodes(world: GameWorld): Node[] {
  return Object.values(world.nodes);
}

/** Get all connections as array */
export function getAllConnections(world: GameWorld): Connection[] {
  return Object.values(world.connections);
}

/** Replace entire nodes state (used after tick processing) */
export function setNodes(
  world: GameWorld,
  nodes: Readonly<Record<EntityId, Node>>
): GameWorld {
  return {
    ...world,
    nodes,
  };
}
