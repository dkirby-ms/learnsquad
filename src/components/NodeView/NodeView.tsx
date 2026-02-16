/**
 * NodeView - Display a single game node's state.
 */

import React from 'react';
import styles from './NodeView.module.css';
import { Node, NodeStatus } from '../../game/types';
import { ResourceBar } from '../ResourceBar/index';

interface NodeViewProps {
  node: Node;
  /** Whether this node is selected */
  isSelected?: boolean;
  /** Click handler */
  onClick?: (node: Node) => void;
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

export function NodeView({ node, isSelected = false, onClick }: NodeViewProps) {
  const handleClick = () => {
    onClick?.(node);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.(node);
    }
  };

  return (
    <div
      className={`${styles.container} ${isSelected ? styles.selected : ''} ${styles[STATUS_CLASSES[node.status]] || ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className={styles.header}>
        <h3 className={styles.name}>{node.name}</h3>
        <span className={`${styles.status} ${styles[STATUS_CLASSES[node.status]] || ''}`}>
          {STATUS_LABELS[node.status]}
        </span>
      </div>

      {node.ownerId && (
        <div className={styles.owner}>
          <span className={styles.ownerLabel}>Owner:</span>
          <span className={styles.ownerValue}>{node.ownerId}</span>
        </div>
      )}

      {node.resources.length > 0 && (
        <div className={styles.resources}>
          {node.resources.map((resource) => (
            <ResourceBar
              key={resource.type}
              resource={resource}
              compact
            />
          ))}
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
