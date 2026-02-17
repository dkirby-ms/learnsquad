/**
 * Game Simulation Module
 * 
 * This module contains the core game simulation logic:
 * - Pure, deterministic tick processing
 * - Game world state management
 * - Resource regeneration and events
 * - Territory claiming system
 * 
 * Designed for potential extraction to Rust/Go.
 */

// Core types
export * from './types';

// Model operations
export * from './models';

// Game loop
export { GameLoop, processTick, processMultipleTicks } from './loop';

// Systems
export * from './systems/resources';
export * from './systems/territory';
export * from './systems/connectivity';
export * from './systems/events';
export * from './systems/handlers';
