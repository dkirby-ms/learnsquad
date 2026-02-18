/**
 * SceneManager - Manages PixiJS rendering for the game world.
 * 
 * This class encapsulates all PixiJS rendering logic, handling:
 * - Scene graph organization (layered containers)
 * - Sprite registry for incremental updates
 * - Node and connection rendering
 * - Click interactions and callbacks
 * 
 * Design: Uses sprite reuse via registry to avoid full redraws.
 * Only changed entities trigger visual updates.
 */

import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { GameWorld, Node, Connection, EntityId } from '../../game/types';
import type { Player } from '../../store/gameState';

/** Color palette for rendering */
const COLORS = {
  background: 0x0a0e17,
  neutralNode: 0x6b7280,
  connection: 0x374151,
  selectedRing: 0x3b82f6,
  allyGlow: 0x10b981,
  enemyGlow: 0xef4444,
};

/** Node rendering configuration */
const NODE_RADIUS = 20;
const NODE_SELECTION_RING_WIDTH = 3;
const LABEL_OFFSET_Y = 30;

/** Connection rendering configuration */
const CONNECTION_WIDTH = 2;

interface SceneManagerCallbacks {
  onNodeClick?: (nodeId: EntityId) => void;
}

/**
 * SceneManager manages the PixiJS Application and all rendering.
 */
export class SceneManager {
  private app: PIXI.Application;
  private viewport: Viewport;
  private callbacks: SceneManagerCallbacks;

  // Layered containers for z-ordering
  private backgroundLayer: PIXI.Container;
  private connectionsLayer: PIXI.Container;
  private nodesLayer: PIXI.Container;
  private overlayLayer: PIXI.Container;

  // Sprite registries for incremental updates
  private nodeSprites: Map<EntityId, PIXI.Container> = new Map();
  private connectionGraphics: PIXI.Graphics;

  // Current state
  private currentWorld: GameWorld | null = null;
  private selectedNodeId: EntityId | null = null;
  private players: Map<EntityId, Player> = new Map();

  constructor(
    app: PIXI.Application,
    callbacks: SceneManagerCallbacks = {}
  ) {
    this.app = app;
    this.callbacks = callbacks;

    // Create viewport for pan/zoom (PixiJS v8 uses app.renderer.events)
    this.viewport = new Viewport({
      screenWidth: app.screen.width,
      screenHeight: app.screen.height,
      worldWidth: 2000,
      worldHeight: 2000,
      events: app.renderer.events, // PixiJS v8 API
    });

    // Configure viewport interactions
    this.viewport
      .drag()
      .pinch()
      .wheel()
      .decelerate();

    this.app.stage.addChild(this.viewport);

    // Create layered scene graph
    this.backgroundLayer = new PIXI.Container();
    this.connectionsLayer = new PIXI.Container();
    this.nodesLayer = new PIXI.Container();
    this.overlayLayer = new PIXI.Container();

    this.viewport.addChild(this.backgroundLayer);
    this.viewport.addChild(this.connectionsLayer);
    this.viewport.addChild(this.nodesLayer);
    this.viewport.addChild(this.overlayLayer);

    // Create connection graphics (drawn once, reused)
    this.connectionGraphics = new PIXI.Graphics();
    this.connectionsLayer.addChild(this.connectionGraphics);

    // Center viewport on game area (nodes are positioned around 200-700 range)
    this.viewport.moveCenter(450, 350);
  }

  /**
   * Update the entire world state.
   * Performs incremental updates based on what changed.
   */
  updateWorld(world: GameWorld | null, players: Map<EntityId, Player>) {
    console.log('[SceneManager] updateWorld called:', { 
      hasWorld: !!world, 
      nodeCount: world ? Object.keys(world.nodes).length : 0,
      playerCount: players.size 
    });
    
    this.currentWorld = world;
    this.players = players;

    if (!world) {
      this.clear();
      return;
    }

    // Update nodes
    this.updateNodes(world.nodes);

    // Update connections
    this.updateConnections(world.connections);
  }

  /**
   * Update node rendering.
   * Only updates sprites that have changed.
   */
  private updateNodes(nodes: Record<EntityId, Node>) {
    console.log('[SceneManager] updateNodes called with:', Object.keys(nodes).length, 'nodes');
    console.log('[SceneManager] Node keys:', Object.keys(nodes));
    console.log('[SceneManager] First node sample:', Object.values(nodes)[0]);
    
    const currentNodeIds = new Set(Object.keys(nodes));
    
    // Remove sprites for nodes that no longer exist
    for (const [nodeId, sprite] of this.nodeSprites.entries()) {
      if (!currentNodeIds.has(nodeId)) {
        this.nodesLayer.removeChild(sprite);
        this.nodeSprites.delete(nodeId);
      }
    }

    // Add or update sprites for all nodes
    for (const node of Object.values(nodes)) {
      if (!node) continue;
      
      let sprite = this.nodeSprites.get(node.id);
      if (!sprite) {
        sprite = this.createNodeSprite(node);
        this.nodeSprites.set(node.id, sprite);
        this.nodesLayer.addChild(sprite);
        console.log('[SceneManager] Added sprite for node:', node.id, 'to nodesLayer. Layer children count:', this.nodesLayer.children.length);
      } else {
        this.updateNodeSprite(sprite, node);
      }
    }
  }

  /**
   * Create a new node sprite container.
   */
  private createNodeSprite(node: Node): PIXI.Container {
    console.log('[SceneManager] Creating sprite for node:', node.id, 'at', node.position);
    
    const container = new PIXI.Container();
    container.x = node.position.x;
    container.y = node.position.y;

    // Main circle
    const circle = new PIXI.Graphics();
    container.addChild(circle);
    (container as any)._circle = circle;

    // Selection ring (hidden by default)
    const ring = new PIXI.Graphics();
    container.addChild(ring);
    (container as any)._ring = ring;
    ring.visible = false;

    // Label (PixiJS v8 API - pass options object with style property)
    const label = new PIXI.Text({
      text: node.name,
      style: {
        fontSize: 12,
        fill: 0xe8eaed,
      },
    });
    label.anchor.set(0.5);
    label.y = LABEL_OFFSET_Y;
    container.addChild(label);
    (container as any)._label = label;

    // Make interactive
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointerdown', () => this.handleNodeClick(node.id));

    // Update visuals
    this.updateNodeSprite(container, node);

    return container;
  }

  /**
   * Update an existing node sprite's visuals.
   */
  private updateNodeSprite(container: PIXI.Container, node: Node) {
    const circle = (container as any)._circle as PIXI.Graphics;
    const ring = (container as any)._ring as PIXI.Graphics;
    const label = (container as any)._label as PIXI.Text;

    // Update position
    container.x = node.position.x;
    container.y = node.position.y;

    // Update circle color based on owner
    circle.clear();
    let fillColor = COLORS.neutralNode;
    
    if (node.ownerId) {
      const owner = this.players.get(node.ownerId);
      if (owner) {
        // Parse player color (hex string like "#3b82f6")
        fillColor = parseInt(owner.color.replace('#', ''), 16);
      }
    }

    circle.circle(0, 0, NODE_RADIUS);
    circle.fill({ color: fillColor });

    // Update selection ring
    const isSelected = this.selectedNodeId === node.id;
    ring.visible = isSelected;
    if (isSelected) {
      ring.clear();
      ring.circle(0, 0, NODE_RADIUS + 5);
      ring.stroke({ width: NODE_SELECTION_RING_WIDTH, color: COLORS.selectedRing });
    }

    // Update label
    label.text = node.name;
  }

  /**
   * Update connection rendering.
   * Redraws all connections each time (batch rendering).
   */
  private updateConnections(connections: Record<EntityId, Connection>) {
    this.connectionGraphics.clear();

    if (!this.currentWorld) return;

    for (const connection of Object.values(connections)) {
      if (!connection || !connection.isActive) continue;

      const fromNode = this.currentWorld.nodes[connection.fromNodeId];
      const toNode = this.currentWorld.nodes[connection.toNodeId];

      if (!fromNode || !toNode) continue;

      // Draw line between nodes (PixiJS v8 API)
      this.connectionGraphics.moveTo(fromNode.position.x, fromNode.position.y);
      this.connectionGraphics.lineTo(toNode.position.x, toNode.position.y);
      this.connectionGraphics.stroke({ width: CONNECTION_WIDTH, color: COLORS.connection });
    }
  }

  /**
   * Update selected node ID and refresh visuals.
   */
  setSelectedNode(nodeId: EntityId | null) {
    const previousSelectedId = this.selectedNodeId;
    this.selectedNodeId = nodeId;

    // Update previous selection
    if (previousSelectedId && this.currentWorld) {
      const prevNode = this.currentWorld.nodes[previousSelectedId];
      if (prevNode) {
        const sprite = this.nodeSprites.get(previousSelectedId);
        if (sprite) {
          this.updateNodeSprite(sprite, prevNode);
        }
      }
    }

    // Update new selection
    if (nodeId && this.currentWorld) {
      const node = this.currentWorld.nodes[nodeId];
      if (node) {
        const sprite = this.nodeSprites.get(nodeId);
        if (sprite) {
          this.updateNodeSprite(sprite, node);
        }
      }
    }
  }

  /**
   * Handle node click interaction.
   */
  private handleNodeClick(nodeId: EntityId) {
    this.setSelectedNode(nodeId);
    this.callbacks.onNodeClick?.(nodeId);
  }

  /**
   * Resize the renderer and viewport.
   */
  resize(width: number, height: number) {
    this.app.renderer.resize(width, height);
    this.viewport.resize(width, height);
  }

  /**
   * Fit the viewport to show all nodes with padding.
   */
  fitToContent(padding: number = 50) {
    if (!this.currentWorld || Object.keys(this.currentWorld.nodes).length === 0) {
      return;
    }

    const nodes = Object.values(this.currentWorld.nodes);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const node of nodes) {
      if (!node) continue;
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x);
      maxY = Math.max(maxY, node.position.y);
    }

    const contentWidth = maxX - minX + padding * 2;
    const contentHeight = maxY - minY + padding * 2;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Calculate scale to fit content
    const scaleX = this.viewport.screenWidth / contentWidth;
    const scaleY = this.viewport.screenHeight / contentHeight;
    const scale = Math.min(scaleX, scaleY, 2); // Cap at 2x zoom

    this.viewport.setZoom(scale);
    this.viewport.moveCenter(centerX, centerY);
  }

  /**
   * Clear all rendered content.
   */
  clear() {
    // Clear node sprites
    for (const sprite of this.nodeSprites.values()) {
      this.nodesLayer.removeChild(sprite);
    }
    this.nodeSprites.clear();

    // Clear connections
    this.connectionGraphics.clear();

    this.currentWorld = null;
    this.selectedNodeId = null;
  }

  /**
   * Destroy the scene manager and clean up resources.
   */
  destroy() {
    this.clear();
    this.viewport.destroy();
  }
}
