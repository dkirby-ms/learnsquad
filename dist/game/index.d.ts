/**
 * Game Simulation Module
 *
 * This module contains the core game simulation logic:
 * - Pure, deterministic tick processing
 * - Game world state management
 * - Resource regeneration and events
 *
 * Designed for potential extraction to Rust/Go.
 */
export * from './types';
export * from './models';
export { GameLoop, processTick, processMultipleTicks } from './loop';
//# sourceMappingURL=index.d.ts.map