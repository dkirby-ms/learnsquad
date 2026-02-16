/**
 * Colyseus Module Exports
 * 
 * Main exports for the Colyseus multiplayer implementation.
 */

// Schema exports
export {
  GameState,
  NodeSchema,
  ConnectionSchema,
  ResourceSchema,
  PositionSchema,
  GameEventSchema,
  PlayerSchema,
} from './schema';

// Converter exports
export {
  gameWorldToState,
  syncWorldToState,
  nodeToSchema,
  connectionToSchema,
  resourceToSchema,
  eventToSchema,
  updateNodeInState,
} from './converters';

// Room export
export { GameRoom } from './GameRoom';
export type { GameRoomOptions, ClientMessageType } from './GameRoom';
