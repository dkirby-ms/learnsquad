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
import { useGameWorld, usePlayers, usePlayer, useDiplomacy, useCurrentPlayer } from '../../hooks/useGameState';
import { GameControls } from '../GameControls/index';
import { NodeView } from '../NodeView/index';
import { RightNav } from '../RightNav/index';
import { PlayerList } from '../PlayerList/index';
import { DiplomacyPanel } from '../DiplomacyPanel/index';
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
    updateFocus,
    claimNode,
    abandonNode,
    offerAlliance,
    declareWar,
    proposePeace,
    activeClaimNodeId,
    sendChatMessage,
  } = useGameSocket({ url: wsUrl, gameId });

  const world = useGameWorld();
  const players = usePlayers();
  const currentPlayer = useCurrentPlayer();
  const [selectedNodeId, setSelectedNodeId] = useState<EntityId | null>(null);

  // Use the current player's ID from the session
  const currentPlayerId = currentPlayer?.id;
  const { getStatus: getDiplomaticStatus, getAllies, getEnemies } = useDiplomacy(currentPlayerId ?? null);

  // Debug: log world state on change
  console.log('[GameWorld] world:', world);
  console.log('[GameWorld] world?.nodes:', world?.nodes);

  // Convert nodes record to sorted array for display
  const nodeList = useMemo(() => {
    if (!world || !world.nodes) return [];
    // Filter out any undefined nodes that may occur during sync
    return Object.values(world.nodes)
      .filter((node): node is Node => node !== undefined && node !== null && typeof node.name === 'string')
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [world?.nodes]);

  const allies = getAllies();
  const enemies = getEnemies();

  // Pre-fetch all node owners
  const nodeOwners = useMemo(() => {
    const owners: Record<EntityId, ReturnType<typeof usePlayer>> = {};
    if (!world) return owners;
    
    nodeList.forEach(node => {
      if (node.ownerId) {
        const owner = players.find(p => p.id === node.ownerId);
        if (owner) owners[node.id] = owner;
      }
    });
    
    return owners;
  }, [nodeList, players, world]);

  const selectedNode = selectedNodeId && world?.nodes[selectedNodeId];
  const selectedNodeOwner = selectedNode && typeof selectedNode !== 'string' && selectedNode.ownerId 
    ? players.find(p => p.id === selectedNode.ownerId)
    : undefined;

  const handleNodeClick = (node: Node) => {
    const newSelectedId = node.id === selectedNodeId ? null : node.id;
    setSelectedNodeId(newSelectedId);
    
    // Send focus update to server
    if (newSelectedId) {
      updateFocus(newSelectedId);
    }
  };

  const handleNodeHover = (nodeId: EntityId) => {
    // Send focus update on hover as well
    updateFocus(nodeId);
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

        {/* Player List */}
        {status === ConnectionStatus.Connected && players.length > 0 && (
          <div className={styles.playerListContainer}>
            <PlayerList 
              players={players} 
              currentTick={world?.currentTick ?? 0}
            />
          </div>
        )}

        {/* Diplomacy Panel */}
        {status === ConnectionStatus.Connected && players.length > 1 && (
          <div className={styles.diplomacyContainer}>
            <DiplomacyPanel
              players={players}
              currentPlayerId={currentPlayerId ?? null}
              getDiplomaticStatus={getDiplomaticStatus}
              onOfferAlliance={offerAlliance}
              onDeclareWar={declareWar}
              onProposePeace={proposePeace}
            />
          </div>
        )}

        {/* Selected Node Details */}
        {selectedNode && (
          <div className={styles.selectedNode}>
            <h2 className={styles.sectionTitle}>Selected Node</h2>
            <NodeView 
              node={selectedNode} 
              isSelected 
              currentPlayerId={currentPlayerId}
              ownerPlayer={selectedNodeOwner}
              onClaim={claimNode}
              onAbandon={abandonNode}
              showControls
              isBeingClaimed={activeClaimNodeId === selectedNode.id}
            />
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
                {nodeList.map((node) => {
                  const isAllyNode = !!(node.ownerId && allies.includes(node.ownerId));
                  const isEnemyNode = !!(node.ownerId && enemies.includes(node.ownerId));
                  return (
                    <NodeView
                      key={node.id}
                      node={node}
                      isSelected={node.id === selectedNodeId}
                      onClick={handleNodeClick}
                      currentPlayerId={currentPlayerId}
                      ownerPlayer={nodeOwners[node.id]}
                      isAlly={isAllyNode}
                      isEnemy={isEnemyNode}
                      isBeingClaimed={activeClaimNodeId === node.id}
                    />
                  );
                })}
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

      {/* Right Sidebar - RightNav (Events + Chat) */}
      <aside className={styles.rightSidebar}>
        <RightNav onSendMessage={sendChatMessage} />
      </aside>
    </div>
  );
}

export default GameWorld;
