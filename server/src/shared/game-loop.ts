/**
 * Server-side Game Loop
 * 
 * Manages tick scheduling and execution for game rooms.
 * Simplified version that delegates to Miller's processTick when available,
 * or runs a basic tick for testing.
 */

import type { GameWorld, TickResult, GameEvent, GameEventType, EntityId, Node } from './game-types';
import { advanceTick, clearEventQueue, queueEvents, setNodes } from './game-world';

/**
 * Process a single game tick (server-side)
 * 
 * NOTE: This is a simplified tick processor for the server.
 * In production, this should call Miller's game systems for proper simulation.
 */
export function processTick(world: GameWorld): TickResult {
  // If paused, return unchanged state with no events
  if (world.isPaused) {
    return {
      world,
      events: [],
      processedTick: world.currentTick,
    };
  }

  const nextTick = world.currentTick + 1;
  const collectedEvents: GameEvent[] = [];
  const updatedNodes: Record<EntityId, Node> = {};

  // Process each node (simplified - just tick resources)
  for (const [nodeId, node] of Object.entries(world.nodes)) {
    const { node: tickedNode, events } = tickNodeResources(node, nextTick);
    updatedNodes[nodeId] = tickedNode;
    collectedEvents.push(...events);
  }

  // Add tick processed event
  collectedEvents.push({
    type: 'tick_processed' as GameEventType,
    tick: nextTick,
    entityId: world.id,
    data: { previousTick: world.currentTick },
  });

  // Build new world state
  let newWorld = setNodes(world, updatedNodes);
  newWorld = advanceTick(newWorld);
  newWorld = clearEventQueue(newWorld);
  newWorld = queueEvents(newWorld, collectedEvents);

  return {
    world: newWorld,
    events: collectedEvents,
    processedTick: nextTick,
  };
}

/**
 * Simplified node tick - processes resource regeneration
 */
function tickNodeResources(
  node: Node,
  tick: number
): { node: Node; events: GameEvent[] } {
  const events: GameEvent[] = [];
  
  const updatedResources = node.resources.map(resource => {
    let newAmount = resource.amount + resource.regenRate;
    
    // Clamp to 0 and maxCapacity
    if (newAmount < 0) newAmount = 0;
    if (newAmount > resource.maxCapacity) newAmount = resource.maxCapacity;
    
    return {
      ...resource,
      amount: newAmount,
    };
  });

  return {
    node: {
      ...node,
      resources: updatedResources,
    },
    events,
  };
}

/**
 * GameLoop class - manages tick scheduling and execution
 */
export class GameLoop {
  private world: GameWorld;
  private listeners: Set<(result: TickResult) => void>;
  private tickInterval: ReturnType<typeof setInterval> | null;
  private readonly baseTickRate: number;

  constructor(initialWorld: GameWorld, baseTickRate: number = 1000) {
    this.world = initialWorld;
    this.listeners = new Set();
    this.tickInterval = null;
    this.baseTickRate = baseTickRate;
  }

  /** Get current world state */
  getWorld(): GameWorld {
    return this.world;
  }

  /** Get current tick number */
  getCurrentTick(): number {
    return this.world.currentTick;
  }

  /** Check if the game is paused */
  isPaused(): boolean {
    return this.world.isPaused;
  }

  /** Subscribe to tick events */
  subscribe(listener: (result: TickResult) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Process a single tick manually */
  tick(): TickResult {
    const result = processTick(this.world);
    this.world = result.world;
    this.notifyListeners(result);
    return result;
  }

  /** Start automatic tick processing */
  start(): void {
    if (this.tickInterval !== null) {
      return;
    }

    // Unpause the world
    this.world = {
      ...this.world,
      isPaused: false,
    };

    const interval = Math.floor(this.baseTickRate / (this.world.speed || 1));
    this.tickInterval = setInterval(() => this.tick(), interval);
  }

  /** Stop automatic tick processing */
  stop(): void {
    if (this.tickInterval !== null) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    this.world = {
      ...this.world,
      isPaused: true,
    };
  }

  /** Set a new world state (for loading saves, etc.) */
  setWorld(world: GameWorld): void {
    this.world = world;
  }

  /** Notify all listeners of a tick result */
  private notifyListeners(result: TickResult): void {
    this.listeners.forEach(listener => listener(result));
  }
}
