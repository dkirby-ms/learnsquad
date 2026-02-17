/**
 * Territory System - Node claiming and control mechanics.
 * 
 * Design principles:
 * - Pure functions: no mutations, no side effects
 * - Deterministic: same inputs always produce same outputs
 * - Server-authoritative: claims are processed during tick
 * 
 * Claiming mechanics:
 * - Neutral nodes: +10 control points per tick
 * - Contested nodes (attacking enemy): -5 control points per tick for defender
 * - Threshold: 100 control points = ownership transfer
 * - When contested and controlPoints hit 0: ownership flips
 */

import type {
  GameWorld,
  Node,
  NodeStatus,
  EntityId,
  Tick,
  GameEvent,
  GameEventType,
} from '../types';

/** A claim action initiated by a player */
export interface ClaimAction {
  readonly playerId: string;
  readonly nodeId: string;
  readonly tick: number;
}

/** Result of territory processing */
export interface TerritoryProcessResult {
  readonly world: GameWorld;
  readonly events: GameEvent[];
}

/** Control point thresholds */
export const MAX_CONTROL_POINTS = 100;
export const NEUTRAL_CLAIM_RATE = 10;
export const CONTESTED_DRAIN_RATE = 5;

/**
 * Process territory claims for a single tick.
 * 
 * This is the main entry point for the territory system.
 * It processes all active claims and updates node ownership accordingly.
 */
export function processTerritoryClaims(
  world: GameWorld,
  activeClaims: readonly ClaimAction[],
  tick: Tick
): TerritoryProcessResult {
  const events: GameEvent[] = [];
  const updatedNodes: Record<EntityId, Node> = { ...world.nodes };

  // Group claims by nodeId to detect contested situations
  const claimsByNode = new Map<EntityId, ClaimAction[]>();
  for (const claim of activeClaims) {
    const existing = claimsByNode.get(claim.nodeId) || [];
    claimsByNode.set(claim.nodeId, [...existing, claim]);
  }

  // Process each node with active claims
  for (const [nodeId, claims] of Array.from(claimsByNode.entries())) {
    const node = updatedNodes[nodeId];
    if (!node) continue;

    const result = processNodeClaim(node, claims, tick);
    updatedNodes[nodeId] = result.node;
    events.push(...result.events);
  }

  return {
    world: {
      ...world,
      nodes: updatedNodes,
    },
    events,
  };
}

/**
 * Process claims for a single node.
 * Handles neutral claiming, contested state, and ownership transfer.
 */
function processNodeClaim(
  node: Node,
  claims: readonly ClaimAction[],
  tick: Tick
): { node: Node; events: GameEvent[] } {
  const events: GameEvent[] = [];
  
  // Determine unique players claiming this node
  const uniquePlayers = new Set(claims.map(c => c.playerId));
  
  // If multiple players are claiming, the node is contested
  const isContested = uniquePlayers.size > 1 || 
    (uniquePlayers.size === 1 && node.ownerId && !uniquePlayers.has(node.ownerId));
  
  // Single player claiming
  const claimingPlayer = uniquePlayers.size === 1 ? Array.from(uniquePlayers)[0] : null;
  
  // Initialize controlPoints if not present (for backwards compatibility)
  const currentControlPoints = ('controlPoints' in node) ? (node as any).controlPoints : 0;
  const maxControlPoints = ('maxControlPoints' in node) ? (node as any).maxControlPoints : MAX_CONTROL_POINTS;
  
  let newControlPoints = currentControlPoints;
  let newOwnerId = node.ownerId;
  let newStatus = node.status;

  // Case 1: Node is neutral and single player is claiming
  if (!node.ownerId && claimingPlayer && !isContested) {
    newControlPoints = Math.min(maxControlPoints, currentControlPoints + NEUTRAL_CLAIM_RATE);
    newStatus = 'neutral' as NodeStatus;
    
    // Check if claim is complete
    if (newControlPoints >= maxControlPoints) {
      newOwnerId = claimingPlayer;
      newStatus = 'claimed' as NodeStatus;
      newControlPoints = maxControlPoints;
      
      events.push({
        type: 'node_claimed' as GameEventType,
        tick,
        entityId: node.id,
        data: {
          playerId: claimingPlayer,
          nodeId: node.id,
          nodeName: node.name,
        },
      });
    }
  }
  // Case 2: Node is owned and being contested
  else if (node.ownerId && claimingPlayer && claimingPlayer !== node.ownerId) {
    // Emit contested event if status is changing
    if (node.status !== 'contested') {
      events.push({
        type: 'node_contested' as GameEventType,
        tick,
        entityId: node.id,
        data: {
          nodeId: node.id,
          nodeName: node.name,
          defenderId: node.ownerId,
          attackerId: claimingPlayer,
        },
      });
    }
    
    newStatus = 'contested' as NodeStatus;
    newControlPoints = Math.max(0, currentControlPoints - CONTESTED_DRAIN_RATE);
    
    // Check if ownership flips
    if (newControlPoints === 0) {
      const previousOwner = node.ownerId;
      newOwnerId = claimingPlayer;
      newStatus = 'claimed' as NodeStatus;
      newControlPoints = MAX_CONTROL_POINTS;
      
      events.push({
        type: 'node_lost' as GameEventType,
        tick,
        entityId: node.id,
        data: {
          nodeId: node.id,
          nodeName: node.name,
          previousOwner,
          newOwner: claimingPlayer,
        },
      });
      
      events.push({
        type: 'node_claimed' as GameEventType,
        tick,
        entityId: node.id,
        data: {
          playerId: claimingPlayer,
          nodeId: node.id,
          nodeName: node.name,
        },
      });
    }
  }
  // Case 3: Multiple players contesting neutral node
  else if (!node.ownerId && isContested) {
    newStatus = 'contested' as NodeStatus;
    // Control points don't change in multi-way contests
    newControlPoints = currentControlPoints;
    
    if (node.status !== 'contested') {
      events.push({
        type: 'node_contested' as GameEventType,
        tick,
        entityId: node.id,
        data: {
          nodeId: node.id,
          nodeName: node.name,
          claimants: Array.from(uniquePlayers),
        },
      });
    }
  }
  // Case 4: Owner continues claiming their own node (reinforce)
  else if (node.ownerId && claimingPlayer === node.ownerId) {
    // Owner maintaining control
    newControlPoints = Math.min(maxControlPoints, currentControlPoints + NEUTRAL_CLAIM_RATE);
    newStatus = 'claimed' as NodeStatus;
  }

  return {
    node: {
      ...node,
      ownerId: newOwnerId,
      status: newStatus,
      // Add controlPoints fields (will need type update)
      controlPoints: newControlPoints,
      maxControlPoints,
    } as Node,
    events,
  };
}

/**
 * Check if a player can claim a node.
 * Validation logic for claim actions.
 */
export function canClaim(
  world: GameWorld,
  playerId: string,
  nodeId: string
): { canClaim: boolean; reason?: string } {
  const node = world.nodes[nodeId];
  
  if (!node) {
    return { canClaim: false, reason: 'Node does not exist' };
  }
  
  // Players can claim any node except those owned by themselves
  if (node.ownerId === playerId) {
    return { canClaim: false, reason: 'Already owned by player' };
  }
  
  return { canClaim: true };
}

/**
 * Get the claiming progress for a node.
 * Useful for UI display.
 */
export function getClaimProgress(node: Node): number {
  const controlPoints = ('controlPoints' in node) ? (node as any).controlPoints : 0;
  const maxControlPoints = ('maxControlPoints' in node) ? (node as any).maxControlPoints : MAX_CONTROL_POINTS;
  
  return maxControlPoints > 0 ? controlPoints / maxControlPoints : 0;
}

/**
 * Abandon a claim on a node (reset to neutral).
 * Used when a player voluntarily gives up control.
 */
export function abandonNode(
  node: Node,
  tick: Tick
): { node: Node; events: GameEvent[] } {
  const events: GameEvent[] = [];
  
  if (node.ownerId) {
    events.push({
      type: 'node_lost' as GameEventType,
      tick,
      entityId: node.id,
      data: {
        nodeId: node.id,
        nodeName: node.name,
        previousOwner: node.ownerId,
        abandoned: true,
      },
    });
  }
  
  return {
    node: {
      ...node,
      ownerId: null,
      status: 'neutral' as NodeStatus,
      controlPoints: 0,
      maxControlPoints: MAX_CONTROL_POINTS,
    } as Node,
    events,
  };
}
