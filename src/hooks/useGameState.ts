/**
 * React hooks for accessing game state from the store.
 * 
 * Uses useSyncExternalStore for efficient React 18+ integration.
 */

import { useSyncExternalStore } from 'react';
import {
  gameStateStore,
} from '../store/gameState';
import type { Player, DiplomaticRelation, DiplomaticStatus } from '../store/gameState';
import { GameWorld, GameEvent, GameSpeed, Tick, EntityId } from '../game/types';

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

/**
 * Hook to access all players.
 * Re-renders when player data changes.
 */
export function usePlayers(): Player[] {
  return useSyncExternalStore(
    (callback) => gameStateStore.subscribe(callback),
    () => gameStateStore.getPlayers()
  );
}

/**
 * Hook to access a specific player by ID.
 */
export function usePlayer(playerId: EntityId | null): Player | undefined {
  return useSyncExternalStore(
    (callback) => gameStateStore.subscribe(callback),
    () => playerId ? gameStateStore.getPlayer(playerId) : undefined
  );
}

/**
 * Hook to access all diplomatic relations.
 */
export function useDiplomaticRelations(): DiplomaticRelation[] {
  return useSyncExternalStore(
    (callback) => gameStateStore.subscribe(callback),
    () => gameStateStore.getDiplomaticRelations()
  );
}

/**
 * Hook to access diplomatic status between two players.
 */
export function useDiplomaticStatus(player1Id: EntityId | null, player2Id: EntityId | null): DiplomaticStatus {
  return useSyncExternalStore(
    (callback) => gameStateStore.subscribe(callback),
    () => player1Id && player2Id ? gameStateStore.getDiplomaticStatus(player1Id, player2Id) : 'neutral'
  );
}

/**
 * Hook for diplomacy data related to a specific player.
 */
export function useDiplomacy(playerId: EntityId | null): {
  relations: DiplomaticRelation[];
  getAllies: () => EntityId[];
  getEnemies: () => EntityId[];
  getStatus: (otherPlayerId: EntityId) => DiplomaticStatus;
} {
  const allRelations = useDiplomaticRelations();
  const players = usePlayers();

  const relations = playerId 
    ? allRelations.filter((rel) => rel.player1Id === playerId || rel.player2Id === playerId)
    : [];

  const getAllies = (): EntityId[] => {
    return relations
      .filter((rel) => rel.status === 'allied')
      .map((rel) => rel.player1Id === playerId ? rel.player2Id : rel.player1Id);
  };

  const getEnemies = (): EntityId[] => {
    return relations
      .filter((rel) => rel.status === 'war')
      .map((rel) => rel.player1Id === playerId ? rel.player2Id : rel.player1Id);
  };

  const getStatus = (otherPlayerId: EntityId): DiplomaticStatus => {
    if (!playerId) return 'neutral';
    return gameStateStore.getDiplomaticStatus(playerId, otherPlayerId);
  };

  return {
    relations,
    getAllies,
    getEnemies,
    getStatus,
  };
}
