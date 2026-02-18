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
  
  // Use ref for callback to avoid re-initializing on every render
  const onNodeClickRef = useRef(onNodeClick);
  onNodeClickRef.current = onNodeClick;

  // Initialize PixiJS Application - runs only once
  useEffect(() => {
    if (!canvasRef.current || appRef.current) return;

    let isMounted = true;

    const initPixi = async () => {
      const app = new PIXI.Application();
      
      // Get dimensions with fallback
      const width = canvasRef.current!.clientWidth || 800;
      const height = canvasRef.current!.clientHeight || 600;
      
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

      // Create scene manager - use ref for callback so it always has latest
      const newSceneManager = new SceneManager(app, {
        onNodeClick: (nodeId) => {
          onNodeClickRef.current?.(nodeId);
        },
      });

      // Use state instead of ref so React properly tracks it
      setSceneManager(newSceneManager);
    };

    initPixi();

    return () => {
      isMounted = false;
    };
  }, []); // Empty deps - only run once

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, []);

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
    if (!sceneManager) {
      return;
    }

    // Convert players array to Map for SceneManager
    const playersMap = new Map(players.map(p => [p.id, p]));

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
