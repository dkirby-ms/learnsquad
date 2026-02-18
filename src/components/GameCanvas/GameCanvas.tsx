/**
 * GameCanvas - React component that bridges to PixiJS rendering.
 * 
 * This component creates and manages a PixiJS Application instance,
 * syncing React state to the SceneManager for rendering.
 * 
 * Design:
 * - Single source of truth: Props flow from React (Colyseus state) to PixiJS
 * - Interaction callbacks flow from PixiJS to React
 * - Canvas lifecycle tied to React component lifecycle
 */

import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { SceneManager } from './SceneManager';
import { GameWorld, EntityId } from '../../game/types';
import type { Player } from '../../store/gameState';
import styles from './GameCanvas.module.css';

interface GameCanvasProps {
  /** Current game world state */
  world: GameWorld | null;
  /** All players in the game */
  players: Player[];
  /** Currently selected node ID */
  selectedNodeId: EntityId | null;
  /** Callback when a node is clicked */
  onNodeClick?: (nodeId: EntityId) => void;
}

export function GameCanvas({
  world,
  players,
  selectedNodeId,
  onNodeClick,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const sceneManagerRef = useRef<SceneManager | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize PixiJS Application
  useEffect(() => {
    if (!canvasRef.current || appRef.current) return;

    const initPixi = async () => {
      const app = new PIXI.Application();
      
      // Get dimensions with fallback
      const width = canvasRef.current!.clientWidth || 800;
      const height = canvasRef.current!.clientHeight || 600;
      
      console.log('[GameCanvas] Initializing with dimensions:', width, height);
      
      // Initialize the application (required in PixiJS v8)
      await app.init({
        width,
        height,
        backgroundColor: 0x0a0e17,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      canvasRef.current!.appendChild(app.canvas);
      appRef.current = app;

      // Create scene manager
      const sceneManager = new SceneManager(app, {
        onNodeClick: (nodeId) => {
          onNodeClick?.(nodeId);
        },
      });
      sceneManagerRef.current = sceneManager;

      setIsInitialized(true);
    };

    initPixi();

    return () => {
      // Cleanup on unmount
      if (sceneManagerRef.current) {
        sceneManagerRef.current.destroy();
        sceneManagerRef.current = null;
      }
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, [onNodeClick]);

  // Handle window resize
  useEffect(() => {
    if (!appRef.current || !sceneManagerRef.current) return;

    const handleResize = () => {
      if (!canvasRef.current || !sceneManagerRef.current) return;
      
      const width = canvasRef.current.clientWidth;
      const height = canvasRef.current.clientHeight;
      
      sceneManagerRef.current.resize(width, height);
    };

    window.addEventListener('resize', handleResize);
    
    // Initial resize
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isInitialized]);

  const hasFittedRef = useRef(false);

  // Sync world state to SceneManager
  useEffect(() => {
    if (!sceneManagerRef.current || !isInitialized) return;

    // Convert players array to Map for SceneManager
    const playersMap = new Map(players.map(p => [p.id, p]));

    sceneManagerRef.current.updateWorld(world, playersMap);

    // Fit to content on first load
    if (world && Object.keys(world.nodes).length > 0 && !hasFittedRef.current) {
      sceneManagerRef.current.fitToContent();
      hasFittedRef.current = true;
    }
  }, [world, players, isInitialized]);

  // Sync selected node to SceneManager
  useEffect(() => {
    if (!sceneManagerRef.current || !isInitialized) return;

    sceneManagerRef.current.setSelectedNode(selectedNodeId);
  }, [selectedNodeId, isInitialized]);

  return (
    <div ref={canvasRef} className={styles.container}>
      {!isInitialized && (
        <div className={styles.loading}>
          <span>Loading canvas...</span>
        </div>
      )}
    </div>
  );
}
