/**
 * NodeView - Display a single game node's state.
 */

import React from 'react';
import styles from './NodeView.module.css';
import { Node, NodeStatus, EntityId } from '../../game/types';
import { ResourceBar } from '../ResourceBar/index';
import { Player } from '../../store/gameState';

interface NodeViewProps {
  node: Node;
  /** Whether this node is selected */
  isSelected?: boolean;
  /** Click handler */
  onClick?: (node: Node) => void;
  /** Current player ID (to show claim/abandon buttons) */
  currentPlayerId?: EntityId;
  /** Player who owns this node */
  ownerPlayer?: Player;
  /** Claim node handler */
  onClaim?: (nodeId: EntityId) => void;
  /** Abandon node handler */
  onAbandon?: (nodeId: EntityId) => void;
  /** Show detailed controls (for selected view) */
  showControls?: boolean;
  /** Is this node owned by an allied player */
  isAlly?: boolean;
  /** Is this node owned by an enemy player */
  isEnemy?: boolean;
  /** Is this node actively being claimed by the current player */
  isBeingClaimed?: boolean;
}

const STATUS_LABELS: Record<NodeStatus, string> = {
  [NodeStatus.Neutral]: 'Neutral',
  [NodeStatus.Claimed]: 'Claimed',
  [NodeStatus.Contested]: 'Contested',
};

const STATUS_CLASSES: Record<NodeStatus, string> = {
  [NodeStatus.Neutral]: '',
  [NodeStatus.Claimed]: 'statusClaimed',
  [NodeStatus.Contested]: 'statusContested',
};

export function NodeView({
  node,
  isSelected = false,
  onClick,
  currentPlayerId,
  ownerPlayer,
  onClaim,
  onAbandon,
  showControls = false,
  isAlly = false,
  isEnemy = false,
  isBeingClaimed = false,
}: NodeViewProps) {
  const handleClick = () => {
    onClick?.(node);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.(node);
    }
  };

  const handleClaimClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClaim?.(node.id);
  };

  const handleAbandonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAbandon?.(node.id);
  };

  const isOwnedByCurrentPlayer = node.ownerId === currentPlayerId;
  const canClaim = !node.ownerId && currentPlayerId;
  const canAbandon = isOwnedByCurrentPlayer;

  // Calculate border color based on owner
  const borderColor = ownerPlayer?.color || undefined;
  const borderStyle = node.ownerId && borderColor
    ? { borderLeftColor: borderColor, borderLeftWidth: '3px', borderLeftStyle: 'solid' as const }
    : {};

  return (
    <div
      className={`${styles.container} ${isSelected ? styles.selected : ''} ${isAlly ? styles.allyNode : ''} ${isEnemy ? styles.enemyNode : ''} ${styles[STATUS_CLASSES[node.status]] || ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={borderStyle}
    >
      <div className={styles.header}>
        <h3 className={styles.name}>{node.name}</h3>
        <span className={`${styles.status} ${styles[STATUS_CLASSES[node.status]] || ''}`}>
          {STATUS_LABELS[node.status]}
        </span>
        {isAlly && (
          <span className={styles.allyBadge} title="Allied player">🤝</span>
        )}
        {isEnemy && (
          <span className={styles.enemyBadge} title="At war">⚔️</span>
        )}
      </div>

      {node.ownerId && ownerPlayer && (
        <div className={styles.owner}>
          <span className={styles.ownerLabel}>Owner:</span>
          <span className={styles.ownerValue} style={{ color: ownerPlayer.color }}>
            {ownerPlayer.name}
          </span>
        </div>
      )}

      {/* Show claim progress when there's any control points, contested, or actively being claimed */}
      {(node.controlPoints !== undefined && node.controlPoints > 0) || node.status === NodeStatus.Contested || isBeingClaimed ? (
        <div className={styles.claimProgress}>
          <div className={styles.progressLabel}>
            {isBeingClaimed && (node.controlPoints ?? 0) === 0 
              ? '⏳ Claiming... (resume game to progress)' 
              : `Control: ${node.controlPoints ?? 0} / ${node.maxControlPoints ?? 100}`
            }
          </div>
          <div className={styles.progressBar}>
            <div 
              className={`${styles.progressFill} ${isBeingClaimed ? styles.pulsing : ''}`}
              style={{ 
                width: isBeingClaimed && (node.controlPoints ?? 0) === 0
                  ? '5%' 
                  : `${Math.min(100, ((node.controlPoints ?? 0) / (node.maxControlPoints ?? 100)) * 100)}%` 
              }}
            />
          </div>
        </div>
      ) : null}

      {node.resources.length > 0 && (
        <div className={styles.resources}>
          {node.resources.map((resource) => (
            <ResourceBar
              key={resource.type}
              resource={resource}
              compact={!isAlly && node.ownerId !== currentPlayerId}
            />
          ))}
        </div>
      )}

      {showControls && (
        <div className={styles.controls}>
          {canClaim && (
            <button 
              className={styles.claimButton}
              onClick={handleClaimClick}
            >
              Claim Node
            </button>
          )}
          {canAbandon && (
            <button 
              className={styles.abandonButton}
              onClick={handleAbandonClick}
            >
              Abandon Node
            </button>
          )}
        </div>
      )}

      <div className={styles.footer}>
        <span className={styles.connections}>
          {node.connectionIds.length} connection{node.connectionIds.length !== 1 ? 's' : ''}
        </span>
        <span className={styles.position}>
          ({node.position.x}, {node.position.y})
        </span>
      </div>
    </div>
  );
}

export default NodeView;
