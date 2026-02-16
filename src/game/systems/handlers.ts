/**
 * Event Handlers - Registry of handlers for game events.
 * 
 * Design principles:
 * - Pure functions: no mutations, no side effects
 * - Deterministic: same input always produces same output
 * - Separable: suitable for Rust/Go extraction
 * - Extensible: registry pattern allows adding handlers dynamically
 * 
 * Each event type has a handler that transforms world state and may
 * produce new events as chain reactions.
 */

import type {
  GameWorld,
  GameEvent,
  GameEventType,
  EntityId,
  Node,
  Connection,
} from '../types';

/** Result of handling an event */
export interface EventHandlerResult {
  readonly world: GameWorld;
  /** New events spawned by this handler */
  readonly events: readonly GameEvent[];
}

/** Event handler function signature */
export type EventHandler = (world: GameWorld, event: GameEvent) => EventHandlerResult;

// --- Handler Registry ---

/** Map of event types to their handlers */
const handlerRegistry = new Map<GameEventType, EventHandler>();

/**
 * Register a handler for an event type.
 * Replaces any existing handler.
 */
export function registerHandler(type: GameEventType, handler: EventHandler): void {
  handlerRegistry.set(type, handler);
}

/**
 * Unregister a handler for an event type.
 */
export function unregisterHandler(type: GameEventType): boolean {
  return handlerRegistry.delete(type);
}

/**
 * Get the handler for an event type.
 * Returns undefined if no handler is registered.
 */
export function getHandler(type: GameEventType): EventHandler | undefined {
  return handlerRegistry.get(type);
}

/**
 * Check if a handler is registered for an event type.
 */
export function hasHandler(type: GameEventType): boolean {
  return handlerRegistry.has(type);
}

/**
 * Get all registered event types.
 */
export function getRegisteredTypes(): GameEventType[] {
  return Array.from(handlerRegistry.keys());
}

/**
 * Clear all registered handlers.
 * Useful for testing or resetting state.
 */
export function clearHandlers(): void {
  handlerRegistry.clear();
}

// --- Default Event Handlers ---

/**
 * No-op handler: passes through world unchanged, no new events.
 * Used for events that are purely informational (logging, UI updates).
 */
export const noOpHandler: EventHandler = (world: GameWorld, _event: GameEvent): EventHandlerResult => {
  return { world, events: [] };
};

/**
 * Handler for ResourceDepleted events.
 * Currently informational — can be extended to trigger gameplay effects.
 */
export const handleResourceDepleted: EventHandler = (world: GameWorld, event: GameEvent): EventHandlerResult => {
  // Currently no gameplay side effects, just propagate the event
  // Future: could trigger "starvation" mechanics, alerts, etc.
  return { world, events: [] };
};

/**
 * Handler for ResourceCapReached events.
 * Currently informational — could trigger overflow mechanics.
 */
export const handleResourceCapReached: EventHandler = (world: GameWorld, event: GameEvent): EventHandlerResult => {
  // Currently no gameplay side effects
  // Future: could trigger "overflow" warnings, resource loss, etc.
  return { world, events: [] };
};

/**
 * Handler for ResourceProduced events.
 * Currently informational.
 */
export const handleResourceProduced: EventHandler = (world: GameWorld, event: GameEvent): EventHandlerResult => {
  return { world, events: [] };
};

/**
 * Handler for NodeClaimed events.
 * Could trigger visibility updates, notifications to other players.
 */
export const handleNodeClaimed: EventHandler = (world: GameWorld, event: GameEvent): EventHandlerResult => {
  // Future: notify players, update fog of war, etc.
  return { world, events: [] };
};

/**
 * Handler for NodeDiscovered events.
 * Updates visibility state for the discovering player.
 */
export const handleNodeDiscovered: EventHandler = (world: GameWorld, event: GameEvent): EventHandlerResult => {
  // Future: update player's visibility map, trigger tutorial hints, etc.
  return { world, events: [] };
};

/**
 * Handler for ConnectionEstablished events.
 * Could trigger pathfinding cache invalidation, UI updates.
 */
export const handleConnectionEstablished: EventHandler = (world: GameWorld, event: GameEvent): EventHandlerResult => {
  // Future: invalidate pathfinding caches, notify connected players
  return { world, events: [] };
};

/**
 * Handler for ConnectionSevered events.
 * Could trigger pathfinding cache invalidation, strand units.
 */
export const handleConnectionSevered: EventHandler = (world: GameWorld, event: GameEvent): EventHandlerResult => {
  // Future: invalidate pathfinding caches, check for stranded units
  return { world, events: [] };
};

/**
 * Handler for GatewayActivated events.
 * Gateway has been used, now cooling down.
 */
export const handleGatewayActivated: EventHandler = (world: GameWorld, event: GameEvent): EventHandlerResult => {
  // Activation already handled by connectivity system
  // Future: visual effects, sound triggers
  return { world, events: [] };
};

/**
 * Handler for GatewayReady / GatewayCooldownExpired events.
 * Gateway is ready to be used again.
 */
export const handleGatewayCooldownExpired: EventHandler = (world: GameWorld, event: GameEvent): EventHandlerResult => {
  // Cooldown state already updated by connectivity system
  // Future: notify players, enable UI
  return { world, events: [] };
};

/**
 * Handler for TickProcessed events.
 * End-of-tick marker, primarily for debugging/logging.
 */
export const handleTickProcessed: EventHandler = (world: GameWorld, event: GameEvent): EventHandlerResult => {
  // Purely informational
  return { world, events: [] };
};

// --- Initialize Default Handlers ---

/**
 * Register all default handlers.
 * Call this during game initialization.
 */
export function initializeDefaultHandlers(): void {
  registerHandler('resource_depleted' as GameEventType, handleResourceDepleted);
  registerHandler('resource_cap_reached' as GameEventType, handleResourceCapReached);
  registerHandler('resource_produced' as GameEventType, handleResourceProduced);
  registerHandler('node_claimed' as GameEventType, handleNodeClaimed);
  registerHandler('node_discovered' as GameEventType, handleNodeDiscovered);
  registerHandler('connection_established' as GameEventType, handleConnectionEstablished);
  registerHandler('connection_severed' as GameEventType, handleConnectionSevered);
  registerHandler('gateway_activated' as GameEventType, handleGatewayActivated);
  registerHandler('gateway_ready' as GameEventType, handleGatewayCooldownExpired);
  registerHandler('gateway_cooldown_expired' as GameEventType, handleGatewayCooldownExpired);
  registerHandler('tick_processed' as GameEventType, handleTickProcessed);
}

// Auto-initialize on module load
initializeDefaultHandlers();
