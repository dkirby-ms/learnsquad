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
} from './useGameState';
