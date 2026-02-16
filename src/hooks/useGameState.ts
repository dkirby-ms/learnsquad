/**
 * React hooks for accessing game state from the store.
 * 
 * Uses useSyncExternalStore for efficient React 18+ integration.
 */

import { useSyncExternalStore } from 'react';
import {
  gameStateStore,
} from '../store/gameState';
import { GameWorld, GameEvent, GameSpeed, Tick } from '../game/types';

/**
 * Hook to access the full game world state.
 * Re-renders when any world state changes.
 */
export function useGameWorld(): GameWorld | null {
  return useSyncExternalStore(
    (callback) => gameStateStore.subscribe(callback),
    () => gameStateStore.getWorld()
  );
}

/**
 * Hook to access game event history.
 * Re-renders when new events arrive.
 */
export function useEventHistory(): readonly GameEvent[] {
  return useSyncExternalStore(
    (callback) => gameStateStore.subscribe(callback),
    () => gameStateStore.getEventHistory()
  );
}

/**
 * Hook to access current tick number.
 */
export function useCurrentTick(): Tick {
  return useSyncExternalStore(
    (callback) => gameStateStore.subscribe(callback),
    () => gameStateStore.getCurrentTick()
  );
}

/**
 * Hook to access pause state.
 */
export function useIsPaused(): boolean {
  return useSyncExternalStore(
    (callback) => gameStateStore.subscribe(callback),
    () => gameStateStore.isPaused()
  );
}

/**
 * Hook to access current game speed.
 */
export function useGameSpeed(): GameSpeed {
  return useSyncExternalStore(
    (callback) => gameStateStore.subscribe(callback),
    () => gameStateStore.getSpeed()
  );
}

/**
 * Composite hook for common game state values.
 */
export function useGameStatus(): {
  tick: Tick;
  isPaused: boolean;
  speed: GameSpeed;
  hasWorld: boolean;
} {
  const world = useGameWorld();
  return {
    tick: world?.currentTick ?? 0,
    isPaused: world?.isPaused ?? true,
    speed: world?.speed ?? GameSpeed.Paused,
    hasWorld: world !== null,
  };
}
