/**
 * State Serialization Helpers
 * 
 * Handles efficient serialization of game state for network transmission.
 * 
 * Strategy:
 * - Full state on join/resync
 * - Delta updates per tick (only changed nodes)
 * - Events are always sent in full (they're small)
 */

import type {
  GameWorld,
  Node,
  Connection,
  EntityId,
  TickResult,
} from '../shared/game-types';
import type { GameStateUpdate, TickComplete } from './types';

/**
 * Create a full state snapshot message
 */
export function createGameStateUpdate(world: GameWorld): GameStateUpdate {
  return {
    type: 'game_state_update',
    world: serializeWorld(world),
    serverTime: Date.now(),
  };
}

/**
 * Create a delta tick update message
 * 
 * @param result - The tick result from processTick()
 * @param previousWorld - World state before the tick (for diffing)
 */
export function createTickComplete(
  result: TickResult,
  previousWorld: GameWorld
): TickComplete {
  const changedNodeIds = detectChangedNodes(previousWorld, result.world);
  const changedNodes: Record<EntityId, Node> = {};
  
  for (const nodeId of changedNodeIds) {
    const node = result.world.nodes[nodeId];
    if (node) {
      changedNodes[nodeId] = node;
    }
  }

  return {
    type: 'tick_complete',
    tick: result.processedTick,
    events: result.events,
    changedNodeIds,
    changedNodes,
    isPaused: result.world.isPaused,
    speed: result.world.speed,
    serverTime: Date.now(),
  };
}

/**
 * Detect which nodes changed between two world states
 * 
 * Uses reference equality first (cheap), then deep comparison if needed.
 */
export function detectChangedNodes(
  before: GameWorld,
  after: GameWorld
): EntityId[] {
  const changed: EntityId[] = [];

  // Check all nodes in after state
  for (const [nodeId, afterNode] of Object.entries(after.nodes)) {
    const beforeNode = before.nodes[nodeId];
    
    // New node
    if (!beforeNode) {
      changed.push(nodeId);
      continue;
    }
    
    // Reference equality (cheap check)
    if (beforeNode === afterNode) {
      continue;
    }
    
    // Actually changed
    changed.push(nodeId);
  }

  // Check for removed nodes
  for (const nodeId of Object.keys(before.nodes)) {
    if (!after.nodes[nodeId]) {
      changed.push(nodeId);
    }
  }

  return changed;
}

/**
 * Serialize a GameWorld for transmission
 * 
 * Currently just returns the world as-is since it's already
 * a plain object. This function exists for future optimization:
 * - Could strip unnecessary fields
 * - Could apply compression
 * - Could convert to binary format
 */
export function serializeWorld(world: GameWorld): GameWorld {
  return world;
}

/**
 * Serialize a Node for transmission
 */
export function serializeNode(node: Node): Node {
  return node;
}

/**
 * Serialize a Connection for transmission
 */
export function serializeConnection(connection: Connection): Connection {
  return connection;
}

/**
 * Calculate approximate message size (for debugging/metrics)
 */
export function estimateMessageSize(obj: unknown): number {
  return JSON.stringify(obj).length;
}
