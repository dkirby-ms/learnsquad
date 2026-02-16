/**
 * Event System - Event queue processing and history management.
 * 
 * Design principles:
 * - Pure functions: no mutations, no side effects
 * - Deterministic: same input always produces same output
 * - Separable: suitable for Rust/Go extraction
 * 
 * Events are processed FIFO per tick. Handlers can spawn new events,
 * which are queued for the next processing pass. A max depth limit
 * prevents infinite loops from chain reactions.
 */

import type { GameWorld, GameEvent, Tick, EntityId } from '../types';
import type { EventHandler, EventHandlerResult } from './handlers';
import { getHandler } from './handlers';

/** Configuration for event processing */
export interface EventConfig {
  /** Maximum event processing depth to prevent infinite loops */
  readonly maxEventDepth: number;
  /** Maximum events to process per tick (circuit breaker) */
  readonly maxEventsPerTick: number;
}

/** Default event processing configuration */
export const DEFAULT_EVENT_CONFIG: EventConfig = {
  maxEventDepth: 10,
  maxEventsPerTick: 1000,
};

/** Result of processing the event queue */
export interface EventQueueResult {
  readonly world: GameWorld;
  /** All events that were processed */
  readonly processedEvents: readonly GameEvent[];
  /** Events that couldn't be processed (max depth/count exceeded) */
  readonly droppedEvents: readonly GameEvent[];
  /** Processing statistics */
  readonly stats: {
    readonly totalProcessed: number;
    readonly maxDepthReached: boolean;
    readonly maxCountReached: boolean;
  };
}

/**
 * Process the event queue for a game world.
 * 
 * Events are processed in FIFO order. Each handler can return new events,
 * which are queued for processing in subsequent passes. Processing continues
 * until the queue is empty or limits are reached.
 * 
 * Pure function: returns new world state, no mutations.
 */
export function processEventQueue(
  world: GameWorld,
  events: readonly GameEvent[],
  config: EventConfig = DEFAULT_EVENT_CONFIG
): EventQueueResult {
  let currentWorld = world;
  const processedEvents: GameEvent[] = [];
  const droppedEvents: GameEvent[] = [];
  
  // Queue of events to process, with depth tracking
  let queue: Array<{ event: GameEvent; depth: number }> = 
    events.map(event => ({ event, depth: 0 }));
  
  let totalProcessed = 0;
  let maxDepthReached = false;
  let maxCountReached = false;

  while (queue.length > 0) {
    // Circuit breaker: max events per tick
    if (totalProcessed >= config.maxEventsPerTick) {
      maxCountReached = true;
      droppedEvents.push(...queue.map(q => q.event));
      break;
    }

    const { event, depth } = queue.shift()!;

    // Depth limit: drop events that are too deep
    if (depth >= config.maxEventDepth) {
      maxDepthReached = true;
      droppedEvents.push(event);
      continue;
    }

    // Get handler for this event type
    const handler = getHandler(event.type);
    
    if (handler) {
      // Process the event
      const result = handler(currentWorld, event);
      currentWorld = result.world;
      
      // Queue any new events with incremented depth
      const newQueueItems = result.events.map(e => ({
        event: e,
        depth: depth + 1,
      }));
      queue.push(...newQueueItems);
    }

    processedEvents.push(event);
    totalProcessed++;
  }

  return {
    world: currentWorld,
    processedEvents,
    droppedEvents,
    stats: {
      totalProcessed,
      maxDepthReached,
      maxCountReached,
    },
  };
}

// --- Event History ---

/** History of game events for replay/debugging */
export interface EventHistory {
  /** Events stored in chronological order (oldest first) */
  readonly events: readonly GameEvent[];
  /** Maximum number of events to retain */
  readonly maxSize: number;
  /** Total events ever recorded (including pruned) */
  readonly totalRecorded: number;
}

/** Create a new empty event history */
export function createEventHistory(maxSize: number = 100): EventHistory {
  return {
    events: [],
    maxSize,
    totalRecorded: 0,
  };
}

/**
 * Append a single event to the history.
 * Prunes oldest events if history exceeds maxSize.
 * Pure function: returns new history, no mutations.
 */
export function appendToHistory(
  history: EventHistory,
  event: GameEvent
): EventHistory {
  const newEvents = [...history.events, event];
  
  // Prune if exceeding max size
  const prunedEvents = newEvents.length > history.maxSize
    ? newEvents.slice(newEvents.length - history.maxSize)
    : newEvents;

  return {
    events: prunedEvents,
    maxSize: history.maxSize,
    totalRecorded: history.totalRecorded + 1,
  };
}

/**
 * Append multiple events to the history.
 * Pure function: returns new history, no mutations.
 */
export function appendManyToHistory(
  history: EventHistory,
  events: readonly GameEvent[]
): EventHistory {
  if (events.length === 0) {
    return history;
  }

  const newEvents = [...history.events, ...events];
  
  // Prune if exceeding max size
  const prunedEvents = newEvents.length > history.maxSize
    ? newEvents.slice(newEvents.length - history.maxSize)
    : newEvents;

  return {
    events: prunedEvents,
    maxSize: history.maxSize,
    totalRecorded: history.totalRecorded + events.length,
  };
}

/**
 * Get events from history within a tick range (inclusive).
 */
export function getEventsInRange(
  history: EventHistory,
  fromTick: Tick,
  toTick: Tick
): readonly GameEvent[] {
  return history.events.filter(e => e.tick >= fromTick && e.tick <= toTick);
}

/**
 * Get events from history for a specific entity.
 */
export function getEventsForEntity(
  history: EventHistory,
  entityId: EntityId
): readonly GameEvent[] {
  return history.events.filter(e => e.entityId === entityId);
}

/**
 * Get the most recent N events from history.
 */
export function getRecentEvents(
  history: EventHistory,
  count: number
): readonly GameEvent[] {
  const startIndex = Math.max(0, history.events.length - count);
  return history.events.slice(startIndex);
}

/**
 * Clear all events from history.
 * Retains configuration and counter.
 */
export function clearHistory(history: EventHistory): EventHistory {
  return {
    events: [],
    maxSize: history.maxSize,
    totalRecorded: history.totalRecorded,
  };
}

/**
 * Resize the history, pruning oldest events if needed.
 */
export function resizeHistory(
  history: EventHistory,
  newMaxSize: number
): EventHistory {
  const prunedEvents = history.events.length > newMaxSize
    ? history.events.slice(history.events.length - newMaxSize)
    : history.events;

  return {
    events: prunedEvents,
    maxSize: newMaxSize,
    totalRecorded: history.totalRecorded,
  };
}

// --- Event Creation Helpers ---

/**
 * Create a typed game event with proper structure.
 * Helper to ensure consistent event creation.
 */
export function createEvent(
  type: GameEvent['type'],
  tick: Tick,
  entityId: EntityId,
  data: Record<string, unknown> = {}
): GameEvent {
  return {
    type,
    tick,
    entityId,
    data,
  };
}
