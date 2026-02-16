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
import type { GameWorld, TickResult } from './types';
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
export declare function processTick(world: GameWorld): TickResult;
/**
 * Process multiple ticks at once.
 * Useful for catch-up scenarios or fast-forward.
 */
export declare function processMultipleTicks(world: GameWorld, tickCount: number): TickResult;
/**
 * GameLoop class - manages tick scheduling and execution.
 *
 * This provides the stateful wrapper around the pure processTick function.
 * It handles:
 * - Tick scheduling based on game speed
 * - Event emission to listeners
 * - Pause/resume functionality
 */
export declare class GameLoop {
    private world;
    private listeners;
    private tickInterval;
    /** Base tick rate in milliseconds (ticks per second at normal speed) */
    private readonly baseTickRate;
    constructor(initialWorld: GameWorld, baseTickRate?: number);
    /** Get current world state (immutable) */
    getWorld(): GameWorld;
    /** Get current tick number */
    getCurrentTick(): number;
    /** Check if the game is paused */
    isPaused(): boolean;
    /** Subscribe to tick events */
    subscribe(listener: (result: TickResult) => void): () => void;
    /** Process a single tick manually */
    tick(): TickResult;
    /** Start automatic tick processing */
    start(): void;
    /** Stop automatic tick processing */
    stop(): void;
    /** Set a new world state (for loading saves, etc.) */
    setWorld(world: GameWorld): void;
    /** Notify all listeners of a tick result */
    private notifyListeners;
}
//# sourceMappingURL=loop.d.ts.map