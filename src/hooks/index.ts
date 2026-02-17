/**
 * Hook exports
 */

export { useGameSocket, ConnectionStatus } from './useGameSocket';
export type { GameSocketConfig, GameSocketReturn } from './useGameSocket';

export {
  useGameWorld,
  useEventHistory,
  useCurrentTick,
  useIsPaused,
  useGameSpeed,
  useGameStatus,
  usePlayers,
  usePlayer,
  useDiplomaticRelations,
  useDiplomaticStatus,
  useDiplomacy,
} from './useGameState';
export type { Player, DiplomaticStatus, DiplomaticRelation } from '../store/gameState';
