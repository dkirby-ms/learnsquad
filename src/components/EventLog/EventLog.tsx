/**
 * EventLog - Display recent game events.
 */

import React from 'react';
import styles from './EventLog.module.css';
import { GameEvent, GameEventType } from '../../game/types';
import { useEventHistory } from '../../hooks/useGameState';

interface EventLogProps {
  /** Maximum number of events to display */
  maxEvents?: number;
  /** Whether the log is collapsed */
  collapsed?: boolean;
  /** Toggle collapse handler */
  onToggleCollapse?: () => void;
}

const EVENT_ICONS: Partial<Record<GameEventType, string>> = {
  [GameEventType.ResourceDepleted]: '⚠️',
  [GameEventType.ResourceCapReached]: '📈',
  [GameEventType.ResourceProduced]: '⚡',
  [GameEventType.NodeClaimed]: '🏴',
  [GameEventType.NodeDiscovered]: '🔍',
  [GameEventType.ConnectionEstablished]: '🔗',
  [GameEventType.ConnectionSevered]: '✂️',
  [GameEventType.GatewayActivated]: '🚀',
  [GameEventType.GatewayReady]: '✨',
  [GameEventType.GatewayCooldownExpired]: '⏰',
  [GameEventType.TickProcessed]: '⏱️',
};

const EVENT_LABELS: Partial<Record<GameEventType, string>> = {
  [GameEventType.ResourceDepleted]: 'Resource Depleted',
  [GameEventType.ResourceCapReached]: 'Resource Cap Reached',
  [GameEventType.ResourceProduced]: 'Resource Produced',
  [GameEventType.NodeClaimed]: 'Node Claimed',
  [GameEventType.NodeDiscovered]: 'Node Discovered',
  [GameEventType.ConnectionEstablished]: 'Connection Established',
  [GameEventType.ConnectionSevered]: 'Connection Severed',
  [GameEventType.GatewayActivated]: 'Gateway Activated',
  [GameEventType.GatewayReady]: 'Gateway Ready',
  [GameEventType.GatewayCooldownExpired]: 'Gateway Cooldown Expired',
  [GameEventType.TickProcessed]: 'Tick Processed',
};

function formatEventData(data: Record<string, unknown>): string {
  const entries = Object.entries(data)
    .filter(([key]) => key !== 'tick' && key !== 'entityId')
    .map(([key, value]) => {
      if (typeof value === 'number') {
        return `${key}: ${value.toFixed(2)}`;
      }
      return `${key}: ${value}`;
    });
  return entries.join(', ');
}

function EventItem({ event }: { event: GameEvent }) {
  const icon = EVENT_ICONS[event.type] || '📌';
  const label = EVENT_LABELS[event.type] || event.type;
  const dataStr = formatEventData(event.data as Record<string, unknown>);

  return (
    <div className={styles.event}>
      <span className={styles.eventIcon}>{icon}</span>
      <div className={styles.eventContent}>
        <div className={styles.eventHeader}>
          <span className={styles.eventLabel}>{label}</span>
          <span className={styles.eventTick}>T{event.tick}</span>
        </div>
        {dataStr && (
          <div className={styles.eventData}>{dataStr}</div>
        )}
      </div>
    </div>
  );
}

export function EventLog({
  maxEvents = 20,
  collapsed = false,
  onToggleCollapse,
}: EventLogProps) {
  const events = useEventHistory();
  const displayEvents = events.slice(0, maxEvents);

  return (
    <div className={styles.container}>
      <div
        className={styles.header}
        onClick={onToggleCollapse}
        role={onToggleCollapse ? 'button' : undefined}
        tabIndex={onToggleCollapse ? 0 : undefined}
      >
        <h3 className={styles.title}>Event Log</h3>
        <span className={styles.count}>{events.length}</span>
        {onToggleCollapse && (
          <span className={`${styles.collapseIcon} ${collapsed ? styles.collapsed : ''}`}>
            ▼
          </span>
        )}
      </div>

      {!collapsed && (
        <div className={styles.eventList}>
          {displayEvents.length === 0 ? (
            <div className={styles.empty}>No events yet</div>
          ) : (
            displayEvents.map((event, index) => (
              <EventItem key={`${event.tick}-${event.entityId}-${index}`} event={event} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default EventLog;
