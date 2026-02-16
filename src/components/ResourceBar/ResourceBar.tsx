/**
 * ResourceBar - Visual representation of a resource amount and capacity.
 */

import React from 'react';
import styles from './ResourceBar.module.css';
import { Resource, ResourceType } from '../../game/types';

interface ResourceBarProps {
  resource: Resource;
  /** Whether to show the regen rate */
  showRegen?: boolean;
  /** Compact mode for smaller displays */
  compact?: boolean;
}

const RESOURCE_COLORS: Record<ResourceType, string> = {
  [ResourceType.Minerals]: '#94a3b8',
  [ResourceType.Energy]: '#fbbf24',
  [ResourceType.Alloys]: '#f97316',
  [ResourceType.Research]: '#8b5cf6',
};

const RESOURCE_ICONS: Record<ResourceType, string> = {
  [ResourceType.Minerals]: '⬡',
  [ResourceType.Energy]: '⚡',
  [ResourceType.Alloys]: '⚙',
  [ResourceType.Research]: '🔬',
};

function formatNumber(n: number): string {
  if (n >= 1000000) {
    return `${(n / 1000000).toFixed(1)}M`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}K`;
  }
  return n.toFixed(0);
}

function formatRegen(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}/t`;
}

export function ResourceBar({ resource, showRegen = true, compact = false }: ResourceBarProps) {
  const percentage = resource.maxCapacity > 0
    ? Math.min(100, (resource.amount / resource.maxCapacity) * 100)
    : 0;
  
  const color = RESOURCE_COLORS[resource.type];
  const icon = RESOURCE_ICONS[resource.type];
  const isFull = resource.amount >= resource.maxCapacity;
  const isEmpty = resource.amount <= 0;

  return (
    <div className={`${styles.container} ${compact ? styles.compact : ''}`}>
      <div className={styles.header}>
        <span className={styles.icon} style={{ color }}>{icon}</span>
        <span className={styles.label}>{resource.type}</span>
        {showRegen && resource.regenRate !== 0 && (
          <span
            className={`${styles.regen} ${resource.regenRate > 0 ? styles.regenPositive : styles.regenNegative}`}
          >
            {formatRegen(resource.regenRate)}
          </span>
        )}
      </div>
      <div className={styles.barContainer}>
        <div
          className={`${styles.bar} ${isFull ? styles.barFull : ''} ${isEmpty ? styles.barEmpty : ''}`}
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
        <div className={styles.barText}>
          {formatNumber(resource.amount)} / {formatNumber(resource.maxCapacity)}
        </div>
      </div>
    </div>
  );
}

export default ResourceBar;
