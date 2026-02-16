/**
 * World state management for the game simulation.
 * 
 * DESIGN: All functions are pure - they return new state rather than mutating.
 * This enables deterministic replay and easy testing.
 */

import type {
  GameWorld,
  Node,
  NodePosition,
  NodeMetadata,
  Connection,
  ConnectionType,
  Resource,
  ResourceType,
  ResourceMap,
} from './types.js';

// ============================================================================
// Factory Functions
// ============================================================================

export function createResource(
  type: ResourceType,
  quantity: number = 0,
  regenRate: number = 0,
  maxCapacity: number = -1
): Resource {
  return {
    type,
    quantity: Math.max(0, quantity),
    regenRate,
    maxCapacity,
  };
}

export function createNode(
  id: string,
  position: NodePosition,
  metadata: NodeMetadata,
  resources: ResourceMap = {},
  connectionIds: string[] = []
): Node {
  return {
    id,
    position,
    metadata,
    resources: { ...resources },
    connectionIds: [...connectionIds],
  };
}

export function createConnection(
  id: string,
  type: ConnectionType,
  sourceNodeId: string,
  targetNodeId: string,
  traversalCost: number = 1,
  active: boolean = true
): Connection {
  return {
    id,
    type,
    sourceNodeId,
    targetNodeId,
    traversalCost,
    active,
  };
}

export function createGameWorld(
  nodes: Node[] = [],
  connections: Connection[] = [],
  globalResources: ResourceMap = {}
): GameWorld {
  return {
    nodes: new Map(nodes.map(n => [n.id, n])),
    connections: new Map(connections.map(c => [c.id, c])),
    globalResources: { ...globalResources },
  };
}

// ============================================================================
// World Query Functions
// ============================================================================

export function getNode(world: GameWorld, nodeId: string): Node | undefined {
  return world.nodes.get(nodeId);
}

export function getConnection(world: GameWorld, connectionId: string): Connection | undefined {
  return world.connections.get(connectionId);
}

export function getNodeConnections(world: GameWorld, nodeId: string): Connection[] {
  const node = world.nodes.get(nodeId);
  if (!node) return [];
  
  return node.connectionIds
    .map(id => world.connections.get(id))
    .filter((c): c is Connection => c !== undefined);
}

export function getAdjacentNodes(world: GameWorld, nodeId: string): Node[] {
  const connections = getNodeConnections(world, nodeId);
  const adjacentIds = new Set<string>();
  
  for (const conn of connections) {
    if (!conn.active) continue;
    if (conn.sourceNodeId === nodeId) {
      adjacentIds.add(conn.targetNodeId);
    } else {
      adjacentIds.add(conn.sourceNodeId);
    }
  }
  
  return Array.from(adjacentIds)
    .map(id => world.nodes.get(id))
    .filter((n): n is Node => n !== undefined);
}

export function getDirectConnections(world: GameWorld, nodeId: string): Connection[] {
  return getNodeConnections(world, nodeId).filter(c => c.type === 'direct');
}

export function getGatewayConnections(world: GameWorld, nodeId: string): Connection[] {
  return getNodeConnections(world, nodeId).filter(c => c.type === 'gateway');
}

// ============================================================================
// World Mutation Functions (Pure - return new state)
// ============================================================================

export function addNode(world: GameWorld, node: Node): GameWorld {
  const newNodes = new Map(world.nodes);
  newNodes.set(node.id, node);
  return {
    ...world,
    nodes: newNodes,
  };
}

export function removeNode(world: GameWorld, nodeId: string): GameWorld {
  const newNodes = new Map(world.nodes);
  newNodes.delete(nodeId);
  
  // Remove connections referencing this node
  const newConnections = new Map(world.connections);
  for (const [id, conn] of newConnections) {
    if (conn.sourceNodeId === nodeId || conn.targetNodeId === nodeId) {
      newConnections.delete(id);
    }
  }
  
  return {
    ...world,
    nodes: newNodes,
    connections: newConnections,
  };
}

export function addConnection(world: GameWorld, connection: Connection): GameWorld {
  const newConnections = new Map(world.connections);
  newConnections.set(connection.id, connection);
  
  // Update source and target nodes with connection reference
  const newNodes = new Map(world.nodes);
  
  const sourceNode = newNodes.get(connection.sourceNodeId);
  if (sourceNode && !sourceNode.connectionIds.includes(connection.id)) {
    newNodes.set(connection.sourceNodeId, {
      ...sourceNode,
      connectionIds: [...sourceNode.connectionIds, connection.id],
    });
  }
  
  const targetNode = newNodes.get(connection.targetNodeId);
  if (targetNode && !targetNode.connectionIds.includes(connection.id)) {
    newNodes.set(connection.targetNodeId, {
      ...targetNode,
      connectionIds: [...targetNode.connectionIds, connection.id],
    });
  }
  
  return {
    ...world,
    nodes: newNodes,
    connections: newConnections,
  };
}

export function setConnectionActive(
  world: GameWorld,
  connectionId: string,
  active: boolean
): GameWorld {
  const connection = world.connections.get(connectionId);
  if (!connection) return world;
  
  const newConnections = new Map(world.connections);
  newConnections.set(connectionId, { ...connection, active });
  
  return {
    ...world,
    connections: newConnections,
  };
}

export function updateNodeResource(
  world: GameWorld,
  nodeId: string,
  resourceType: string,
  delta: number
): GameWorld {
  const node = world.nodes.get(nodeId);
  if (!node) return world;
  
  const resource = node.resources[resourceType];
  if (!resource) return world;
  
  let newQuantity = resource.quantity + delta;
  
  // Clamp to valid range
  newQuantity = Math.max(0, newQuantity);
  if (resource.maxCapacity >= 0) {
    newQuantity = Math.min(newQuantity, resource.maxCapacity);
  }
  
  const newResource: Resource = { ...resource, quantity: newQuantity };
  const newResources: ResourceMap = { ...node.resources, [resourceType]: newResource };
  const newNode: Node = { ...node, resources: newResources };
  
  const newNodes = new Map(world.nodes);
  newNodes.set(nodeId, newNode);
  
  return {
    ...world,
    nodes: newNodes,
  };
}

export function updateGlobalResource(
  world: GameWorld,
  resourceType: string,
  delta: number
): GameWorld {
  const resource = world.globalResources[resourceType];
  if (!resource) return world;
  
  let newQuantity = resource.quantity + delta;
  newQuantity = Math.max(0, newQuantity);
  if (resource.maxCapacity >= 0) {
    newQuantity = Math.min(newQuantity, resource.maxCapacity);
  }
  
  return {
    ...world,
    globalResources: {
      ...world.globalResources,
      [resourceType]: { ...resource, quantity: newQuantity },
    },
  };
}

// ============================================================================
// Regeneration (called each tick)
// ============================================================================

export function applyResourceRegeneration(world: GameWorld): GameWorld {
  let newWorld = world;
  
  // Regenerate node resources
  for (const [nodeId, node] of world.nodes) {
    for (const [resourceType, resource] of Object.entries(node.resources)) {
      if (resource.regenRate !== 0) {
        newWorld = updateNodeResource(newWorld, nodeId, resourceType, resource.regenRate);
      }
    }
  }
  
  // Regenerate global resources
  for (const [resourceType, resource] of Object.entries(world.globalResources)) {
    if (resource.regenRate !== 0) {
      newWorld = updateGlobalResource(newWorld, resourceType, resource.regenRate);
    }
  }
  
  return newWorld;
}
