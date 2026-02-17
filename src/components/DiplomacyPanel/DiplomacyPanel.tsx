/**
 * DiplomacyPanel - Shows all players with diplomatic status and action buttons
 */

import React, { useState, useEffect } from 'react';
import styles from './DiplomacyPanel.module.css';
import { EntityId } from '../../game/types';
import { Player, DiplomaticStatus } from '../../store/gameState';

export interface DiplomacyPanelProps {
  players: Player[];
  currentPlayerId: EntityId | null;
  getDiplomaticStatus: (playerId: EntityId) => DiplomaticStatus;
  onOfferAlliance: (playerId: EntityId) => void;
  onDeclareWar: (playerId: EntityId) => void;
  onProposePeace: (playerId: EntityId) => void;
}

interface Toast {
  id: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

let toastIdCounter = 0;

export function DiplomacyPanel({
  players,
  currentPlayerId,
  getDiplomaticStatus,
  onOfferAlliance,
  onDeclareWar,
  onProposePeace,
}: DiplomacyPanelProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: Toast['type'] = 'info') => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const otherPlayers = players.filter((p) => p.id !== currentPlayerId);

  const handleOfferAlliance = (playerId: EntityId, playerName: string) => {
    onOfferAlliance(playerId);
    addToast(`Alliance offered to ${playerName}`, 'info');
  };

  const handleDeclareWar = (playerId: EntityId, playerName: string) => {
    onDeclareWar(playerId);
    addToast(`War declared on ${playerName}`, 'warning');
  };

  const handleProposePeace = (playerId: EntityId, playerName: string) => {
    onProposePeace(playerId);
    addToast(`Peace proposed to ${playerName}`, 'info');
  };

  const canOfferAlliance = (status: DiplomaticStatus): boolean => {
    return status === 'neutral';
  };

  const canDeclareWar = (status: DiplomaticStatus): boolean => {
    return status !== 'war';
  };

  const canProposePeace = (status: DiplomaticStatus): boolean => {
    return status === 'war';
  };

  const getStatusLabel = (status: DiplomaticStatus): string => {
    switch (status) {
      case 'allied':
        return 'Allied';
      case 'war':
        return 'At War';
      case 'neutral':
      default:
        return 'Neutral';
    }
  };

  const getStatusClass = (status: DiplomaticStatus): string => {
    switch (status) {
      case 'allied':
        return styles.statusAllied;
      case 'war':
        return styles.statusWar;
      case 'neutral':
      default:
        return styles.statusNeutral;
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Diplomacy</h2>
      <div className={styles.playerList}>
        {otherPlayers.length === 0 && (
          <div className={styles.emptyState}>No other players online</div>
        )}
        {otherPlayers.map((player) => {
          const status = getDiplomaticStatus(player.id);
          return (
            <div key={player.id} className={styles.playerCard}>
              <div className={styles.playerHeader}>
                <div
                  className={styles.colorIndicator}
                  style={{ backgroundColor: player.color }}
                />
                <span className={styles.playerName}>{player.name}</span>
                <span className={`${styles.status} ${getStatusClass(status)}`}>
                  {getStatusLabel(status)}
                </span>
              </div>
              <div className={styles.actions}>
                <button
                  className={styles.actionButton}
                  onClick={() => handleOfferAlliance(player.id, player.name)}
                  disabled={!canOfferAlliance(status)}
                  title={
                    !canOfferAlliance(status)
                      ? 'Cannot ally with this player'
                      : 'Offer alliance'
                  }
                >
                  🤝 Ally
                </button>
                <button
                  className={`${styles.actionButton} ${styles.warButton}`}
                  onClick={() => handleDeclareWar(player.id, player.name)}
                  disabled={!canDeclareWar(status)}
                  title={
                    !canDeclareWar(status)
                      ? 'Already at war'
                      : 'Declare war'
                  }
                >
                  ⚔️ War
                </button>
                <button
                  className={styles.actionButton}
                  onClick={() => handleProposePeace(player.id, player.name)}
                  disabled={!canProposePeace(status)}
                  title={
                    !canProposePeace(status)
                      ? 'Not at war'
                      : 'Propose peace'
                  }
                >
                  🕊️ Peace
                </button>
              </div>
            </div>
          );
        })}
      </div>
      
      {toasts.length > 0 && (
        <div className={styles.toastContainer}>
          {toasts.map((toast) => (
            <div key={toast.id} className={`${styles.toast} ${styles[`toast${toast.type.charAt(0).toUpperCase() + toast.type.slice(1)}`]}`}>
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DiplomacyPanel;
