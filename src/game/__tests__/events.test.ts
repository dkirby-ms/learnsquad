/**
 * Event System Tests - Phase 4
 *
 * Testing strategy:
 * - Pure functions (no mocks - the event system is honest)
 * - Explicit determinism verification (same inputs → same outputs)
 * - Edge cases: empty queues, max depth, chain reactions
 * - Handler registry: lookups, registration, unknown types
 * - Event history: ordering, depth limiting, queries
 * - Game loop integration: event collection, persistence
 */

import {
  processEventQueue,
  createEventHistory,
  appendToHistory,
  appendManyToHistory,
  getEventsInRange,
  getEventsForEntity,
  getRecentEvents,
  clearHistory,
  resizeHistory,
  createEvent,
  DEFAULT_EVENT_CONFIG,
  type EventConfig,
  type EventHistory,
  type EventQueueResult,
} from '../systems/events';

import {
  registerHandler,
  unregisterHandler,
  getHandler,
  hasHandler,
  getRegisteredTypes,
  clearHandlers,
  initializeDefaultHandlers,
  noOpHandler,
  handleResourceDepleted,
  handleResourceCapReached,
  handleResourceProduced,
  handleNodeDiscovered,
  handleConnectionEstablished,
  handleConnectionSevered,
  handleGatewayActivated,
  handleGatewayCooldownExpired,
  handleTickProcessed,
  type EventHandler,
  type EventHandlerResult,
} from '../systems/handlers';

import {
  processTick,
  processMultipleTicks,
  GameLoop,
} from '../loop';

import {
  createGameWorld,
  addNode,
  unpause,
} from '../models/world';

import { createNode } from '../models/node';
import { createResource } from '../models/resource';

import {
  GameEventType,
  ResourceType,
  NodeStatus,
  type GameWorld,
  type GameEvent,
  type Node,
  type Tick,
} from '../types';

// --- Test Fixtures ---

function makeEvent(
  type: GameEventType | string,
  tick: Tick = 1,
  entityId: string = 'entity-1',
  data: Record<string, unknown> = {}
): GameEvent {
  return {
    type: type as GameEventType,
    tick,
    entityId,
    data,
  };
}

function makeWorld(overrides: Partial<GameWorld> = {}): GameWorld {
  return {
    ...createGameWorld('test-world'),
    isPaused: false,
    ...overrides,
  };
}

function makeNodeWithResources(
  id: string,
  mineralAmount: number = 100,
  mineralRegen: number = 10
): Node {
  return {
    id,
    name: `Node ${id}`,
    position: { x: 0, y: 0 },
    status: NodeStatus.Neutral,
    ownerId: null,
    resources: [createResource(ResourceType.Minerals, mineralAmount, mineralRegen, 1000)],
    connectionIds: [],
  };
}

// === EVENT QUEUE PROCESSING ===

describe('processEventQueue', () => {
  beforeEach(() => {
    clearHandlers();
    initializeDefaultHandlers();
  });

  describe('FIFO ordering', () => {
    it('processes events in the order they were added', () => {
      const world = makeWorld();
      const processedOrder: string[] = [];
      
      // Register a handler that tracks processing order
      const trackingHandler: EventHandler = (w, event) => {
        processedOrder.push(event.entityId);
        return { world: w, events: [] };
      };
      registerHandler('test_event' as GameEventType, trackingHandler);
      
      const events: GameEvent[] = [
        makeEvent('test_event', 1, 'first'),
        makeEvent('test_event', 1, 'second'),
        makeEvent('test_event', 1, 'third'),
      ];
      
      processEventQueue(world, events);
      
      expect(processedOrder).toEqual(['first', 'second', 'third']);
    });

    it('processes events across multiple passes in correct order', () => {
      const world = makeWorld();
      const processedOrder: string[] = [];
      
      // Handler that spawns one more event
      const spawningHandler: EventHandler = (w, event) => {
        processedOrder.push(event.entityId);
        if (event.entityId === 'parent') {
          return {
            world: w,
            events: [makeEvent('test_event', 1, 'child')],
          };
        }
        return { world: w, events: [] };
      };
      registerHandler('test_event' as GameEventType, spawningHandler);
      
      const events: GameEvent[] = [
        makeEvent('test_event', 1, 'parent'),
        makeEvent('test_event', 1, 'sibling'),
      ];
      
      processEventQueue(world, events);
      
      // Parent first, then sibling, then child (FIFO within each pass)
      expect(processedOrder).toEqual(['parent', 'sibling', 'child']);
    });
  });

  describe('chain reactions', () => {
    it('processes events spawned by handlers', () => {
      const world = makeWorld();
      const processedCount = { count: 0 };
      
      const chainHandler: EventHandler = (w, event) => {
        processedCount.count++;
        const depth = (event.data.depth as number) || 0;
        if (depth < 3) {
          return {
            world: w,
            events: [makeEvent('chain_event', 1, 'chain', { depth: depth + 1 })],
          };
        }
        return { world: w, events: [] };
      };
      registerHandler('chain_event' as GameEventType, chainHandler);
      
      const events: GameEvent[] = [makeEvent('chain_event', 1, 'start', { depth: 0 })];
      const result = processEventQueue(world, events);
      
      expect(processedCount.count).toBe(4); // depth 0, 1, 2, 3
      expect(result.processedEvents).toHaveLength(4);
    });

    it('spawned events have incremented depth tracking', () => {
      const world = makeWorld();
      
      // Spawn exactly maxEventDepth - 1 children
      const config: EventConfig = { maxEventDepth: 5, maxEventsPerTick: 1000 };
      const depths: number[] = [];
      
      const depthTracker: EventHandler = (w, event) => {
        const depth = (event.data.recordedDepth as number) ?? 0;
        depths.push(depth);
        if (depth < 4) {
          return {
            world: w,
            events: [makeEvent('depth_test', 1, 'e', { recordedDepth: depth + 1 })],
          };
        }
        return { world: w, events: [] };
      };
      registerHandler('depth_test' as GameEventType, depthTracker);
      
      processEventQueue(world, [makeEvent('depth_test', 1, 'e', { recordedDepth: 0 })], config);
      
      expect(depths).toEqual([0, 1, 2, 3, 4]);
    });
  });

  describe('max depth protection', () => {
    it('drops events that exceed max depth', () => {
      const world = makeWorld();
      const config: EventConfig = { maxEventDepth: 3, maxEventsPerTick: 1000 };
      
      // Handler that always spawns a child event
      const infiniteChain: EventHandler = (w, _event) => {
        return {
          world: w,
          events: [makeEvent('infinite', 1, 'loop')],
        };
      };
      registerHandler('infinite' as GameEventType, infiniteChain);
      
      const result = processEventQueue(
        world,
        [makeEvent('infinite', 1, 'start')],
        config
      );
      
      expect(result.stats.maxDepthReached).toBe(true);
      expect(result.droppedEvents.length).toBeGreaterThan(0);
      // Should process depth 0, 1, 2 = 3 events
      expect(result.stats.totalProcessed).toBe(3);
    });

    it('continues processing other events after depth limit on one branch', () => {
      const world = makeWorld();
      const config: EventConfig = { maxEventDepth: 2, maxEventsPerTick: 1000 };
      const processed: string[] = [];
      
      // Handler that always spawns a child (will eventually hit depth limit)
      const branchingHandler: EventHandler = (w, event) => {
        processed.push(event.entityId);
        if (event.entityId.startsWith('deep')) {
          return { world: w, events: [makeEvent('test', 1, 'deep-child')] };
        }
        return { world: w, events: [] };
      };
      registerHandler('test' as GameEventType, branchingHandler);
      
      const events: GameEvent[] = [
        makeEvent('test', 1, 'deep'),     // depth 0 -> spawns child at depth 1 -> spawns at depth 2 (dropped)
        makeEvent('test', 1, 'shallow'),  // No children, should still process
      ];
      
      const result = processEventQueue(world, events, config);
      
      // Both 'deep', 'shallow', and 'deep-child' (depth 1) should be processed
      expect(processed).toContain('shallow');
      expect(processed).toContain('deep');
      expect(processed).toContain('deep-child');
      // The child of 'deep-child' (at depth 2) should be dropped
      expect(result.stats.maxDepthReached).toBe(true);
    });
  });

  describe('max events per tick protection', () => {
    it('stops processing when max events per tick reached', () => {
      const world = makeWorld();
      const config: EventConfig = { maxEventDepth: 100, maxEventsPerTick: 5 };
      
      const events: GameEvent[] = Array.from({ length: 10 }, (_, i) =>
        makeEvent(GameEventType.TickProcessed, 1, `event-${i}`)
      );
      
      const result = processEventQueue(world, events, config);
      
      expect(result.stats.maxCountReached).toBe(true);
      expect(result.stats.totalProcessed).toBe(5);
      expect(result.droppedEvents).toHaveLength(5);
    });

    it('drops remaining events including spawned ones', () => {
      const world = makeWorld();
      const config: EventConfig = { maxEventDepth: 100, maxEventsPerTick: 3 };
      
      // Each event spawns another
      const spawner: EventHandler = (w, _event) => ({
        world: w,
        events: [makeEvent('spawner', 1, 'spawned')],
      });
      registerHandler('spawner' as GameEventType, spawner);
      
      const result = processEventQueue(
        world,
        [makeEvent('spawner', 1, 'initial')],
        config
      );
      
      expect(result.stats.totalProcessed).toBe(3);
      expect(result.stats.maxCountReached).toBe(true);
    });
  });

  describe('empty queue handling', () => {
    it('returns empty results for empty event array', () => {
      const world = makeWorld();
      
      const result = processEventQueue(world, []);
      
      expect(result.processedEvents).toHaveLength(0);
      expect(result.droppedEvents).toHaveLength(0);
      expect(result.stats.totalProcessed).toBe(0);
      expect(result.stats.maxDepthReached).toBe(false);
      expect(result.stats.maxCountReached).toBe(false);
      expect(result.world).toBe(world); // Same reference when no changes
    });
  });

  describe('single event processing', () => {
    it('processes a single event correctly', () => {
      const world = makeWorld();
      let handlerCalled = false;
      
      const singleHandler: EventHandler = (w, _event) => {
        handlerCalled = true;
        return { world: w, events: [] };
      };
      registerHandler('single' as GameEventType, singleHandler);
      
      const result = processEventQueue(world, [makeEvent('single', 1, 'test')]);
      
      expect(handlerCalled).toBe(true);
      expect(result.processedEvents).toHaveLength(1);
      expect(result.stats.totalProcessed).toBe(1);
    });
  });

  describe('unknown event types', () => {
    it('processes events without registered handlers (adds to processed)', () => {
      const world = makeWorld();
      
      const result = processEventQueue(world, [
        makeEvent('unknown_event_type' as GameEventType, 1, 'test'),
      ]);
      
      // Event is still processed (just with no handler effect)
      expect(result.processedEvents).toHaveLength(1);
      expect(result.stats.totalProcessed).toBe(1);
      expect(result.world).toBe(world); // World unchanged
    });
  });

  describe('world state modifications', () => {
    it('handler modifications persist through processing', () => {
      let world = makeWorld();
      world = addNode(world, makeNodeWithResources('n1', 50));
      
      // Handler that "modifies" world by returning new world
      const modifyingHandler: EventHandler = (w, _event) => {
        const modifiedWorld: GameWorld = {
          ...w,
          currentTick: w.currentTick + 100, // Arbitrary modification
        };
        return { world: modifiedWorld, events: [] };
      };
      registerHandler('modify' as GameEventType, modifyingHandler);
      
      const result = processEventQueue(world, [makeEvent('modify', 1, 'test')]);
      
      expect(result.world.currentTick).toBe(100);
    });

    it('chained handlers accumulate modifications', () => {
      const world = makeWorld();
      
      const incrementHandler: EventHandler = (w, event) => {
        const newWorld: GameWorld = {
          ...w,
          currentTick: w.currentTick + 1,
        };
        const depth = (event.data.depth as number) || 0;
        if (depth < 3) {
          return {
            world: newWorld,
            events: [makeEvent('increment', 1, 'test', { depth: depth + 1 })],
          };
        }
        return { world: newWorld, events: [] };
      };
      registerHandler('increment' as GameEventType, incrementHandler);
      
      const result = processEventQueue(world, [
        makeEvent('increment', 1, 'test', { depth: 0 }),
      ]);
      
      expect(result.world.currentTick).toBe(4); // 0 -> 1 -> 2 -> 3 -> 4
    });
  });

  describe('determinism', () => {
    it('produces identical results for same inputs', () => {
      clearHandlers();
      initializeDefaultHandlers();
      
      const world = makeWorld();
      const events: GameEvent[] = [
        makeEvent(GameEventType.ResourceProduced, 1, 'n1', { amount: 10 }),
        makeEvent(GameEventType.ResourceDepleted, 1, 'n2'),
        makeEvent(GameEventType.TickProcessed, 1, 'world'),
      ];
      
      const result1 = processEventQueue(world, events);
      const result2 = processEventQueue(world, events);
      
      expect(result1.processedEvents).toEqual(result2.processedEvents);
      expect(result1.droppedEvents).toEqual(result2.droppedEvents);
      expect(result1.stats).toEqual(result2.stats);
    });

    it('is deterministic across 100 iterations', () => {
      clearHandlers();
      initializeDefaultHandlers();
      
      const world = makeWorld();
      const events: GameEvent[] = Array.from({ length: 20 }, (_, i) =>
        makeEvent(GameEventType.TickProcessed, i, `entity-${i}`)
      );
      
      const baseline = processEventQueue(world, events);
      
      for (let i = 0; i < 100; i++) {
        const result = processEventQueue(world, events);
        expect(result.processedEvents).toEqual(baseline.processedEvents);
        expect(result.stats.totalProcessed).toBe(baseline.stats.totalProcessed);
      }
    });
  });

  describe('default configuration', () => {
    it('uses default config when not specified', () => {
      const world = makeWorld();
      
      // Default is maxEventDepth: 10, maxEventsPerTick: 1000
      expect(DEFAULT_EVENT_CONFIG.maxEventDepth).toBe(10);
      expect(DEFAULT_EVENT_CONFIG.maxEventsPerTick).toBe(1000);
      
      const result = processEventQueue(world, []);
      expect(result).toBeDefined();
    });
  });
});

// === EVENT HANDLERS ===

describe('Event Handlers', () => {
  beforeEach(() => {
    clearHandlers();
    initializeDefaultHandlers();
  });

  describe('handler registry', () => {
    it('registers and retrieves handlers', () => {
      clearHandlers();
      
      const myHandler: EventHandler = (w, _e) => ({ world: w, events: [] });
      registerHandler('custom' as GameEventType, myHandler);
      
      expect(getHandler('custom' as GameEventType)).toBe(myHandler);
    });

    it('replaces existing handler on re-register', () => {
      clearHandlers();
      
      const handler1: EventHandler = (w, _e) => ({ world: w, events: [] });
      const handler2: EventHandler = (w, _e) => ({ world: w, events: [] });
      
      registerHandler('custom' as GameEventType, handler1);
      registerHandler('custom' as GameEventType, handler2);
      
      expect(getHandler('custom' as GameEventType)).toBe(handler2);
    });

    it('returns undefined for unregistered type', () => {
      clearHandlers();
      
      expect(getHandler('nonexistent' as GameEventType)).toBeUndefined();
    });

    it('hasHandler returns correct boolean', () => {
      clearHandlers();
      
      expect(hasHandler('resource_depleted' as GameEventType)).toBe(false);
      
      registerHandler('resource_depleted' as GameEventType, noOpHandler);
      
      expect(hasHandler('resource_depleted' as GameEventType)).toBe(true);
    });

    it('unregisterHandler removes handler', () => {
      clearHandlers();
      
      registerHandler('test' as GameEventType, noOpHandler);
      expect(hasHandler('test' as GameEventType)).toBe(true);
      
      const removed = unregisterHandler('test' as GameEventType);
      
      expect(removed).toBe(true);
      expect(hasHandler('test' as GameEventType)).toBe(false);
    });

    it('unregisterHandler returns false for non-existent', () => {
      clearHandlers();
      
      const removed = unregisterHandler('nonexistent' as GameEventType);
      expect(removed).toBe(false);
    });

    it('getRegisteredTypes returns all registered types', () => {
      clearHandlers();
      
      registerHandler('type_a' as GameEventType, noOpHandler);
      registerHandler('type_b' as GameEventType, noOpHandler);
      registerHandler('type_c' as GameEventType, noOpHandler);
      
      const types = getRegisteredTypes();
      
      expect(types).toContain('type_a');
      expect(types).toContain('type_b');
      expect(types).toContain('type_c');
      expect(types).toHaveLength(3);
    });

    it('clearHandlers removes all handlers', () => {
      initializeDefaultHandlers();
      expect(getRegisteredTypes().length).toBeGreaterThan(0);
      
      clearHandlers();
      
      expect(getRegisteredTypes()).toHaveLength(0);
    });
  });

  describe('default handlers', () => {
    it('initializeDefaultHandlers registers all expected types', () => {
      clearHandlers();
      initializeDefaultHandlers();
      
      const expectedTypes = [
        'resource_depleted',
        'resource_cap_reached',
        'resource_produced',
        'node_claimed',
        'node_discovered',
        'connection_established',
        'connection_severed',
        'gateway_activated',
        'gateway_ready',
        'gateway_cooldown_expired',
        'tick_processed',
      ];
      
      for (const type of expectedTypes) {
        expect(hasHandler(type as GameEventType)).toBe(true);
      }
    });
  });

  describe('handler purity', () => {
    it('noOpHandler returns world unchanged', () => {
      const world = makeWorld();
      const event = makeEvent(GameEventType.TickProcessed, 1, 'test');
      
      const result = noOpHandler(world, event);
      
      expect(result.world).toBe(world); // Same reference
      expect(result.events).toHaveLength(0);
    });

    it('handleResourceDepleted is pure and returns no events', () => {
      const world = makeWorld();
      const event = makeEvent(GameEventType.ResourceDepleted, 1, 'n1', {
        resourceType: ResourceType.Minerals,
      });
      
      const result = handleResourceDepleted(world, event);
      
      expect(result.world).toBe(world);
      expect(result.events).toHaveLength(0);
    });

    it('handleResourceCapReached is pure and returns no events', () => {
      const world = makeWorld();
      const event = makeEvent(GameEventType.ResourceCapReached, 1, 'n1');
      
      const result = handleResourceCapReached(world, event);
      
      expect(result.world).toBe(world);
      expect(result.events).toHaveLength(0);
    });

    it('handleResourceProduced is pure and returns no events', () => {
      const world = makeWorld();
      const event = makeEvent(GameEventType.ResourceProduced, 1, 'n1');
      
      const result = handleResourceProduced(world, event);
      
      expect(result.world).toBe(world);
      expect(result.events).toHaveLength(0);
    });

    it('handleNodeDiscovered is pure and returns no events', () => {
      const world = makeWorld();
      const event = makeEvent(GameEventType.NodeDiscovered, 1, 'n1');
      
      const result = handleNodeDiscovered(world, event);
      
      expect(result.world).toBe(world);
      expect(result.events).toHaveLength(0);
    });

    it('handleConnectionEstablished is pure and returns no events', () => {
      const world = makeWorld();
      const event = makeEvent(GameEventType.ConnectionEstablished, 1, 'c1');
      
      const result = handleConnectionEstablished(world, event);
      
      expect(result.world).toBe(world);
      expect(result.events).toHaveLength(0);
    });

    it('handleConnectionSevered is pure and returns no events', () => {
      const world = makeWorld();
      const event = makeEvent(GameEventType.ConnectionSevered, 1, 'c1');
      
      const result = handleConnectionSevered(world, event);
      
      expect(result.world).toBe(world);
      expect(result.events).toHaveLength(0);
    });

    it('handleGatewayActivated is pure and returns no events', () => {
      const world = makeWorld();
      const event = makeEvent(GameEventType.GatewayActivated, 1, 'g1');
      
      const result = handleGatewayActivated(world, event);
      
      expect(result.world).toBe(world);
      expect(result.events).toHaveLength(0);
    });

    it('handleGatewayCooldownExpired is pure and returns no events', () => {
      const world = makeWorld();
      const event = makeEvent(GameEventType.GatewayCooldownExpired, 1, 'g1');
      
      const result = handleGatewayCooldownExpired(world, event);
      
      expect(result.world).toBe(world);
      expect(result.events).toHaveLength(0);
    });

    it('handleTickProcessed is pure and returns no events', () => {
      const world = makeWorld();
      const event = makeEvent(GameEventType.TickProcessed, 1, 'world');
      
      const result = handleTickProcessed(world, event);
      
      expect(result.world).toBe(world);
      expect(result.events).toHaveLength(0);
    });

    it('handlers produce same output for same input (determinism)', () => {
      const world = makeWorld();
      const event = makeEvent(GameEventType.ResourceDepleted, 42, 'n1', {
        resourceType: ResourceType.Energy,
        previousAmount: 10,
      });
      
      const results = Array.from({ length: 10 }, () =>
        handleResourceDepleted(world, event)
      );
      
      for (const result of results) {
        expect(result.world).toBe(world);
        expect(result.events).toEqual([]);
      }
    });
  });
});

// === EVENT HISTORY ===

describe('Event History', () => {
  describe('createEventHistory', () => {
    it('creates empty history with default max size', () => {
      const history = createEventHistory();
      
      expect(history.events).toHaveLength(0);
      expect(history.maxSize).toBe(100);
      expect(history.totalRecorded).toBe(0);
    });

    it('creates history with custom max size', () => {
      const history = createEventHistory(50);
      
      expect(history.maxSize).toBe(50);
    });
  });

  describe('appendToHistory', () => {
    it('adds event to empty history', () => {
      const history = createEventHistory();
      const event = makeEvent(GameEventType.TickProcessed, 1, 'test');
      
      const newHistory = appendToHistory(history, event);
      
      expect(newHistory.events).toHaveLength(1);
      expect(newHistory.events[0]).toEqual(event);
      expect(newHistory.totalRecorded).toBe(1);
    });

    it('adds events in chronological order (oldest first)', () => {
      let history = createEventHistory();
      
      const event1 = makeEvent(GameEventType.TickProcessed, 1, 'first');
      const event2 = makeEvent(GameEventType.TickProcessed, 2, 'second');
      const event3 = makeEvent(GameEventType.TickProcessed, 3, 'third');
      
      history = appendToHistory(history, event1);
      history = appendToHistory(history, event2);
      history = appendToHistory(history, event3);
      
      expect(history.events[0].entityId).toBe('first');
      expect(history.events[1].entityId).toBe('second');
      expect(history.events[2].entityId).toBe('third');
    });

    it('prunes oldest events when exceeding max size', () => {
      let history = createEventHistory(3);
      
      for (let i = 1; i <= 5; i++) {
        history = appendToHistory(history, makeEvent(GameEventType.TickProcessed, i, `e${i}`));
      }
      
      expect(history.events).toHaveLength(3);
      expect(history.events[0].entityId).toBe('e3');
      expect(history.events[1].entityId).toBe('e4');
      expect(history.events[2].entityId).toBe('e5');
      expect(history.totalRecorded).toBe(5);
    });

    it('is pure - does not mutate original history', () => {
      const history = createEventHistory();
      const event = makeEvent(GameEventType.TickProcessed, 1, 'test');
      
      const newHistory = appendToHistory(history, event);
      
      expect(history.events).toHaveLength(0);
      expect(history.totalRecorded).toBe(0);
      expect(newHistory.events).toHaveLength(1);
    });
  });

  describe('appendManyToHistory', () => {
    it('adds multiple events at once', () => {
      const history = createEventHistory();
      const events = [
        makeEvent(GameEventType.TickProcessed, 1, 'e1'),
        makeEvent(GameEventType.TickProcessed, 2, 'e2'),
        makeEvent(GameEventType.TickProcessed, 3, 'e3'),
      ];
      
      const newHistory = appendManyToHistory(history, events);
      
      expect(newHistory.events).toHaveLength(3);
      expect(newHistory.totalRecorded).toBe(3);
    });

    it('returns same history for empty event array', () => {
      const history = createEventHistory();
      
      const newHistory = appendManyToHistory(history, []);
      
      expect(newHistory).toBe(history); // Same reference
    });

    it('prunes to max size after bulk append', () => {
      const history = createEventHistory(3);
      const events = [
        makeEvent(GameEventType.TickProcessed, 1, 'e1'),
        makeEvent(GameEventType.TickProcessed, 2, 'e2'),
        makeEvent(GameEventType.TickProcessed, 3, 'e3'),
        makeEvent(GameEventType.TickProcessed, 4, 'e4'),
        makeEvent(GameEventType.TickProcessed, 5, 'e5'),
      ];
      
      const newHistory = appendManyToHistory(history, events);
      
      expect(newHistory.events).toHaveLength(3);
      expect(newHistory.events[0].entityId).toBe('e3');
      expect(newHistory.totalRecorded).toBe(5);
    });

    it('preserves existing events when adding more', () => {
      let history = createEventHistory(10);
      history = appendToHistory(history, makeEvent(GameEventType.TickProcessed, 0, 'existing'));
      
      const newHistory = appendManyToHistory(history, [
        makeEvent(GameEventType.TickProcessed, 1, 'new1'),
        makeEvent(GameEventType.TickProcessed, 2, 'new2'),
      ]);
      
      expect(newHistory.events).toHaveLength(3);
      expect(newHistory.events[0].entityId).toBe('existing');
      expect(newHistory.totalRecorded).toBe(3);
    });
  });

  describe('getEventsInRange', () => {
    it('returns events within tick range (inclusive)', () => {
      let history = createEventHistory();
      for (let i = 1; i <= 10; i++) {
        history = appendToHistory(history, makeEvent(GameEventType.TickProcessed, i, `e${i}`));
      }
      
      const events = getEventsInRange(history, 3, 7);
      
      expect(events).toHaveLength(5);
      expect(events[0].tick).toBe(3);
      expect(events[4].tick).toBe(7);
    });

    it('returns empty array when no events in range', () => {
      let history = createEventHistory();
      history = appendToHistory(history, makeEvent(GameEventType.TickProcessed, 5, 'e5'));
      
      const events = getEventsInRange(history, 10, 20);
      
      expect(events).toHaveLength(0);
    });

    it('includes boundary ticks', () => {
      let history = createEventHistory();
      history = appendToHistory(history, makeEvent(GameEventType.TickProcessed, 5, 'e5'));
      
      const events = getEventsInRange(history, 5, 5);
      
      expect(events).toHaveLength(1);
    });
  });

  describe('getEventsForEntity', () => {
    it('returns all events for a specific entity', () => {
      let history = createEventHistory();
      history = appendManyToHistory(history, [
        makeEvent(GameEventType.TickProcessed, 1, 'node-1'),
        makeEvent(GameEventType.ResourceProduced, 2, 'node-1'),
        makeEvent(GameEventType.TickProcessed, 3, 'node-2'),
        makeEvent(GameEventType.ResourceDepleted, 4, 'node-1'),
      ]);
      
      const events = getEventsForEntity(history, 'node-1');
      
      expect(events).toHaveLength(3);
      expect(events.every(e => e.entityId === 'node-1')).toBe(true);
    });

    it('returns empty array for unknown entity', () => {
      let history = createEventHistory();
      history = appendToHistory(history, makeEvent(GameEventType.TickProcessed, 1, 'node-1'));
      
      const events = getEventsForEntity(history, 'unknown');
      
      expect(events).toHaveLength(0);
    });
  });

  describe('getRecentEvents', () => {
    it('returns last N events', () => {
      let history = createEventHistory();
      for (let i = 1; i <= 10; i++) {
        history = appendToHistory(history, makeEvent(GameEventType.TickProcessed, i, `e${i}`));
      }
      
      const events = getRecentEvents(history, 3);
      
      expect(events).toHaveLength(3);
      expect(events[0].entityId).toBe('e8');
      expect(events[1].entityId).toBe('e9');
      expect(events[2].entityId).toBe('e10');
    });

    it('returns all events if count exceeds history length', () => {
      let history = createEventHistory();
      history = appendManyToHistory(history, [
        makeEvent(GameEventType.TickProcessed, 1, 'e1'),
        makeEvent(GameEventType.TickProcessed, 2, 'e2'),
      ]);
      
      const events = getRecentEvents(history, 10);
      
      expect(events).toHaveLength(2);
    });

    it('returns empty array for count 0', () => {
      let history = createEventHistory();
      history = appendToHistory(history, makeEvent(GameEventType.TickProcessed, 1, 'e1'));
      
      const events = getRecentEvents(history, 0);
      
      expect(events).toHaveLength(0);
    });
  });

  describe('clearHistory', () => {
    it('removes all events but keeps configuration', () => {
      let history = createEventHistory(50);
      history = appendManyToHistory(history, [
        makeEvent(GameEventType.TickProcessed, 1, 'e1'),
        makeEvent(GameEventType.TickProcessed, 2, 'e2'),
      ]);
      
      const cleared = clearHistory(history);
      
      expect(cleared.events).toHaveLength(0);
      expect(cleared.maxSize).toBe(50);
      expect(cleared.totalRecorded).toBe(2); // Preserved
    });
  });

  describe('resizeHistory', () => {
    it('increases max size without affecting events', () => {
      let history = createEventHistory(5);
      history = appendManyToHistory(history, [
        makeEvent(GameEventType.TickProcessed, 1, 'e1'),
        makeEvent(GameEventType.TickProcessed, 2, 'e2'),
      ]);
      
      const resized = resizeHistory(history, 10);
      
      expect(resized.maxSize).toBe(10);
      expect(resized.events).toHaveLength(2);
    });

    it('decreases max size and prunes oldest', () => {
      let history = createEventHistory(10);
      for (let i = 1; i <= 8; i++) {
        history = appendToHistory(history, makeEvent(GameEventType.TickProcessed, i, `e${i}`));
      }
      
      const resized = resizeHistory(history, 3);
      
      expect(resized.maxSize).toBe(3);
      expect(resized.events).toHaveLength(3);
      expect(resized.events[0].entityId).toBe('e6');
      expect(resized.events[2].entityId).toBe('e8');
    });
  });

  describe('history ordering', () => {
    it('stores events in chronological order (oldest first)', () => {
      let history = createEventHistory();
      
      // Add events out of tick order to verify append order is what matters
      history = appendToHistory(history, makeEvent(GameEventType.TickProcessed, 10, 'late'));
      history = appendToHistory(history, makeEvent(GameEventType.TickProcessed, 5, 'middle'));
      history = appendToHistory(history, makeEvent(GameEventType.TickProcessed, 1, 'early'));
      
      // Events are stored in append order, not tick order
      expect(history.events[0].entityId).toBe('late');
      expect(history.events[1].entityId).toBe('middle');
      expect(history.events[2].entityId).toBe('early');
    });
  });
});

// === EVENT CREATION HELPER ===

describe('createEvent', () => {
  it('creates event with all fields', () => {
    const event = createEvent(GameEventType.ResourceDepleted, 42, 'node-1', {
      resourceType: ResourceType.Minerals,
    });
    
    expect(event.type).toBe(GameEventType.ResourceDepleted);
    expect(event.tick).toBe(42);
    expect(event.entityId).toBe('node-1');
    expect(event.data.resourceType).toBe(ResourceType.Minerals);
  });

  it('creates event with empty data by default', () => {
    const event = createEvent(GameEventType.TickProcessed, 1, 'world');
    
    expect(event.data).toEqual({});
  });
});

// === GAME LOOP INTEGRATION ===

describe('Game Loop Integration', () => {
  beforeEach(() => {
    clearHandlers();
    initializeDefaultHandlers();
  });

  describe('processTick', () => {
    it('returns unchanged state when paused', () => {
      const world = createGameWorld('test');
      // world is paused by default
      
      const result = processTick(world);
      
      expect(result.world).toBe(world);
      expect(result.events).toHaveLength(0);
      expect(result.processedTick).toBe(world.currentTick);
    });

    it('collects events from nodes', () => {
      let world = createGameWorld('test');
      world = unpause(world);
      world = addNode(world, makeNodeWithResources('n1', 100, 10));
      
      const result = processTick(world);
      
      // Should have ResourceProduced and TickProcessed events
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.events.some(e => e.type === GameEventType.TickProcessed)).toBe(true);
    });

    it('advances tick counter', () => {
      let world = createGameWorld('test');
      world = unpause(world);
      
      const result = processTick(world);
      
      expect(result.world.currentTick).toBe(1);
      expect(result.processedTick).toBe(1);
    });

    it('processes events through handlers', () => {
      let world = createGameWorld('test');
      world = unpause(world);
      world = addNode(world, makeNodeWithResources('n1', 5, -10)); // Will deplete
      
      const result = processTick(world);
      
      expect(result.events.some(e => e.type === GameEventType.ResourceDepleted)).toBe(true);
    });

    it('queues events in world state for subscribers', () => {
      let world = createGameWorld('test');
      world = unpause(world);
      world = addNode(world, makeNodeWithResources('n1', 100, 10));
      
      const result = processTick(world);
      
      expect(result.world.eventQueue.length).toBeGreaterThan(0);
    });
  });

  describe('processMultipleTicks', () => {
    it('processes specified number of ticks', () => {
      let world = createGameWorld('test');
      world = unpause(world);
      
      const result = processMultipleTicks(world, 10);
      
      expect(result.world.currentTick).toBe(10);
      expect(result.processedTick).toBe(10);
    });

    it('accumulates events from all ticks', () => {
      let world = createGameWorld('test');
      world = unpause(world);
      world = addNode(world, makeNodeWithResources('n1', 100, 10));
      
      const result = processMultipleTicks(world, 5);
      
      // At least one TickProcessed per tick
      const tickEvents = result.events.filter(e => e.type === GameEventType.TickProcessed);
      expect(tickEvents).toHaveLength(5);
    });

    it('zero ticks returns unchanged state', () => {
      let world = createGameWorld('test');
      world = unpause(world);
      
      const result = processMultipleTicks(world, 0);
      
      expect(result.world.currentTick).toBe(0);
      expect(result.events).toHaveLength(0);
    });

    it('state changes persist across ticks', () => {
      let world = createGameWorld('test');
      world = unpause(world);
      // Node with high regen rate
      world = addNode(world, makeNodeWithResources('n1', 100, 50));
      
      const result = processMultipleTicks(world, 10);
      
      // After 10 ticks with +50 regen, should be at 600 (capped at 1000)
      const node = result.world.nodes['n1'];
      expect(node.resources[0].amount).toBe(600);
    });
  });

  describe('events from multiple systems in one tick', () => {
    it('collects events from multiple nodes', () => {
      let world = createGameWorld('test');
      world = unpause(world);
      world = addNode(world, makeNodeWithResources('n1', 100, 10));
      world = addNode(world, makeNodeWithResources('n2', 50, 5));
      world = addNode(world, makeNodeWithResources('n3', 200, 20));
      
      const result = processTick(world);
      
      // Each node with positive regen produces a ResourceProduced event
      const producedEvents = result.events.filter(
        e => e.type === GameEventType.ResourceProduced
      );
      expect(producedEvents).toHaveLength(3);
      
      // Verify different entity IDs
      const entityIds = new Set(producedEvents.map(e => e.entityId));
      expect(entityIds.size).toBe(3);
    });
  });

  describe('event-triggered state changes persist', () => {
    it('handler modifications appear in final world state', () => {
      let world = createGameWorld('test');
      world = unpause(world);
      
      // Register a handler that modifies world in a detectable way
      let handlerInvoked = false;
      const testHandler: EventHandler = (w, _event) => {
        handlerInvoked = true;
        return { world: w, events: [] };
      };
      registerHandler(GameEventType.TickProcessed, testHandler);
      
      processTick(world);
      
      expect(handlerInvoked).toBe(true);
    });
  });

  describe('determinism', () => {
    it('same initial state produces same events across runs', () => {
      clearHandlers();
      initializeDefaultHandlers();
      
      let world = createGameWorld('test');
      world = unpause(world);
      world = addNode(world, makeNodeWithResources('n1', 100, 10));
      world = addNode(world, makeNodeWithResources('n2', 50, -5));
      
      const result1 = processMultipleTicks(world, 20);
      const result2 = processMultipleTicks(world, 20);
      
      expect(result1.events).toEqual(result2.events);
      expect(result1.world.currentTick).toBe(result2.world.currentTick);
    });

    it('event ordering is deterministic', () => {
      clearHandlers();
      initializeDefaultHandlers();
      
      let world = createGameWorld('test');
      world = unpause(world);
      // Multiple nodes to ensure ordering matters
      for (let i = 0; i < 5; i++) {
        world = addNode(world, makeNodeWithResources(`n${i}`, 100, 10));
      }
      
      const result1 = processTick(world);
      const result2 = processTick(world);
      
      // Event order should be identical
      for (let i = 0; i < result1.events.length; i++) {
        expect(result1.events[i].type).toBe(result2.events[i].type);
        expect(result1.events[i].entityId).toBe(result2.events[i].entityId);
      }
    });

    it('100-tick parallel simulation produces identical results', () => {
      clearHandlers();
      initializeDefaultHandlers();
      
      let world = createGameWorld('test');
      world = unpause(world);
      world = addNode(world, makeNodeWithResources('n1', 500, 3));
      world = addNode(world, makeNodeWithResources('n2', 200, -2));
      
      // Run two parallel simulations
      let world1 = world;
      let world2 = world;
      
      for (let i = 0; i < 100; i++) {
        const result1 = processTick(world1);
        const result2 = processTick(world2);
        
        world1 = result1.world;
        world2 = result2.world;
        
        // States should match every tick
        expect(world1.currentTick).toBe(world2.currentTick);
      }
      
      // Final states should be identical
      expect(world1.nodes['n1'].resources[0].amount).toBe(
        world2.nodes['n1'].resources[0].amount
      );
      expect(world1.nodes['n2'].resources[0].amount).toBe(
        world2.nodes['n2'].resources[0].amount
      );
    });
  });
});

// === EDGE CASES ===

describe('Edge Cases', () => {
  beforeEach(() => {
    clearHandlers();
    initializeDefaultHandlers();
  });

  describe('zero-tick scenarios', () => {
    it('processes zero ticks without error', () => {
      let world = createGameWorld('test');
      world = unpause(world);
      
      const result = processMultipleTicks(world, 0);
      
      expect(result.world.currentTick).toBe(0);
      expect(result.events).toHaveLength(0);
    });
  });

  describe('events with invalid node IDs', () => {
    it('processes event for non-existent node without crashing', () => {
      const world = makeWorld();
      const event = makeEvent(GameEventType.ResourceDepleted, 1, 'non-existent-node');
      
      const result = processEventQueue(world, [event]);
      
      expect(result.processedEvents).toHaveLength(1);
      // No crash, handler handles gracefully
    });

    it('handler receives event even if entity does not exist in world', () => {
      const world = makeWorld();
      let receivedEntityId = '';
      
      const trackingHandler: EventHandler = (w, event) => {
        receivedEntityId = event.entityId;
        return { world: w, events: [] };
      };
      registerHandler('track' as GameEventType, trackingHandler);
      
      processEventQueue(world, [makeEvent('track', 1, 'phantom-node')]);
      
      expect(receivedEntityId).toBe('phantom-node');
    });
  });

  describe('events referencing non-existent resources', () => {
    it('resource events for missing resources are processed without error', () => {
      const world = makeWorld();
      const event = makeEvent(GameEventType.ResourceDepleted, 1, 'node-1', {
        resourceType: 'nonexistent_resource',
        previousAmount: 100,
      });
      
      const result = processEventQueue(world, [event]);
      
      expect(result.processedEvents).toHaveLength(1);
    });
  });

  describe('concurrent events affecting same node', () => {
    it('multiple events for same node in one tick are all processed', () => {
      let world = makeWorld();
      world = addNode(world, makeNodeWithResources('n1', 100, 0));
      
      const events: GameEvent[] = [
        makeEvent(GameEventType.ResourceProduced, 1, 'n1', { amount: 10 }),
        makeEvent(GameEventType.ResourceProduced, 1, 'n1', { amount: 20 }),
        makeEvent(GameEventType.ResourceCapReached, 1, 'n1'),
      ];
      
      const result = processEventQueue(world, events);
      
      expect(result.processedEvents).toHaveLength(3);
      expect(result.processedEvents.every(e => e.entityId === 'n1')).toBe(true);
    });

    it('event order is preserved for same node', () => {
      const world = makeWorld();
      const processOrder: number[] = [];
      
      const orderTracker: EventHandler = (w, event) => {
        processOrder.push(event.data.order as number);
        return { world: w, events: [] };
      };
      registerHandler('ordered' as GameEventType, orderTracker);
      
      const events: GameEvent[] = [
        makeEvent('ordered', 1, 'n1', { order: 1 }),
        makeEvent('ordered', 1, 'n1', { order: 2 }),
        makeEvent('ordered', 1, 'n1', { order: 3 }),
      ];
      
      processEventQueue(world, events);
      
      expect(processOrder).toEqual([1, 2, 3]);
    });
  });

  describe('large event volumes', () => {
    it('handles 1000 events efficiently', () => {
      const world = makeWorld();
      const events: GameEvent[] = Array.from({ length: 1000 }, (_, i) =>
        makeEvent(GameEventType.TickProcessed, i, `e${i}`)
      );
      
      const start = performance.now();
      const result = processEventQueue(world, events);
      const duration = performance.now() - start;
      
      expect(result.stats.totalProcessed).toBe(1000);
      expect(duration).toBeLessThan(1000); // Should complete in <1s
    });
  });

  describe('history edge cases', () => {
    it('handles maxSize of 1', () => {
      let history = createEventHistory(1);
      
      history = appendToHistory(history, makeEvent(GameEventType.TickProcessed, 1, 'e1'));
      history = appendToHistory(history, makeEvent(GameEventType.TickProcessed, 2, 'e2'));
      
      expect(history.events).toHaveLength(1);
      expect(history.events[0].entityId).toBe('e2');
      expect(history.totalRecorded).toBe(2);
    });

    it('handles maxSize of 0 (unusual but valid)', () => {
      let history = createEventHistory(0);
      
      history = appendToHistory(history, makeEvent(GameEventType.TickProcessed, 1, 'e1'));
      
      expect(history.events).toHaveLength(0);
      expect(history.totalRecorded).toBe(1);
    });
  });
});

// === PERFORMANCE BASELINES ===

describe('Performance Baselines', () => {
  beforeEach(() => {
    clearHandlers();
    initializeDefaultHandlers();
  });

  it('processes 100 events in under 50ms', () => {
    const world = makeWorld();
    const events: GameEvent[] = Array.from({ length: 100 }, (_, i) =>
      makeEvent(GameEventType.TickProcessed, i, `e${i}`)
    );
    
    const start = performance.now();
    processEventQueue(world, events);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(50);
  });

  it('appends 1000 events to history in under 100ms', () => {
    let history = createEventHistory(1000);
    const events: GameEvent[] = Array.from({ length: 1000 }, (_, i) =>
      makeEvent(GameEventType.TickProcessed, i, `e${i}`)
    );
    
    const start = performance.now();
    history = appendManyToHistory(history, events);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(100);
    expect(history.events).toHaveLength(1000);
  });

  it('100-tick game loop simulation under 200ms', () => {
    let world = createGameWorld('perf-test');
    world = unpause(world);
    // Add several nodes for realism
    for (let i = 0; i < 10; i++) {
      world = addNode(world, makeNodeWithResources(`n${i}`, 100, 5));
    }
    
    const start = performance.now();
    processMultipleTicks(world, 100);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(200);
  });
});
