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
  const [sceneManager, setSceneManager] = useState<SceneManager | null>(null);

  // Initialize PixiJS Application
  useEffect(() => {
    if (!canvasRef.current || appRef.current) return;

    let isMounted = true;

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

      // Check if still mounted after async
      if (!isMounted || !canvasRef.current) return;

      canvasRef.current.appendChild(app.canvas);
      appRef.current = app;

      // Create scene manager
      const newSceneManager = new SceneManager(app, {
        onNodeClick: (nodeId) => {
          onNodeClick?.(nodeId);
        },
      });

      // Use state instead of ref so React properly tracks it
      setSceneManager(newSceneManager);
    };

    initPixi();

    return () => {
      isMounted = false;
      // Cleanup handled in separate effect
    };
  }, [onNodeClick]);

  // Cleanup sceneManager on unmount or when it changes
  useEffect(() => {
    return () => {
      if (sceneManager) {
        sceneManager.destroy();
      }
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, [sceneManager]);

  // Handle window resize
  useEffect(() => {
    if (!appRef.current || !sceneManager) return;

    const handleResize = () => {
      if (!canvasRef.current || !sceneManager) return;
      
      const width = canvasRef.current.clientWidth;
      const height = canvasRef.current.clientHeight;
      
      sceneManager.resize(width, height);
    };

    window.addEventListener('resize', handleResize);
    
    // Initial resize
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [sceneManager]);

  const hasFittedRef = useRef(false);

  // Sync world state to SceneManager
  useEffect(() => {
    console.log('[GameCanvas] Sync effect running:', { 
      hasSceneManager: !!sceneManager, 
      hasWorld: !!world,
      nodeCount: world ? Object.keys(world.nodes).length : 0
    });
    
    if (!sceneManager) {
      console.log('[GameCanvas] Sync effect early return - sceneManager not ready');
      return;
    }

    // Convert players array to Map for SceneManager
    const playersMap = new Map(players.map(p => [p.id, p]));

    console.log('[GameCanvas] Calling updateWorld with', Object.keys(world?.nodes || {}).length, 'nodes');
    sceneManager.updateWorld(world, playersMap);

    // Fit to content on first load
    if (world && Object.keys(world.nodes).length > 0 && !hasFittedRef.current) {
      sceneManager.fitToContent();
      hasFittedRef.current = true;
    }
  }, [world, players, sceneManager]);

  // Sync selected node to SceneManager
  useEffect(() => {
    if (!sceneManager) return;

    sceneManager.setSelectedNode(selectedNodeId);
  }, [selectedNodeId, sceneManager]);

  return (
    <div ref={canvasRef} className={styles.container}>
      {!sceneManager && (
        <div className={styles.loading}>
          <span>Loading canvas...</span>
        </div>
      )}
    </div>
  );
}
