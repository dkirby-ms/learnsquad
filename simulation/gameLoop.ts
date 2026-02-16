/**
 * Game loop and tick processing for the simulation engine.
 * 
 * DESIGN: The game loop is pausable real-time (Paradox-style).
 * All tick processing is deterministic - same inputs always produce same outputs.
 * The simulation layer is pure and can be extracted to Rust/Go.
 */

import type {
  GameLoopState,
  TimeState,
  GameSpeed,
  GameEvent,
  GameEventType,
  TickResult,
  SeededRandom,
  GameWorld,
  ResourceChangePayload,
} from './types.js';
import { createGameWorld, applyResourceRegeneration } from './world.js';

// ============================================================================
// Seeded Random Number Generator (Mulberry32)
// ============================================================================

export function createSeededRandom(seed: number): SeededRandom {
  let state = seed >>> 0;
  
  function next(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  
  return {
    get seed() { return state; },
    set seed(s: number) { state = s >>> 0; },
    next,
    nextInt(min: number, max: number): number {
      return Math.floor(next() * (max - min + 1)) + min;
    },
  };
}

// ============================================================================
// Time System
// ============================================================================

export function createTimeState(baseTickDuration: number = 100): TimeState {
  return {
    currentTick: 0,
    speed: 1,
    baseTickDuration,
  };
}

export function getEffectiveTickDuration(time: TimeState): number {
  if (time.speed === 0) return Infinity; // Paused
  return time.baseTickDuration / time.speed;
}

export function setGameSpeed(time: TimeState, speed: GameSpeed): TimeState {
  return { ...time, speed };
}

export function isPaused(time: TimeState): boolean {
  return time.speed === 0;
}

export function pause(time: TimeState): TimeState {
  return setGameSpeed(time, 0);
}

export function unpause(time: TimeState, speed: GameSpeed = 1): TimeState {
  return setGameSpeed(time, speed);
}

// ============================================================================
// Event System
// ============================================================================

let eventCounter = 0;

export function createEvent(
  type: GameEventType,
  tick: number,
  payload: unknown
): GameEvent {
  return {
    id: `evt_${tick}_${++eventCounter}`,
    type,
    tick,
    timestamp: Date.now(),
    payload,
  };
}

export function createResourceChangeEvent(
  tick: number,
  nodeId: string | null,
  resourceType: string,
  delta: number,
  newQuantity: number
): GameEvent {
  const payload: ResourceChangePayload = {
    nodeId,
    resourceType: resourceType as ResourceChangePayload['resourceType'],
    delta,
    newQuantity,
  };
  return createEvent('resource_change', tick, payload);
}

// ============================================================================
// Game Loop State Management
// ============================================================================

export function createGameLoopState(
  world: GameWorld = createGameWorld(),
  seed: number = Date.now(),
  baseTickDuration: number = 100
): GameLoopState {
  return {
    world,
    time: createTimeState(baseTickDuration),
    eventQueue: [],
    eventHistory: [],
    random: createSeededRandom(seed),
  };
}

export function queueEvent(state: GameLoopState, event: GameEvent): GameLoopState {
  return {
    ...state,
    eventQueue: [...state.eventQueue, event],
  };
}

// ============================================================================
// Tick Processing
// ============================================================================

/**
 * Process a single game tick.
 * 
 * Phase 1: Process queued events
 * Phase 2: Apply resource regeneration
 * Phase 3: Commit state changes
 * Phase 4: Generate tick event
 * 
 * This function is PURE - it returns a new state without mutations.
 */
export function processTick(state: GameLoopState): { state: GameLoopState; result: TickResult } {
  const startTime = performance.now();
  const tick = state.time.currentTick + 1;
  const events: GameEvent[] = [];
  
  // Phase 1: Process queued events (for this tick or past-due)
  let world = state.world;
  const remainingEvents: GameEvent[] = [];
  
  for (const event of state.eventQueue) {
    if (event.tick <= tick) {
      // Event is ready to process
      world = applyEvent(world, event);
      events.push(event);
    } else {
      // Event is for a future tick
      remainingEvents.push(event);
    }
  }
  
  // Phase 2: Apply resource regeneration
  world = applyResourceRegeneration(world);
  
  // Phase 3: Generate tick completion event
  const tickEvent = createEvent('tick_processed', tick, { tick });
  events.push(tickEvent);
  
  // Phase 4: Commit state changes
  const newState: GameLoopState = {
    ...state,
    world,
    time: { ...state.time, currentTick: tick },
    eventQueue: remainingEvents,
    eventHistory: [...state.eventHistory, ...events],
  };
  
  const result: TickResult = {
    tick,
    events,
    duration: performance.now() - startTime,
  };
  
  return { state: newState, result };
}

/**
 * Apply a game event to the world state.
 * Returns a new world state (pure function).
 */
function applyEvent(world: GameWorld, event: GameEvent): GameWorld {
  switch (event.type) {
    case 'resource_change': {
      const payload = event.payload as ResourceChangePayload;
      if (payload.nodeId === null) {
        // Global resource change
        const resource = world.globalResources[payload.resourceType];
        if (resource) {
          return {
            ...world,
            globalResources: {
              ...world.globalResources,
              [payload.resourceType]: { ...resource, quantity: payload.newQuantity },
            },
          };
        }
      } else {
        // Node resource change
        const node = world.nodes.get(payload.nodeId);
        if (node && node.resources[payload.resourceType]) {
          const newNode = {
            ...node,
            resources: {
              ...node.resources,
              [payload.resourceType]: {
                ...node.resources[payload.resourceType],
                quantity: payload.newQuantity,
              },
            },
          };
          const newNodes = new Map(world.nodes);
          newNodes.set(payload.nodeId, newNode);
          return { ...world, nodes: newNodes };
        }
      }
      return world;
    }
    
    case 'connection_toggle': {
      const payload = event.payload as { connectionId: string; active: boolean };
      const connection = world.connections.get(payload.connectionId);
      if (connection) {
        const newConnections = new Map(world.connections);
        newConnections.set(payload.connectionId, { ...connection, active: payload.active });
        return { ...world, connections: newConnections };
      }
      return world;
    }
    
    default:
      return world;
  }
}

// ============================================================================
// Game Loop Runner (for real-time execution)
// ============================================================================

export interface GameLoopRunner {
  /** Current game state */
  getState(): GameLoopState;
  /** Start the game loop */
  start(): void;
  /** Stop the game loop */
  stop(): void;
  /** Check if loop is running */
  isRunning(): boolean;
  /** Set game speed (0 = pause) */
  setSpeed(speed: GameSpeed): void;
  /** Queue an event for processing */
  queueEvent(event: GameEvent): void;
  /** Subscribe to tick completion */
  onTick(callback: (result: TickResult) => void): () => void;
  /** Force a single tick (useful for testing/debugging) */
  forceTick(): TickResult;
}

/**
 * Create a game loop runner for real-time execution.
 * 
 * The runner manages timing and calls processTick at the appropriate rate.
 * It handles pause/unpause and speed changes smoothly.
 */
export function createGameLoopRunner(initialState: GameLoopState): GameLoopRunner {
  let state = initialState;
  let running = false;
  let lastTickTime = 0;
  let animationFrameId: number | null = null;
  const tickCallbacks: Set<(result: TickResult) => void> = new Set();
  
  function getTickInterval(): number {
    return getEffectiveTickDuration(state.time);
  }
  
  function loop(timestamp: number): void {
    if (!running) return;
    
    const interval = getTickInterval();
    
    // If paused (interval is Infinity), just schedule next frame
    if (!Number.isFinite(interval)) {
      animationFrameId = requestAnimationFrame(loop);
      return;
    }
    
    // Check if enough time has passed for next tick
    if (timestamp - lastTickTime >= interval) {
      const { state: newState, result } = processTick(state);
      state = newState;
      lastTickTime = timestamp;
      
      // Notify subscribers
      for (const callback of tickCallbacks) {
        callback(result);
      }
    }
    
    animationFrameId = requestAnimationFrame(loop);
  }
  
  return {
    getState(): GameLoopState {
      return state;
    },
    
    start(): void {
      if (running) return;
      running = true;
      lastTickTime = performance.now();
      animationFrameId = requestAnimationFrame(loop);
    },
    
    stop(): void {
      running = false;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    },
    
    isRunning(): boolean {
      return running;
    },
    
    setSpeed(speed: GameSpeed): void {
      state = {
        ...state,
        time: setGameSpeed(state.time, speed),
      };
    },
    
    queueEvent(event: GameEvent): void {
      state = {
        ...state,
        eventQueue: [...state.eventQueue, event],
      };
    },
    
    onTick(callback: (result: TickResult) => void): () => void {
      tickCallbacks.add(callback);
      return () => tickCallbacks.delete(callback);
    },
    
    forceTick(): TickResult {
      const { state: newState, result } = processTick(state);
      state = newState;
      
      for (const callback of tickCallbacks) {
        callback(result);
      }
      
      return result;
    },
  };
}

// ============================================================================
// Headless Runner (for server/testing - no requestAnimationFrame)
// ============================================================================

export interface HeadlessRunner {
  getState(): GameLoopState;
  tick(): TickResult;
  tickN(count: number): TickResult[];
  setState(newState: GameLoopState): void;
}

/**
 * Create a headless runner for server-side or testing.
 * No timing management - caller controls when ticks occur.
 */
export function createHeadlessRunner(initialState: GameLoopState): HeadlessRunner {
  let state = initialState;
  
  return {
    getState(): GameLoopState {
      return state;
    },
    
    tick(): TickResult {
      const { state: newState, result } = processTick(state);
      state = newState;
      return result;
    },
    
    tickN(count: number): TickResult[] {
      const results: TickResult[] = [];
      for (let i = 0; i < count; i++) {
        results.push(this.tick());
      }
      return results;
    },
    
    setState(newState: GameLoopState): void {
      state = newState;
    },
  };
}
