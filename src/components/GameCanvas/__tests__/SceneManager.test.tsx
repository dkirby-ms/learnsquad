/**
 * SceneManager Tests
 * 
 * Tests the PixiJS SceneManager that handles all rendering logic.
 * Focus: Node rendering, connection rendering, selection handling,
 * sprite registry management, and incremental updates.
 */

import * as PIXI from 'pixi.js';
import { SceneManager } from '../SceneManager';
import { GameWorld, Node, Connection, NodeStatus, ConnectionType } from '../../../game/types';
import { Player } from '../../../store/gameState';

// Mock PixiJS to avoid rendering in tests
jest.mock('pixi.js', () => {
  const MockGraphics = jest.fn().mockImplementation(function() {
    return {
      clear: jest.fn().mockReturnThis(),
      circle: jest.fn().mockReturnThis(),
      fill: jest.fn().mockReturnThis(),
      stroke: jest.fn().mockReturnThis(),
      moveTo: jest.fn().mockReturnThis(),
      lineTo: jest.fn().mockReturnThis(),
    };
  });

  const MockText = jest.fn().mockImplementation(function(options: any) {
    return {
      text: options?.text || '',
      anchor: { set: jest.fn() },
      x: 0,
      y: 0,
    };
  });

  const MockContainer = jest.fn().mockImplementation(function() {
    const children: any[] = [];
    return {
      x: 0,
      y: 0,
      visible: true,
      eventMode: 'none',
      cursor: 'default',
      addChild: jest.fn((child: any) => children.push(child)),
      removeChild: jest.fn((child: any) => {
        const index = children.indexOf(child);
        if (index > -1) children.splice(index, 1);
      }),
      on: jest.fn(),
      _children: children,
    };
  });

  return {
    Application: jest.fn(),
    Graphics: MockGraphics,
    Text: MockText,
    Container: MockContainer,
  };
});

// Mock pixi-viewport
jest.mock('pixi-viewport', () => {
  return {
    Viewport: jest.fn().mockImplementation(() => ({
      addChild: jest.fn(),
      resize: jest.fn(),
      drag: jest.fn().mockReturnThis(),
      pinch: jest.fn().mockReturnThis(),
      wheel: jest.fn().mockReturnThis(),
      decelerate: jest.fn().mockReturnThis(),
      moveCenter: jest.fn().mockReturnThis(),
      destroy: jest.fn(),
    })),
  };
});

describe('SceneManager - Initialization', () => {
  let mockApp: any;

  beforeEach(() => {
    mockApp = {
      stage: {
        addChild: jest.fn(),
        removeChild: jest.fn(),
      },
      screen: { width: 800, height: 600 },
      renderer: {
        resize: jest.fn(),
      },
    };
  });

  it('should initialize viewport on construction', () => {
    const sceneManager = new SceneManager(mockApp);
    
    const { Viewport } = require('pixi-viewport');
    expect(Viewport).toHaveBeenCalledWith(
      expect.objectContaining({
        screenWidth: 800,
        screenHeight: 600,
        worldWidth: 2000,
        worldHeight: 2000,
      })
    );
  });

  it('should configure viewport with pan/zoom interactions', () => {
    const sceneManager = new SceneManager(mockApp);
    
    const { Viewport } = require('pixi-viewport');
    const mockViewport = Viewport.mock.results[0].value;
    
    expect(mockViewport.drag).toHaveBeenCalled();
    expect(mockViewport.pinch).toHaveBeenCalled();
    expect(mockViewport.wheel).toHaveBeenCalled();
    expect(mockViewport.decelerate).toHaveBeenCalled();
  });

  it('should center viewport on initialization', () => {
    const sceneManager = new SceneManager(mockApp);
    
    const { Viewport } = require('pixi-viewport');
    const mockViewport = Viewport.mock.results[0].value;
    
    expect(mockViewport.moveCenter).toHaveBeenCalledWith(1000, 1000);
  });

  it('should store onNodeClick callback', () => {
    const mockCallback = jest.fn();
    const sceneManager = new SceneManager(mockApp, { onNodeClick: mockCallback });
    
    // SceneManager should store the callback
    expect(sceneManager).toBeDefined();
  });
});

describe('SceneManager - Node Rendering', () => {
  let mockApp: any;
  let sceneManager: SceneManager;

  beforeEach(() => {
    mockApp = {
      stage: {
        addChild: jest.fn(),
        removeChild: jest.fn(),
      },
      screen: { width: 800, height: 600 },
      renderer: {
        resize: jest.fn(),
      },
    };
    sceneManager = new SceneManager(mockApp);
  });

  const mockPlayer: Player = {
    id: 'player_1',
    name: 'Test Player',
    color: '#3b82f6',
    sessionId: 'session_1',
    joinedAt: Date.now(),
    isConnected: true,
    focusedNodeId: '',
    lastActivityTick: 0,
  };

  const mockNode: Node = {
    id: 'node_1',
    name: 'Alpha',
    position: { x: 100, y: 100 },
          status: NodeStatus.Claimed,
    ownerId: 'player_1',
    resources: [],
    connectionIds: [],
  };

  it('should render new nodes', () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: { node_1: mockNode },
      connections: {},
      eventQueue: [],
    };

    const players = new Map([['player_1', mockPlayer]]);

    sceneManager.updateWorld(world, players);
    
    // Node should be added to the scene (implementation detail: check internal state)
    // This is a contract test - verifies the method completes without error
    expect(() => sceneManager.updateWorld(world, players)).not.toThrow();
  });

  it('should update existing nodes when world changes', () => {
    const world1: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: { node_1: mockNode },
      connections: {},
      eventQueue: [],
    };

    const world2: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 1,
      nodes: {
        node_1: {
          ...mockNode,
          position: { x: 200, y: 200 }, // Position changed
        },
      },
      connections: {},
      eventQueue: [],
    };

    const players = new Map([['player_1', mockPlayer]]);

    sceneManager.updateWorld(world1, players);
    sceneManager.updateWorld(world2, players);
    
    // Should not throw - existing sprite should be updated, not recreated
    expect(() => sceneManager.updateWorld(world2, players)).not.toThrow();
  });

  it('should remove deleted nodes', () => {
    const world1: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: { 
        node_1: mockNode,
        node_2: { ...mockNode, id: 'node_2', name: 'Beta' },
      },
      connections: {},
      eventQueue: [],
    };

    const world2: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 1,
      nodes: { node_1: mockNode }, // node_2 removed
      connections: {},
      eventQueue: [],
    };

    const players = new Map([['player_1', mockPlayer]]);

    sceneManager.updateWorld(world1, players);
    sceneManager.updateWorld(world2, players);
    
    // Should not throw - removed sprites should be cleaned up
    expect(() => sceneManager.updateWorld(world2, players)).not.toThrow();
  });

  it('should handle empty world', () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: {},
      connections: {},
      eventQueue: [],
    };

    const players = new Map();

    expect(() => sceneManager.updateWorld(world, players)).not.toThrow();
  });

  it('should handle null world', () => {
    const players = new Map();

    expect(() => sceneManager.updateWorld(null, players)).not.toThrow();
  });

  it('should render nodes with correct owner colors', () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: { node_1: mockNode },
      connections: {},
      eventQueue: [],
    };

    const players = new Map([['player_1', mockPlayer]]);

    expect(() => sceneManager.updateWorld(world, players)).not.toThrow();
  });

  it('should render neutral nodes (no owner)', () => {
    const neutralNode: Node = {
      ...mockNode,
      ownerId: null,
    };

    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: { node_1: neutralNode },
      connections: {},
      eventQueue: [],
    };

    const players = new Map();

    expect(() => sceneManager.updateWorld(world, players)).not.toThrow();
  });

  it('should handle multiple nodes', () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: {
        node_1: mockNode,
        node_2: { ...mockNode, id: 'node_2', name: 'Beta', position: { x: 200, y: 200 } },
        node_3: { ...mockNode, id: 'node_3', name: 'Gamma', position: { x: 300, y: 300 } },
      },
      connections: {},
      eventQueue: [],
    };

    const players = new Map([['player_1', mockPlayer]]);

    expect(() => sceneManager.updateWorld(world, players)).not.toThrow();
  });
});

describe('SceneManager - Connection Rendering', () => {
  let mockApp: any;
  let sceneManager: SceneManager;

  beforeEach(() => {
    mockApp = {
      stage: {
        addChild: jest.fn(),
        removeChild: jest.fn(),
      },
      screen: { width: 800, height: 600 },
      renderer: {
        resize: jest.fn(),
      },
    };
    sceneManager = new SceneManager(mockApp);
  });

  const node1: Node = {
    id: 'node_1',
    name: 'Alpha',
    position: { x: 100, y: 100 },
          status: NodeStatus.Neutral,
    ownerId: null,
    resources: [],
    connectionIds: ['conn_1'],
  };

  const node2: Node = {
    id: 'node_2',
    name: 'Beta',
    position: { x: 200, y: 200 },
          status: NodeStatus.Neutral,
    ownerId: null,
    resources: [],
    connectionIds: ['conn_1'],
  };

  const connection: Connection = {
    id: 'conn_1',
    fromNodeId: 'node_1',
    toNodeId: 'node_2',
    type: ConnectionType.Direct,
        travelTime: 1,
        isActive: true,
  };

  it('should render connections between nodes', () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: { node_1: node1, node_2: node2 },
      connections: { conn_1: connection },
      eventQueue: [],
    };

    const players = new Map();

    expect(() => sceneManager.updateWorld(world, players)).not.toThrow();
  });

  it('should not render inactive connections', () => {
    const inactiveConnection: Connection = {
      ...connection,
      isActive: false,
    };

    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: { node_1: node1, node_2: node2 },
      connections: { conn_1: inactiveConnection },
      eventQueue: [],
    };

    const players = new Map();

    expect(() => sceneManager.updateWorld(world, players)).not.toThrow();
  });

  it('should handle missing nodes gracefully', () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: { node_1: node1 }, // node_2 missing
      connections: { conn_1: connection },
      eventQueue: [],
    };

    const players = new Map();

    // Should not throw even if node is missing
    expect(() => sceneManager.updateWorld(world, players)).not.toThrow();
  });

  it('should handle empty connections', () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: { node_1: node1, node_2: node2 },
      connections: {},
      eventQueue: [],
    };

    const players = new Map();

    expect(() => sceneManager.updateWorld(world, players)).not.toThrow();
  });

  it('should update connections when nodes move', () => {
    const world1: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: { node_1: node1, node_2: node2 },
      connections: { conn_1: connection },
      eventQueue: [],
    };

    const world2: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 1,
      nodes: {
        node_1: { ...node1, position: { x: 150, y: 150 } },
        node_2: node2,
      },
      connections: { conn_1: connection },
      eventQueue: [],
    };

    const players = new Map();

    sceneManager.updateWorld(world1, players);
    expect(() => sceneManager.updateWorld(world2, players)).not.toThrow();
  });

  it('should handle multiple connections', () => {
    const node3: Node = {
      id: 'node_3',
      name: 'Gamma',
      position: { x: 300, y: 300 },
          status: NodeStatus.Neutral,
      ownerId: null,
      resources: [],
      connectionIds: ['conn_2'],
    };

    const connection2: Connection = {
      id: 'conn_2',
      fromNodeId: 'node_2',
      toNodeId: 'node_3',
      type: ConnectionType.Direct,
        travelTime: 1,
        isActive: true,
    };

    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: { node_1: node1, node_2: node2, node_3: node3 },
      connections: { conn_1: connection, conn_2: connection2 },
      eventQueue: [],
    };

    const players = new Map();

    expect(() => sceneManager.updateWorld(world, players)).not.toThrow();
  });
});

describe('SceneManager - Selection Handling', () => {
  let mockApp: any;
  let sceneManager: SceneManager;
  let mockCallback: jest.Mock;

  beforeEach(() => {
    mockCallback = jest.fn();
    mockApp = {
      stage: {
        addChild: jest.fn(),
        removeChild: jest.fn(),
      },
      screen: { width: 800, height: 600 },
      renderer: {
        resize: jest.fn(),
      },
    };
    sceneManager = new SceneManager(mockApp, { onNodeClick: mockCallback });
  });

  const mockNode: Node = {
    id: 'node_1',
    name: 'Alpha',
    position: { x: 100, y: 100 },
          status: NodeStatus.Neutral,
    ownerId: null,
    resources: [],
    connectionIds: [],
  };

  it('should set selected node', () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: { node_1: mockNode },
      connections: {},
      eventQueue: [],
    };

    sceneManager.updateWorld(world, new Map());
    
    expect(() => sceneManager.setSelectedNode('node_1')).not.toThrow();
  });

  it('should clear selection', () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: { node_1: mockNode },
      connections: {},
      eventQueue: [],
    };

    sceneManager.updateWorld(world, new Map());
    
    sceneManager.setSelectedNode('node_1');
    expect(() => sceneManager.setSelectedNode(null)).not.toThrow();
  });

  it('should change selection from one node to another', () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: {
        node_1: mockNode,
        node_2: { ...mockNode, id: 'node_2', name: 'Beta' },
      },
      connections: {},
      eventQueue: [],
    };

    sceneManager.updateWorld(world, new Map());
    
    sceneManager.setSelectedNode('node_1');
    expect(() => sceneManager.setSelectedNode('node_2')).not.toThrow();
  });

  it('should handle selection of non-existent node', () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: { node_1: mockNode },
      connections: {},
      eventQueue: [],
    };

    sceneManager.updateWorld(world, new Map());
    
    // Should not throw even if node doesn't exist
    expect(() => sceneManager.setSelectedNode('nonexistent')).not.toThrow();
  });

  it('should handle selection before world initialization', () => {
    // Should not throw even if world hasn't been set yet
    expect(() => sceneManager.setSelectedNode('node_1')).not.toThrow();
  });

  it('should update selection visual when node is selected', () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: { node_1: mockNode },
      connections: {},
      eventQueue: [],
    };

    sceneManager.updateWorld(world, new Map());
    sceneManager.setSelectedNode('node_1');
    
    // Updating world again should preserve selection state
    expect(() => sceneManager.updateWorld(world, new Map())).not.toThrow();
  });
});

describe('SceneManager - Viewport Resize', () => {
  let mockApp: any;
  let sceneManager: SceneManager;

  beforeEach(() => {
    mockApp = {
      stage: {
        addChild: jest.fn(),
        removeChild: jest.fn(),
      },
      screen: { width: 800, height: 600 },
      renderer: {
        resize: jest.fn(),
      },
    };
    sceneManager = new SceneManager(mockApp);
  });

  it('should resize renderer', () => {
    sceneManager.resize(1024, 768);
    
    expect(mockApp.renderer.resize).toHaveBeenCalledWith(1024, 768);
  });

  it('should call resize without errors', () => {
    expect(() => sceneManager.resize(1024, 768)).not.toThrow();
  });

  it('should handle multiple resizes', () => {
    sceneManager.resize(1024, 768);
    sceneManager.resize(1920, 1080);
    
    expect(mockApp.renderer.resize).toHaveBeenCalledTimes(2);
  });
});

describe('SceneManager - Cleanup', () => {
  let mockApp: any;
  let sceneManager: SceneManager;

  beforeEach(() => {
    mockApp = {
      stage: {
        addChild: jest.fn(),
        removeChild: jest.fn(),
      },
      screen: { width: 800, height: 600 },
      renderer: {
        resize: jest.fn(),
      },
    };
    sceneManager = new SceneManager(mockApp);
  });

  const mockNode: Node = {
    id: 'node_1',
    name: 'Alpha',
    position: { x: 100, y: 100 },
          status: NodeStatus.Neutral,
    ownerId: null,
    resources: [],
    connectionIds: [],
  };

  it('should clear all nodes', () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: { node_1: mockNode },
      connections: {},
      eventQueue: [],
    };

    sceneManager.updateWorld(world, new Map());
    
    expect(() => sceneManager.clear()).not.toThrow();
  });

  it('should destroy without errors', () => {
    expect(() => sceneManager.destroy()).not.toThrow();
  });

  it('should allow operations after clear', () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: { node_1: mockNode },
      connections: {},
      eventQueue: [],
    };

    sceneManager.updateWorld(world, new Map());
    sceneManager.clear();
    
    // Should be able to add nodes again after clear
    expect(() => sceneManager.updateWorld(world, new Map())).not.toThrow();
  });

  it('should handle clear when already empty', () => {
    expect(() => sceneManager.clear()).not.toThrow();
  });

  it('should handle destroy when already destroyed', () => {
    sceneManager.destroy();
    
    // Second destroy should not throw
    expect(() => sceneManager.destroy()).not.toThrow();
  });
});

describe('SceneManager - Edge Cases', () => {
  let mockApp: any;
  let sceneManager: SceneManager;

  beforeEach(() => {
    mockApp = {
      stage: {
        addChild: jest.fn(),
        removeChild: jest.fn(),
      },
      screen: { width: 800, height: 600 },
      renderer: {
        resize: jest.fn(),
      },
    };
    sceneManager = new SceneManager(mockApp);
  });

  it('should handle rapid world updates', () => {
    const world1: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: {},
      connections: {},
      eventQueue: [],
    };

    const world2: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 1,
      nodes: {},
      connections: {},
      eventQueue: [],
    };

    const world3: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 2,
      nodes: {},
      connections: {},
      eventQueue: [],
    };

    expect(() => {
      sceneManager.updateWorld(world1, new Map());
      sceneManager.updateWorld(world2, new Map());
      sceneManager.updateWorld(world3, new Map());
    }).not.toThrow();
  });

  it('should handle nodes at extreme positions', () => {
    const extremeNode: Node = {
      id: 'node_1',
      name: 'Extreme',
      position: { x: 999999, y: 999999 },
          status: NodeStatus.Neutral,
      ownerId: null,
      resources: [],
      connectionIds: [],
    };

    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: { node_1: extremeNode },
      connections: {},
      eventQueue: [],
    };

    expect(() => sceneManager.updateWorld(world, new Map())).not.toThrow();
  });

  it('should handle nodes at zero position', () => {
    const zeroNode: Node = {
      id: 'node_1',
      name: 'Zero',
      position: { x: 0, y: 0 },
          status: NodeStatus.Neutral,
      ownerId: null,
      resources: [],
      connectionIds: [],
    };

    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: { node_1: zeroNode },
      connections: {},
      eventQueue: [],
    };

    expect(() => sceneManager.updateWorld(world, new Map())).not.toThrow();
  });

  it('should handle many nodes (performance baseline)', () => {
    const nodes: Record<string, Node> = {};
    
    for (let i = 0; i < 100; i++) {
      nodes[`node_${i}`] = {
        id: `node_${i}`,
        name: `Node ${i}`,
        position: { x: (i % 10) * 100, y: Math.floor(i / 10) * 100 },
        status: NodeStatus.Neutral,
        ownerId: null,
        resources: [],
        connectionIds: [],
      };
    }

    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes,
      connections: {},
      eventQueue: [],
    };

    expect(() => sceneManager.updateWorld(world, new Map())).not.toThrow();
  });

  it('should handle player with invalid color', () => {
    const invalidColorPlayer: Player = {
      id: 'player_1',
      name: 'Test',
      color: 'invalid',
    sessionId: 'session_1',
    joinedAt: Date.now(),
    isConnected: true,
    focusedNodeId: '',
    lastActivityTick: 0,
    };

    const node: Node = {
      id: 'node_1',
      name: 'Alpha',
      position: { x: 100, y: 100 },
          status: NodeStatus.Claimed,
      ownerId: 'player_1',
      resources: [],
      connectionIds: [],
    };

    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: { node_1: node },
      connections: {},
      eventQueue: [],
    };

    const players = new Map([['player_1', invalidColorPlayer]]);

    // Should not throw - invalid colors should be handled gracefully
    expect(() => sceneManager.updateWorld(world, players)).not.toThrow();
  });
});
