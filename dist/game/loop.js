"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameLoop = void 0;
exports.processTick = processTick;
exports.processMultipleTicks = processMultipleTicks;
const node_1 = require("./models/node");
const world_1 = require("./models/world");
/**
 * Process a single game tick.
 *
 * This is the core simulation step. It:
 * 1. Processes resource regeneration at all nodes
 * 2. Collects any events generated
 * 3. Advances the tick counter
 * 4. Returns the new world state and events
 *
 * This function is PURE - no side effects, completely deterministic.
 */
function processTick(world) {
    // If paused, return unchanged state with no events
    if (world.isPaused) {
        return {
            world,
            events: [],
            processedTick: world.currentTick,
        };
    }
    const nextTick = world.currentTick + 1;
    const allEvents = [];
    const updatedNodes = {};
    // Process each node
    for (const [nodeId, node] of Object.entries(world.nodes)) {
        const result = (0, node_1.tickNode)(node, nextTick);
        updatedNodes[nodeId] = result.node;
        allEvents.push(...result.events);
    }
    // Add tick processed event
    allEvents.push({
        type: 'tick_processed',
        tick: nextTick,
        entityId: world.id,
        data: { previousTick: world.currentTick },
    });
    // Build new world state
    let newWorld = (0, world_1.setNodes)(world, updatedNodes);
    newWorld = (0, world_1.advanceTick)(newWorld);
    newWorld = (0, world_1.clearEventQueue)(newWorld);
    newWorld = (0, world_1.queueEvents)(newWorld, allEvents);
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
function processMultipleTicks(world, tickCount) {
    let currentWorld = world;
    const allEvents = [];
    let lastProcessedTick = world.currentTick;
    for (let i = 0; i < tickCount; i++) {
        const result = processTick(currentWorld);
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
class GameLoop {
    world;
    listeners;
    tickInterval;
    /** Base tick rate in milliseconds (ticks per second at normal speed) */
    baseTickRate;
    constructor(initialWorld, baseTickRate = 1000) {
        this.world = initialWorld;
        this.listeners = new Set();
        this.tickInterval = null;
        this.baseTickRate = baseTickRate;
    }
    /** Get current world state (immutable) */
    getWorld() {
        return this.world;
    }
    /** Get current tick number */
    getCurrentTick() {
        return this.world.currentTick;
    }
    /** Check if the game is paused */
    isPaused() {
        return this.world.isPaused;
    }
    /** Subscribe to tick events */
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    /** Process a single tick manually */
    tick() {
        const result = processTick(this.world);
        this.world = result.world;
        this.notifyListeners(result);
        return result;
    }
    /** Start automatic tick processing */
    start() {
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
    stop() {
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
    setWorld(world) {
        this.world = world;
    }
    /** Notify all listeners of a tick result */
    notifyListeners(result) {
        this.listeners.forEach(listener => listener(result));
    }
}
exports.GameLoop = GameLoop;
//# sourceMappingURL=loop.js.map