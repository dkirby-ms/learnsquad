/**
 * Converters between GameWorld (plain objects) and Colyseus Schema
 * 
 * These converters bridge Miller's game engine output to Colyseus state.
 */

import { ArraySchema, MapSchema } from '@colyseus/schema';
import type { GameWorld, Node, Connection, Resource, GameEvent } from '../shared/game-types';
import {
  GameState,
  NodeSchema,
  ConnectionSchema,
  ResourceSchema,
  PositionSchema,
  GameEventSchema,
} from './schema';

/**
 * Convert a plain Resource object to ResourceSchema
 */
export function resourceToSchema(resource: Resource): ResourceSchema {
  const schema = new ResourceSchema();
  schema.type = resource.type;
  schema.amount = resource.amount;
  schema.regenRate = resource.regenRate;
  schema.maxCapacity = resource.maxCapacity;
  return schema;
}

/**
 * Convert a plain Node object to NodeSchema
 */
export function nodeToSchema(node: Node): NodeSchema {
  const schema = new NodeSchema();
  schema.id = node.id;
  schema.name = node.name;
  schema.position = new PositionSchema();
  schema.position.x = node.position.x;
  schema.position.y = node.position.y;
  schema.status = node.status;
  schema.ownerId = node.ownerId ?? '';
  
  schema.resources = new ArraySchema<ResourceSchema>();
  for (const resource of node.resources) {
    schema.resources.push(resourceToSchema(resource));
  }
  
  schema.connectionIds = new ArraySchema<string>();
  for (const connId of node.connectionIds) {
    schema.connectionIds.push(connId);
  }
  
  return schema;
}

/**
 * Convert a plain Connection object to ConnectionSchema
 */
export function connectionToSchema(connection: Connection): ConnectionSchema {
  const schema = new ConnectionSchema();
  schema.id = connection.id;
  schema.fromNodeId = connection.fromNodeId;
  schema.toNodeId = connection.toNodeId;
  schema.type = connection.type;
  schema.travelTime = connection.travelTime;
  schema.isActive = connection.isActive;
  return schema;
}

/**
 * Convert a plain GameEvent to GameEventSchema
 */
export function eventToSchema(event: GameEvent): GameEventSchema {
  const schema = new GameEventSchema();
  schema.type = event.type;
  schema.tick = event.tick;
  schema.entityId = event.entityId;
  schema.data = JSON.stringify(event.data);
  return schema;
}

/**
 * Initialize GameState from a GameWorld
 */
export function gameWorldToState(world: GameWorld, state: GameState): void {
  state.id = world.id;
  state.currentTick = world.currentTick;
  state.speed = world.speed;
  state.isPaused = world.isPaused;
  state.serverTime = Date.now();
  
  // Clear and repopulate nodes
  state.nodes.clear();
  for (const [nodeId, node] of Object.entries(world.nodes)) {
    state.nodes.set(nodeId, nodeToSchema(node));
  }
  
  // Clear and repopulate connections
  state.connections.clear();
  for (const [connId, connection] of Object.entries(world.connections)) {
    state.connections.set(connId, connectionToSchema(connection));
  }
}

/**
 * Update GameState from a GameWorld after a tick
 * Only updates changed nodes for efficiency
 */
export function syncWorldToState(
  world: GameWorld,
  state: GameState,
  changedNodeIds: readonly string[] = []
): void {
  state.currentTick = world.currentTick;
  state.speed = world.speed;
  state.isPaused = world.isPaused;
  state.serverTime = Date.now();
  
  // Update only changed nodes
  for (const nodeId of changedNodeIds) {
    const node = world.nodes[nodeId];
    if (node) {
      state.nodes.set(nodeId, nodeToSchema(node));
    } else {
      state.nodes.delete(nodeId);
    }
  }
  
  // Clear and add recent events
  state.recentEvents.clear();
  for (const event of world.eventQueue) {
    state.recentEvents.push(eventToSchema(event));
  }
}

/**
 * Update a single node in the state
 */
export function updateNodeInState(state: GameState, node: Node): void {
  state.nodes.set(node.id, nodeToSchema(node));
}
