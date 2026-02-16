/**
 * GameWorld - Main game view container.
 * 
 * This component orchestrates the game UI, combining:
 * - PixiJS canvas for game rendering (placeholder for now)
 * - React components for UI chrome (controls, event log, node info)
 * 
 * The PixiJS integration will be added when we implement the actual
 * game rendering layer.
 */

import React, { useState, useMemo } from 'react';
import styles from './GameWorld.module.css';
import { useGameSocket, ConnectionStatus } from '../../hooks/index';
import { useGameWorld } from '../../hooks/useGameState';
import { GameControls } from '../GameControls/index';
import { NodeView } from '../NodeView/index';
import { EventLog } from '../EventLog/index';
import { Node, EntityId } from '../../game/types';

interface GameWorldProps {
  /** Game ID to join */
  gameId?: string;
  /** WebSocket server URL (optional, defaults to current host) */
  wsUrl?: string;
}

export function GameWorld({ gameId, wsUrl }: GameWorldProps) {
  const {
    status,
    error,
    connect,
    disconnect,
    pause,
    resume,
    setSpeed,
  } = useGameSocket({ url: wsUrl, gameId });

  const world = useGameWorld();
  const [selectedNodeId, setSelectedNodeId] = useState<EntityId | null>(null);
  const [eventLogCollapsed, setEventLogCollapsed] = useState(false);

  // Convert nodes record to sorted array for display
  const nodeList = useMemo(() => {
    if (!world) return [];
    return Object.values(world.nodes).sort((a, b) => a.name.localeCompare(b.name));
  }, [world?.nodes]);

  const selectedNode = selectedNodeId && world?.nodes[selectedNodeId];

  const handleNodeClick = (node: Node) => {
    setSelectedNodeId(node.id === selectedNodeId ? null : node.id);
  };

  return (
    <div className={styles.container}>
      {/* Left Sidebar - Controls & Info */}
      <aside className={styles.sidebar}>
        <GameControls
          connectionStatus={status}
          connectionError={error}
          onConnect={connect}
          onDisconnect={disconnect}
          onPause={pause}
          onResume={resume}
          onSetSpeed={setSpeed}
        />

        {/* Selected Node Details */}
        {selectedNode && (
          <div className={styles.selectedNode}>
            <h2 className={styles.sectionTitle}>Selected Node</h2>
            <NodeView node={selectedNode} isSelected />
          </div>
        )}
      </aside>

      {/* Main Canvas Area */}
      <main className={styles.main}>
        {status === ConnectionStatus.Connected && world ? (
          <>
            {/* Placeholder for PixiJS canvas */}
            <div className={styles.canvas}>
              <div className={styles.canvasPlaceholder}>
                <div className={styles.placeholderContent}>
                  <span className={styles.placeholderIcon}>🎮</span>
                  <p>Game Canvas</p>
                  <p className={styles.placeholderSubtext}>
                    PixiJS rendering will be added here
                  </p>
                </div>
              </div>
            </div>

            {/* Node Grid (temporary - will be replaced by canvas) */}
            <div className={styles.nodeGrid}>
              <h2 className={styles.sectionTitle}>
                Nodes ({nodeList.length})
              </h2>
              <div className={styles.nodes}>
                {nodeList.map((node) => (
                  <NodeView
                    key={node.id}
                    node={node}
                    isSelected={node.id === selectedNodeId}
                    onClick={handleNodeClick}
                  />
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className={styles.emptyState}>
            {status === ConnectionStatus.Disconnected && (
              <>
                <span className={styles.emptyIcon}>🌌</span>
                <p>Connect to start playing</p>
              </>
            )}
            {(status === ConnectionStatus.Connecting ||
              status === ConnectionStatus.Reconnecting) && (
              <>
                <span className={styles.emptyIcon}>⏳</span>
                <p>Connecting to game server...</p>
              </>
            )}
            {status === ConnectionStatus.Error && (
              <>
                <span className={styles.emptyIcon}>⚠️</span>
                <p>Connection failed</p>
                {error && <p className={styles.errorText}>{error}</p>}
              </>
            )}
          </div>
        )}
      </main>

      {/* Right Sidebar - Event Log */}
      <aside className={styles.rightSidebar}>
        <EventLog
          maxEvents={30}
          collapsed={eventLogCollapsed}
          onToggleCollapse={() => setEventLogCollapsed(!eventLogCollapsed)}
        />
      </aside>
    </div>
  );
}

export default GameWorld;
