/**
 * Game World Operations (Server-side)
 * 
 * Pure functions for GameWorld operations.
 * Subset of src/game/models/world.ts for server use.
 */

import type { GameWorld, GameSpeed, GameEvent, EntityId, Node, Connection } from './game-types';
import { ResourceType, NodeStatus, ConnectionType } from './game-types';

/** Create a new game world with some initial content */
export function createGameWorld(id: EntityId = 'world-1'): GameWorld {
  // Create initial nodes for a starter map
  const nodes: Record<EntityId, Node> = {
    'node-1': {
      id: 'node-1',
      name: 'Sol System',
      position: { x: 400, y: 300 },
      status: NodeStatus.Neutral,
      ownerId: null,
      resources: [
        { type: ResourceType.Energy, amount: 100, regenRate: 5, maxCapacity: 500 },
        { type: ResourceType.Minerals, amount: 50, regenRate: 2, maxCapacity: 300 },
      ],
      connectionIds: ['conn-1', 'conn-2'],
    },
    'node-2': {
      id: 'node-2',
      name: 'Alpha Centauri',
      position: { x: 600, y: 200 },
      status: NodeStatus.Neutral,
      ownerId: null,
      resources: [
        { type: ResourceType.Minerals, amount: 200, regenRate: 8, maxCapacity: 500 },
      ],
      connectionIds: ['conn-1', 'conn-3'],
    },
    'node-3': {
      id: 'node-3',
      name: 'Sirius',
      position: { x: 200, y: 400 },
      status: NodeStatus.Neutral,
      ownerId: null,
      resources: [
        { type: ResourceType.Energy, amount: 300, regenRate: 10, maxCapacity: 800 },
        { type: ResourceType.Research, amount: 20, regenRate: 1, maxCapacity: 100 },
      ],
      connectionIds: ['conn-2'],
    },
    'node-4': {
      id: 'node-4',
      name: 'Proxima',
      position: { x: 700, y: 400 },
      status: NodeStatus.Neutral,
      ownerId: null,
      resources: [
        { type: ResourceType.Alloys, amount: 50, regenRate: 3, maxCapacity: 200 },
      ],
      connectionIds: ['conn-3'],
    },
  };

  const connections: Record<EntityId, Connection> = {
    'conn-1': {
      id: 'conn-1',
      fromNodeId: 'node-1',
      toNodeId: 'node-2',
      type: ConnectionType.Direct,
      travelTime: 3,
      isActive: true,
    },
    'conn-2': {
      id: 'conn-2',
      fromNodeId: 'node-1',
      toNodeId: 'node-3',
      type: ConnectionType.Direct,
      travelTime: 2,
      isActive: true,
    },
    'conn-3': {
      id: 'conn-3',
      fromNodeId: 'node-2',
      toNodeId: 'node-4',
      type: ConnectionType.Gateway,
      travelTime: 5,
      isActive: true,
    },
  };

  return {
    id,
    currentTick: 0,
    speed: 1 as GameSpeed,
    isPaused: true,
    nodes,
    connections,
    eventQueue: [],
  };
}

/** Advance the tick counter */
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

/** Replace entire nodes state */
export function setNodes(
  world: GameWorld,
  nodes: Readonly<Record<EntityId, Node>>
): GameWorld {
  return {
    ...world,
    nodes,
  };
}
