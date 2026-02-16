/**
 * Game Simulation Engine
 * 
 * A pure, deterministic simulation layer for the MMOG grand strategy game.
 * Designed to be separable and extractable to Rust/Go.
 * 
 * @module simulation
 */

// Core types
export type {
  ResourceType,
  Resource,
  ResourceMap,
  ConnectionType,
  Connection,
  NodePosition,
  NodeMetadata,
  Node,
  GameWorld,
  GameSpeed,
  TimeState,
  GameEventType,
  GameEvent,
  ResourceChangePayload,
  ConnectionTogglePayload,
  SeededRandom,
  GameLoopState,
  TickResult,
  TickProcessor,
} from './types.js';

// World management
export {
  createResource,
  createNode,
  createConnection,
  createGameWorld,
  getNode,
  getConnection,
  getNodeConnections,
  getAdjacentNodes,
  getDirectConnections,
  getGatewayConnections,
  addNode,
  removeNode,
  addConnection,
  setConnectionActive,
  updateNodeResource,
  updateGlobalResource,
  applyResourceRegeneration,
} from './world.js';

// Game loop and time
export {
  createSeededRandom,
  createTimeState,
  getEffectiveTickDuration,
  setGameSpeed,
  isPaused,
  pause,
  unpause,
  createEvent,
  createResourceChangeEvent,
  createGameLoopState,
  queueEvent,
  processTick,
  createGameLoopRunner,
  createHeadlessRunner,
} from './gameLoop.js';

export type { GameLoopRunner, HeadlessRunner } from './gameLoop.js';
