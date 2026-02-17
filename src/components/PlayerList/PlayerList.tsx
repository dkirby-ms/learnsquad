/**
 * PlayerList - Shows online players with presence indicators
 */

import React from 'react';
import styles from './PlayerList.module.css';
import { EntityId } from '../../game/types';

export interface Player {
  id: EntityId;
  sessionId: string;
  name: string;
  color: string;
  joinedAt: number;
  isConnected: boolean;
  focusedNodeId: string;
  lastActivityTick: number;
}

interface PlayerListProps {
  players: Player[];
  currentTick: number;
  onPlayerClick?: (playerId: EntityId) => void;
}

const IDLE_THRESHOLD_TICKS = 30;

export function PlayerList({ players, currentTick, onPlayerClick }: PlayerListProps) {
  const sortedPlayers = [...players].sort((a, b) => {
    if (a.isConnected !== b.isConnected) {
      return a.isConnected ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  const isPlayerIdle = (player: Player): boolean => {
    return currentTick - player.lastActivityTick > IDLE_THRESHOLD_TICKS;
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Online Players ({players.filter(p => p.isConnected).length})</h2>
      <div className={styles.playerList}>
        {sortedPlayers.map((player) => {
          const isIdle = isPlayerIdle(player);
          return (
            <div
              key={player.id}
              className={`${styles.playerCard} ${isIdle ? styles.idle : ''} ${!player.isConnected ? styles.disconnected : ''}`}
              onClick={() => onPlayerClick?.(player.id)}
              role={onPlayerClick ? 'button' : undefined}
              tabIndex={onPlayerClick ? 0 : undefined}
            >
              <div className={styles.playerHeader}>
                <div
                  className={styles.colorIndicator}
                  style={{ backgroundColor: player.color }}
                />
                <span className={styles.playerName}>{player.name}</span>
              </div>
              {isIdle && player.isConnected && (
                <span className={styles.idleLabel}>Idle</span>
              )}
              {!player.isConnected && (
                <span className={styles.disconnectedLabel}>Offline</span>
              )}
              {player.focusedNodeId && player.isConnected && !isIdle && (
                <div className={styles.focusInfo}>
                  <span className={styles.focusIcon}>👁️</span>
                  <span className={styles.focusNode}>{player.focusedNodeId}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PlayerList;
