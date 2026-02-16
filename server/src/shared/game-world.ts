/**
 * Game World Operations (Server-side)
 * 
 * Pure functions for GameWorld operations.
 * Subset of src/game/models/world.ts for server use.
 */

import type { GameWorld, GameSpeed, GameEvent, EntityId, Node } from './game-types';

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
