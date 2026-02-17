// Polyfill Symbol.metadata for @colyseus/schema v4 (TC39 Stage 3 feature not yet in Node.js)
// Must be before any @colyseus/schema imports
// @ts-expect-error - Symbol.metadata may not exist in type definitions yet
Symbol.metadata ??= Symbol('Symbol.metadata');

/**
 * Colyseus State Schema
 * 
 * Maps game types to Colyseus schema for automatic state synchronization.
 * Uses @colyseus/schema decorators for efficient delta encoding.
 */

import { Schema, type, MapSchema, ArraySchema } from '@colyseus/schema';
import {
  GameSpeed,
  ResourceType,
  ConnectionType,
  NodeStatus,
  GameEventType,
} from '../shared/game-types';

/**
 * Resource schema - mirrors shared/game-types.ts Resource
 */
export class ResourceSchema extends Schema {
  @type('string') type: string = ResourceType.Minerals;
  @type('number') amount: number = 0;
  @type('number') regenRate: number = 0;
  @type('number') maxCapacity: number = 100;
}

/**
 * Position schema for node coordinates
 */
export class PositionSchema extends Schema {
  @type('number') x: number = 0;
  @type('number') y: number = 0;
}

/**
 * Node schema - mirrors shared/game-types.ts Node
 */
export class NodeSchema extends Schema {
  @type('string') id: string = '';
  @type('string') name: string = '';
  @type(PositionSchema) position: PositionSchema = new PositionSchema();
  @type('string') status: string = NodeStatus.Neutral;
  @type('string') ownerId: string = '';  // Empty string = unclaimed
  @type([ResourceSchema]) resources = new ArraySchema<ResourceSchema>();
  @type(['string']) connectionIds = new ArraySchema<string>();
  @type('number') controlPoints: number = 0;
  @type('number') maxControlPoints: number = 100;
}

/**
 * Connection schema - mirrors shared/game-types.ts Connection
 */
export class ConnectionSchema extends Schema {
  @type('string') id: string = '';
  @type('string') fromNodeId: string = '';
  @type('string') toNodeId: string = '';
  @type('string') type: string = ConnectionType.Direct;
  @type('number') travelTime: number = 1;
  @type('boolean') isActive: boolean = true;
}

/**
 * Game event schema - mirrors shared/game-types.ts GameEvent
 */
export class GameEventSchema extends Schema {
  @type('string') type: string = GameEventType.TickProcessed;
  @type('number') tick: number = 0;
  @type('string') entityId: string = '';
  // data is serialized as JSON string for flexibility
  @type('string') data: string = '{}';
}

/**
 * Player schema for connected clients
 */
export class PlayerSchema extends Schema {
  @type('string') id: string = '';
  @type('string') sessionId: string = '';
  @type('string') name: string = '';
  @type('string') color: string = '#FFFFFF';
  @type('number') joinedAt: number = 0;
  @type('boolean') isConnected: boolean = true;
  @type('string') focusedNodeId: string = '';
  @type('number') lastActivityTick: number = 0;
}

/**
 * Diplomacy schema - tracks relationships between two players
 */
export class DiplomacySchema extends Schema {
  @type('string') id: string = '';              // "{playerId1}-{playerId2}" (sorted)
  @type('string') player1Id: string = '';
  @type('string') player2Id: string = '';
  @type('string') status: string = 'neutral';   // neutral/allied/war
  @type('number') establishedTick: number = 0;
}

/**
 * Main game state schema - mirrors shared/game-types.ts GameWorld
 * 
 * Colyseus will automatically detect changes and send delta updates.
 */
export class GameState extends Schema {
  @type('string') id: string = '';
  @type('number') currentTick: number = 0;
  @type('number') speed: number = GameSpeed.Normal;
  @type('boolean') isPaused: boolean = false;
  @type('number') serverTime: number = Date.now();

  // Entity collections using MapSchema for efficient key-based access
  @type({ map: NodeSchema }) nodes = new MapSchema<NodeSchema>();
  @type({ map: ConnectionSchema }) connections = new MapSchema<ConnectionSchema>();
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type({ map: DiplomacySchema }) diplomacy = new MapSchema<DiplomacySchema>();
  
  // Recent events (cleared each tick, kept small)
  @type([GameEventSchema]) recentEvents = new ArraySchema<GameEventSchema>();
}
