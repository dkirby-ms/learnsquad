/**
 * Game Loop - Core tick processing system.
 * 
 * Design principles:
 * - Pure and deterministic: same world state + tick always produces same result
 * - No side effects: returns new state, never mutates
 * - Separable: this could be extracted to Rust/Go
 * 
 * The game loop processes ticks, which are the atomic unit of game time.
 * All game mechanics are expressed in terms of ticks, not wall-clock time.
 */

import type {
  GameWorld,
  TickResult,
  GameEvent,
  Node,
  EntityId,
  GameEventType,
} from './types';
import { tickNode } from './models/node';
import { advanceTick, queueEvents, clearEventQueue, setNodes } from './models/world';
import {
  processEventQueue,
  type EventConfig,
  DEFAULT_EVENT_CONFIG,
} from './systems/events';
import {
  processTerritoryClaims,
  type ClaimAction,
} from './systems/territory';

/**
 * Process a single game tick.
 * 
 * This is the core simulation step. It:
 * 1. Processes territory claims (if any)
 * 2. Processes resource regeneration at all nodes
 * 3. Collects any events generated
 * 4. Processes the event queue (handlers may spawn chain events)
 * 5. Advances the tick counter
 * 6. Returns the new world state and events
 * 
 * This function is PURE - no side effects, completely deterministic.
 */
export function processTick(
  world: GameWorld,
  eventConfig: EventConfig = DEFAULT_EVENT_CONFIG,
  activeClaims: readonly ClaimAction[] = []
): TickResult {
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
  let updatedNodes: Record<EntityId, Node> = {};

  // Phase 1: Process territory claims
  if (activeClaims.length > 0) {
    const territoryResult = processTerritoryClaims(world, activeClaims, nextTick);
    updatedNodes = territoryResult.world.nodes;
    collectedEvents.push(...territoryResult.events);
  } else {
    updatedNodes = { ...world.nodes };
  }

  // Phase 2: Process each node (resources, etc.)
  const finalNodes: Record<EntityId, Node> = {};
  for (const [nodeId, node] of Object.entries(updatedNodes)) {
    const result = tickNode(node, nextTick);
    finalNodes[nodeId] = result.node;
    collectedEvents.push(...result.events);
  }

  // Add tick processed event
  collectedEvents.push({
    type: 'tick_processed' as GameEventType,
    tick: nextTick,
    entityId: world.id,
    data: { previousTick: world.currentTick },
  });

  // Build intermediate world state
  let newWorld = setNodes(world, finalNodes);
  newWorld = advanceTick(newWorld);
  newWorld = clearEventQueue(newWorld);

  // Process event queue (handlers may spawn chain events)
  const eventResult = processEventQueue(newWorld, collectedEvents, eventConfig);
  newWorld = eventResult.world;

  // All events (processed + any dropped) go into the queue for subscribers
  const allEvents = [
    ...eventResult.processedEvents,
    ...eventResult.droppedEvents,
  ];
  newWorld = queueEvents(newWorld, allEvents);

  return {
    world: newWorld,
    events: allEvents,
    processedTick: nextTick,
  };
}

/**
 * Process multiple ticks at once.
 * Useful for catch-up scenarios or fast-forward.
 */
export function processMultipleTicks(
  world: GameWorld,
  tickCount: number,
  eventConfig: EventConfig = DEFAULT_EVENT_CONFIG,
  activeClaims: readonly ClaimAction[] = []
): TickResult {
  let currentWorld = world;
  const allEvents: GameEvent[] = [];
  let lastProcessedTick = world.currentTick;

  for (let i = 0; i < tickCount; i++) {
    const result = processTick(currentWorld, eventConfig, activeClaims);
    currentWorld = result.world;
    allEvents.push(...result.events);
    lastProcessedTick = result.processedTick;
  }

  return {
    world: currentWorld,
    events: allEvents,
    processedTick: lastProcessedTick,
  };
}

/**
 * GameLoop class - manages tick scheduling and execution.
 * 
 * This provides the stateful wrapper around the pure processTick function.
 * It handles:
 * - Tick scheduling based on game speed
 * - Event emission to listeners
 * - Pause/resume functionality
 */
export class GameLoop {
  private world: GameWorld;
  private listeners: Set<(result: TickResult) => void>;
  private tickInterval: ReturnType<typeof setInterval> | null;
  
  /** Base tick rate in milliseconds (ticks per second at normal speed) */
  private readonly baseTickRate: number;
  
  /** Event processing configuration */
  private readonly eventConfig: EventConfig;

  constructor(
    initialWorld: GameWorld,
    baseTickRate: number = 1000,
    eventConfig: EventConfig = DEFAULT_EVENT_CONFIG
  ) {
    this.world = initialWorld;
    this.listeners = new Set();
    this.tickInterval = null;
    this.baseTickRate = baseTickRate;
    this.eventConfig = eventConfig;
  }

  /** Get current world state (immutable) */
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
    const result = processTick(this.world, this.eventConfig);
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
