/**
 * Connectivity System - Node traversal, pathfinding, and graph navigation.
 * 
 * Design principles:
 * - Pure functions: no mutations, no side effects
 * - Deterministic: same input always produces same output
 * - Separable: suitable for Rust/Go extraction
 * 
 * This module handles:
 * - Direct link traversal with cost calculation
 * - Gateway activation mechanics
 * - A* pathfinding between nodes
 * - Connection discovery (neighbors, reachable nodes)
 */

import type {
  Connection,
  ConnectionType,
  Node,
  GameWorld,
  EntityId,
  NodeId,
  TraversalContext,
  Gateway,
  Path,
  PathStep,
  CostFunction,
  GameEvent,
  GameEventType,
  Tick,
  ResourceCost,
} from '../types';
import { getOtherNode } from '../models/connection';

// --- Traversal Functions ---

/**
 * Check if a connection can be traversed.
 * 
 * Connections can be traversed if:
 * - The connection is active
 * - For gateways: not cooling down and resources available (if context provided)
 */
export function canTraverse(
  connection: Connection,
  context?: TraversalContext
): boolean {
  // Inactive connections cannot be traversed
  if (!connection.isActive) {
    return false;
  }

  // Direct connections are always traversable when active
  if (connection.type === ('direct' as ConnectionType)) {
    return true;
  }

  // Gateway checks
  if (connection.type === ('gateway' as ConnectionType)) {
    const gateway = connection as Gateway;
    
    // Cannot traverse while cooling down
    if (gateway.isCoolingDown) {
      return false;
    }

    // If context provided, check resource availability
    if (context?.availableResources && gateway.activationCost.length > 0) {
      for (const cost of gateway.activationCost) {
        const available = context.availableResources[cost.type] ?? 0;
        if (available < cost.amount) {
          return false;
        }
      }
    }

    return true;
  }

  return true;
}

/**
 * Get the traversal cost for a connection.
 * Returns the travel time (in ticks).
 */
export function getTraversalCost(connection: Connection): number {
  return connection.travelTime;
}

/**
 * Default cost function: uses travel time.
 */
export const defaultCostFunction: CostFunction = (connection: Connection) => {
  return getTraversalCost(connection);
};

// --- Gateway Functions ---

/**
 * Check if a gateway is ready to be activated.
 */
export function isGatewayReady(gateway: Gateway, currentTick: Tick): boolean {
  if (!gateway.isActive) {
    return false;
  }

  if (gateway.isCoolingDown && gateway.lastActivatedTick !== null) {
    const cooldownEnd = gateway.lastActivatedTick + gateway.activationTime;
    return currentTick >= cooldownEnd;
  }

  return !gateway.isCoolingDown;
}

/**
 * Activate a gateway, producing updated node state and events.
 * 
 * This deducts activation costs from the node's resources and
 * marks the gateway as cooling down.
 * 
 * Returns the updated node and any generated events.
 */
export function activateGateway(
  gateway: Gateway,
  node: Node,
  currentTick: Tick
): { gateway: Gateway; node: Node; events: GameEvent[] } {
  const events: GameEvent[] = [];

  // Deduct activation costs from node resources
  let updatedNode = node;
  if (gateway.activationCost.length > 0) {
    const newResources = node.resources.map(resource => {
      const cost = gateway.activationCost.find(c => c.type === resource.type);
      if (cost) {
        return {
          ...resource,
          amount: Math.max(0, resource.amount - cost.amount),
        };
      }
      return resource;
    });
    updatedNode = { ...node, resources: newResources };
  }

  // Mark gateway as cooling down
  const updatedGateway: Gateway = {
    ...gateway,
    lastActivatedTick: currentTick,
    isCoolingDown: gateway.activationTime > 0,
  };

  // Generate activation event
  events.push({
    type: 'gateway_activated' as GameEventType,
    tick: currentTick,
    entityId: gateway.id,
    data: {
      fromNodeId: gateway.fromNodeId,
      toNodeId: gateway.toNodeId,
      activationCost: gateway.activationCost,
    },
  });

  return {
    gateway: updatedGateway,
    node: updatedNode,
    events,
  };
}

/**
 * Create a gateway from connection parameters.
 */
export function createGateway(
  id: EntityId,
  fromNodeId: NodeId,
  toNodeId: NodeId,
  travelTime: number,
  activationCost: readonly ResourceCost[] = [],
  activationTime: number = 0
): Gateway {
  return {
    id,
    fromNodeId,
    toNodeId,
    type: 'gateway' as ConnectionType.Gateway,
    travelTime,
    isActive: true,
    activationCost,
    activationTime,
    lastActivatedTick: null,
    isCoolingDown: false,
  };
}

/**
 * Update gateway cooldown state.
 * Call this during tick processing to check if gateways should become ready.
 */
export function updateGatewayCooldown(
  gateway: Gateway,
  currentTick: Tick
): { gateway: Gateway; events: GameEvent[] } {
  const events: GameEvent[] = [];

  if (gateway.isCoolingDown && gateway.lastActivatedTick !== null) {
    const cooldownEnd = gateway.lastActivatedTick + gateway.activationTime;
    
    if (currentTick >= cooldownEnd) {
      events.push({
        type: 'gateway_ready' as GameEventType,
        tick: currentTick,
        entityId: gateway.id,
        data: {
          fromNodeId: gateway.fromNodeId,
          toNodeId: gateway.toNodeId,
        },
      });

      return {
        gateway: { ...gateway, isCoolingDown: false },
        events,
      };
    }
  }

  return { gateway, events };
}

// --- Pathfinding Functions ---

/** Internal structure for A* algorithm */
interface PathNode {
  nodeId: NodeId;
  connectionId: EntityId | null;
  gCost: number; // Cost from start
  hCost: number; // Heuristic cost to end
  fCost: number; // Total cost (g + h)
  parent: PathNode | null;
}

/**
 * Calculate Manhattan distance heuristic between two nodes.
 * Provides admissible heuristic for A*.
 */
function heuristic(nodeA: Node, nodeB: Node): number {
  return Math.abs(nodeA.position.x - nodeB.position.x) + 
         Math.abs(nodeA.position.y - nodeB.position.y);
}

/**
 * Find the shortest path between two nodes using A*.
 * 
 * Returns null if no path exists.
 * The path excludes the starting node but includes the destination.
 */
export function findPath(
  world: GameWorld,
  from: NodeId,
  to: NodeId,
  costFn: CostFunction = defaultCostFunction,
  context?: TraversalContext
): Path | null {
  const startNode = world.nodes[from];
  const endNode = world.nodes[to];

  if (!startNode || !endNode) {
    return null;
  }

  // Same node: empty path
  if (from === to) {
    return {
      from,
      to,
      steps: [],
      totalCost: 0,
    };
  }

  const openSet: PathNode[] = [];
  const closedSet = new Set<NodeId>();
  const nodeMap = new Map<NodeId, PathNode>();

  // Initialize start node
  const startPathNode: PathNode = {
    nodeId: from,
    connectionId: null,
    gCost: 0,
    hCost: heuristic(startNode, endNode),
    fCost: heuristic(startNode, endNode),
    parent: null,
  };
  openSet.push(startPathNode);
  nodeMap.set(from, startPathNode);

  while (openSet.length > 0) {
    // Get node with lowest fCost
    openSet.sort((a, b) => a.fCost - b.fCost);
    const current = openSet.shift()!;

    // Found destination
    if (current.nodeId === to) {
      return reconstructPath(from, to, current);
    }

    closedSet.add(current.nodeId);

    // Get current node data
    const currentNode = world.nodes[current.nodeId];
    if (!currentNode) continue;

    // Explore neighbors
    for (const connId of currentNode.connectionIds) {
      const connection = world.connections[connId];
      if (!connection) continue;

      // Check traversability
      if (!canTraverse(connection, context)) continue;

      // Get neighbor node
      const neighborId = getOtherNode(connection, current.nodeId);
      if (!neighborId || closedSet.has(neighborId)) continue;

      const neighborNode = world.nodes[neighborId];
      if (!neighborNode) continue;

      // Calculate costs
      const moveCost = costFn(connection, currentNode, neighborNode);
      const gCost = current.gCost + moveCost;
      const hCost = heuristic(neighborNode, endNode);
      const fCost = gCost + hCost;

      // Check if this path is better
      const existingNode = nodeMap.get(neighborId);
      if (existingNode && gCost >= existingNode.gCost) {
        continue;
      }

      const pathNode: PathNode = {
        nodeId: neighborId,
        connectionId: connId,
        gCost,
        hCost,
        fCost,
        parent: current,
      };

      nodeMap.set(neighborId, pathNode);

      // Add to open set if not already there
      const existingIndex = openSet.findIndex(n => n.nodeId === neighborId);
      if (existingIndex >= 0) {
        openSet[existingIndex] = pathNode;
      } else {
        openSet.push(pathNode);
      }
    }
  }

  // No path found
  return null;
}

/**
 * Reconstruct path from A* result.
 */
function reconstructPath(from: NodeId, to: NodeId, endNode: PathNode): Path {
  const steps: PathStep[] = [];
  let current: PathNode | null = endNode;

  while (current && current.parent !== null) {
    steps.unshift({
      nodeId: current.nodeId,
      connectionId: current.connectionId!,
      cumulativeCost: current.gCost,
    });
    current = current.parent;
  }

  return {
    from,
    to,
    steps,
    totalCost: endNode.gCost,
  };
}

// --- Discovery Functions ---

/**
 * Get all directly connected neighbor nodes.
 * Only returns nodes reachable via active connections.
 */
export function getNeighbors(
  world: GameWorld,
  nodeId: NodeId,
  context?: TraversalContext
): Node[] {
  const node = world.nodes[nodeId];
  if (!node) {
    return [];
  }

  const neighbors: Node[] = [];

  for (const connId of node.connectionIds) {
    const connection = world.connections[connId];
    if (!connection) continue;

    // Check traversability
    if (!canTraverse(connection, context)) continue;

    const neighborId = getOtherNode(connection, nodeId);
    if (!neighborId) continue;

    const neighborNode = world.nodes[neighborId];
    if (neighborNode) {
      neighbors.push(neighborNode);
    }
  }

  return neighbors;
}

/**
 * Get all neighbor node IDs with their connection costs.
 * Useful for building cost maps.
 */
export function getNeighborsWithCosts(
  world: GameWorld,
  nodeId: NodeId,
  costFn: CostFunction = defaultCostFunction,
  context?: TraversalContext
): Array<{ node: Node; cost: number; connectionId: EntityId }> {
  const node = world.nodes[nodeId];
  if (!node) {
    return [];
  }

  const results: Array<{ node: Node; cost: number; connectionId: EntityId }> = [];

  for (const connId of node.connectionIds) {
    const connection = world.connections[connId];
    if (!connection) continue;

    if (!canTraverse(connection, context)) continue;

    const neighborId = getOtherNode(connection, nodeId);
    if (!neighborId) continue;

    const neighborNode = world.nodes[neighborId];
    if (neighborNode) {
      const cost = costFn(connection, node, neighborNode);
      results.push({ node: neighborNode, cost, connectionId: connId });
    }
  }

  return results;
}

/**
 * Get all nodes reachable from a starting node within a cost budget.
 * Uses Dijkstra's algorithm for shortest paths.
 * 
 * @param world - Game world state
 * @param nodeId - Starting node ID
 * @param maxCost - Maximum total cost to reach nodes (optional, no limit if undefined)
 * @param costFn - Cost function for connections
 * @param context - Traversal context for permission checks
 */
export function getReachableNodes(
  world: GameWorld,
  nodeId: NodeId,
  maxCost?: number,
  costFn: CostFunction = defaultCostFunction,
  context?: TraversalContext
): Array<{ node: Node; cost: number }> {
  const startNode = world.nodes[nodeId];
  if (!startNode) {
    return [];
  }

  const distances = new Map<NodeId, number>();
  const visited = new Set<NodeId>();
  const queue: Array<{ nodeId: NodeId; cost: number }> = [{ nodeId, cost: 0 }];

  distances.set(nodeId, 0);

  while (queue.length > 0) {
    // Get node with minimum cost
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;

    if (visited.has(current.nodeId)) continue;
    visited.add(current.nodeId);

    const currentNode = world.nodes[current.nodeId];
    if (!currentNode) continue;

    // Explore neighbors
    for (const connId of currentNode.connectionIds) {
      const connection = world.connections[connId];
      if (!connection) continue;

      if (!canTraverse(connection, context)) continue;

      const neighborId = getOtherNode(connection, current.nodeId);
      if (!neighborId || visited.has(neighborId)) continue;

      const neighborNode = world.nodes[neighborId];
      if (!neighborNode) continue;

      const edgeCost = costFn(connection, currentNode, neighborNode);
      const totalCost = current.cost + edgeCost;

      // Skip if exceeds max cost
      if (maxCost !== undefined && totalCost > maxCost) continue;

      const existingCost = distances.get(neighborId);
      if (existingCost === undefined || totalCost < existingCost) {
        distances.set(neighborId, totalCost);
        queue.push({ nodeId: neighborId, cost: totalCost });
      }
    }
  }

  // Build result array (excluding starting node)
  const result: Array<{ node: Node; cost: number }> = [];
  distances.forEach((cost, nId) => {
    if (nId === nodeId) return; // Exclude starting node
    const node = world.nodes[nId];
    if (node) {
      result.push({ node, cost });
    }
  });

  // Sort by cost for deterministic output
  result.sort((a, b) => a.cost - b.cost);

  return result;
}

/**
 * Check if two nodes are connected (directly or indirectly).
 */
export function areNodesConnected(
  world: GameWorld,
  nodeA: NodeId,
  nodeB: NodeId,
  context?: TraversalContext
): boolean {
  if (nodeA === nodeB) return true;

  const path = findPath(world, nodeA, nodeB, defaultCostFunction, context);
  return path !== null;
}

/**
 * Get all connections between two specific nodes.
 * Returns empty array if nodes aren't directly connected.
 */
export function getConnectionsBetween(
  world: GameWorld,
  nodeA: NodeId,
  nodeB: NodeId
): Connection[] {
  const node = world.nodes[nodeA];
  if (!node) return [];

  return node.connectionIds
    .map(id => world.connections[id])
    .filter((conn): conn is Connection => {
      if (!conn) return false;
      return (
        (conn.fromNodeId === nodeA && conn.toNodeId === nodeB) ||
        (conn.fromNodeId === nodeB && conn.toNodeId === nodeA)
      );
    });
}
