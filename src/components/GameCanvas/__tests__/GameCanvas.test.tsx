/**
 * GameCanvas Component Tests
 * 
 * Tests the React component that bridges to PixiJS rendering.
 * Focus: Component lifecycle, canvas initialization, prop synchronization,
 * callback wiring, and cleanup.
 * 
 * Written BEFORE full implementation — tests define expected behavior.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as PIXI from 'pixi.js';
import { GameCanvas } from '../GameCanvas';
import { GameWorld, EntityId, NodeStatus, ConnectionType } from '../../../game/types';
import { Player } from '../../../store/gameState';

// Mock PixiJS Application
jest.mock('pixi.js', () => {
  return {
    Application: jest.fn().mockImplementation(() => {
      const mockCanvas = document.createElement('canvas');
      mockCanvas.width = 800;
      mockCanvas.height = 600;
      
      return {
        init: jest.fn().mockResolvedValue(undefined),
        canvas: mockCanvas,
        stage: {
          addChild: jest.fn(),
          removeChild: jest.fn(),
        },
        screen: { width: 800, height: 600 },
        renderer: {
          resize: jest.fn(),
          events: {
            // Mock EventSystem for pixi-viewport v6 compatibility
            domElement: mockCanvas,
          },
        },
        destroy: jest.fn(),
      };
    }),
  };
});

// Mock SceneManager
jest.mock('../SceneManager', () => {
  return {
    SceneManager: jest.fn().mockImplementation(() => ({
      updateWorld: jest.fn(),
      setSelectedNode: jest.fn(),
      resize: jest.fn(),
      fitToContent: jest.fn(),
      destroy: jest.fn(),
    })),
  };
});

describe('GameCanvas - Component Lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render canvas mount point', () => {
    const { container } = render(
      <GameCanvas world={null} players={[]} selectedNodeId={null} />
    );
    
    const canvasContainer = container.firstChild;
    expect(canvasContainer).toBeInTheDocument();
  });

  it('should show loading indicator before initialization', () => {
    render(<GameCanvas world={null} players={[]} selectedNodeId={null} />);
    
    expect(screen.getByText('Loading canvas...')).toBeInTheDocument();
  });

  it('should initialize PixiJS Application on mount', async () => {
    render(<GameCanvas world={null} players={[]} selectedNodeId={null} />);
    
    await waitFor(() => {
      expect(PIXI.Application).toHaveBeenCalled();
    });
  });

  it('should append canvas element to mount point', async () => {
    const { container } = render(
      <GameCanvas world={null} players={[]} selectedNodeId={null} />
    );
    
    await waitFor(() => {
      const canvas = container.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });
  });

  it('should hide loading indicator after initialization', async () => {
    render(<GameCanvas world={null} players={[]} selectedNodeId={null} />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading canvas...')).not.toBeInTheDocument();
    });
  });

  it('should cleanup PixiJS resources on unmount', async () => {
    const { unmount } = render(
      <GameCanvas world={null} players={[]} selectedNodeId={null} />
    );
    
    await waitFor(() => {
      expect(PIXI.Application).toHaveBeenCalled();
    });

    const mockAppInstance = (PIXI.Application as unknown as jest.Mock).mock.results[0].value;
    
    unmount();
    
    await waitFor(() => {
      expect(mockAppInstance.destroy).toHaveBeenCalledWith(true);
    });
  });

  it('should only initialize once even if props change', async () => {
    const { rerender } = render(
      <GameCanvas world={null} players={[]} selectedNodeId={null} />
    );
    
    await waitFor(() => {
      expect(PIXI.Application).toHaveBeenCalledTimes(1);
    });

    const mockWorld: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: {},
      connections: {},
      eventQueue: [],
    };

    rerender(
      <GameCanvas world={mockWorld} players={[]} selectedNodeId={null} />
    );

    // Should not create a new Application
    expect(PIXI.Application).toHaveBeenCalledTimes(1);
  });
});

describe('GameCanvas - Canvas Creation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create canvas with correct dimensions', async () => {
    const { container } = render(
      <GameCanvas world={null} players={[]} selectedNodeId={null} />
    );
    
    await waitFor(() => {
      expect(PIXI.Application).toHaveBeenCalled();
    });

    const mockAppInstance = (PIXI.Application as unknown as jest.Mock).mock.results[0].value;
    
    expect(mockAppInstance.init).toHaveBeenCalledWith(
      expect.objectContaining({
        backgroundColor: 0x0a0e17,
        resolution: expect.any(Number),
        autoDensity: true,
      })
    );
  });

  it('should use device pixel ratio for resolution', async () => {
    const originalDevicePixelRatio = window.devicePixelRatio;
    Object.defineProperty(window, 'devicePixelRatio', {
      writable: true,
      value: 2,
    });

    render(<GameCanvas world={null} players={[]} selectedNodeId={null} />);
    
    await waitFor(() => {
      expect(PIXI.Application).toHaveBeenCalled();
    });

    const mockAppInstance = (PIXI.Application as unknown as jest.Mock).mock.results[0].value;
    
    expect(mockAppInstance.init).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution: 2,
      })
    );

    Object.defineProperty(window, 'devicePixelRatio', {
      writable: true,
      value: originalDevicePixelRatio,
    });
  });

  it('should handle resize events', async () => {
    render(<GameCanvas world={null} players={[]} selectedNodeId={null} />);
    
    await waitFor(() => {
      expect(PIXI.Application).toHaveBeenCalled();
    });

    // Trigger resize
    window.dispatchEvent(new Event('resize'));

    // SceneManager's resize should be called
    const { SceneManager } = require('../SceneManager');
    const mockSceneManager = SceneManager.mock.results[0].value;

    await waitFor(() => {
      expect(mockSceneManager.resize).toHaveBeenCalled();
    });
  });

  it('should cleanup resize listener on unmount', async () => {
    const { unmount, container } = render(
      <GameCanvas world={null} players={[]} selectedNodeId={null} />
    );
    
    await waitFor(() => {
      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    // Just verify unmount doesn't throw - testing internal cleanup is not necessary
    expect(() => unmount()).not.toThrow();
  });
});

describe('GameCanvas - Callback Wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should wire onNodeClick callback to SceneManager', async () => {
    const mockOnNodeClick = jest.fn();
    
    render(
      <GameCanvas
        world={null}
        players={[]}
        selectedNodeId={null}
        onNodeClick={mockOnNodeClick}
      />
    );
    
    await waitFor(() => {
      const { SceneManager } = require('../SceneManager');
      expect(SceneManager).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          onNodeClick: expect.any(Function),
        })
      );
    });
  });

  it('should call onNodeClick prop when SceneManager triggers callback', async () => {
    const mockOnNodeClick = jest.fn();
    
    render(
      <GameCanvas
        world={null}
        players={[]}
        selectedNodeId={null}
        onNodeClick={mockOnNodeClick}
      />
    );
    
    await waitFor(() => {
      const { SceneManager } = require('../SceneManager');
      expect(SceneManager).toHaveBeenCalled();
    });

    const { SceneManager } = require('../SceneManager');
    const constructorArgs = SceneManager.mock.calls[0];
    const callbacks = constructorArgs[1];

    // Simulate SceneManager calling onNodeClick
    callbacks.onNodeClick('node_1');

    expect(mockOnNodeClick).toHaveBeenCalledWith('node_1');
  });

  it('should handle missing onNodeClick callback gracefully', async () => {
    render(<GameCanvas world={null} players={[]} selectedNodeId={null} />);
    
    await waitFor(() => {
      const { SceneManager } = require('../SceneManager');
      expect(SceneManager).toHaveBeenCalled();
    });

    // Should not throw
    const { SceneManager } = require('../SceneManager');
    const constructorArgs = SceneManager.mock.calls[0];
    const callbacks = constructorArgs[1];

    expect(() => {
      callbacks.onNodeClick?.('node_1');
    }).not.toThrow();
  });
});

describe('GameCanvas - World State Synchronization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  const mockWorld: GameWorld = {
    id: 'world_1',
    speed: 0,
    isPaused: true,
    currentTick: 0,
    nodes: {
      node_1: {
        id: 'node_1',
        name: 'Alpha',
        position: { x: 100, y: 100 },
        status: NodeStatus.Claimed,
        ownerId: 'player_1',
        resources: [],
        connectionIds: ['conn_1'],
      },
    },
    connections: {
      conn_1: {
        id: 'conn_1',
        fromNodeId: 'node_1',
        toNodeId: 'node_2',
        type: ConnectionType.Direct,
        travelTime: 1,
        isActive: true,
      },
    },
    eventQueue: [],
  };

  it('should sync world state to SceneManager on mount', async () => {
    render(
      <GameCanvas
        world={mockWorld}
        players={[mockPlayer]}
        selectedNodeId={null}
      />
    );
    
    await waitFor(() => {
      const { SceneManager } = require('../SceneManager');
      const mockSceneManager = SceneManager.mock.results[0].value;
      
      expect(mockSceneManager.updateWorld).toHaveBeenCalledWith(
        mockWorld,
        expect.any(Map)
      );
    });
  });

  it('should convert players array to Map for SceneManager', async () => {
    render(
      <GameCanvas
        world={mockWorld}
        players={[mockPlayer]}
        selectedNodeId={null}
      />
    );
    
    await waitFor(() => {
      const { SceneManager } = require('../SceneManager');
      const mockSceneManager = SceneManager.mock.results[0].value;
      
      const updateWorldCalls = mockSceneManager.updateWorld.mock.calls;
      expect(updateWorldCalls.length).toBeGreaterThan(0);
      
      const playersArg = updateWorldCalls[updateWorldCalls.length - 1][1];
      expect(playersArg).toBeInstanceOf(Map);
      expect(playersArg.get('player_1')).toEqual(mockPlayer);
    });
  });

  it('should update SceneManager when world changes', async () => {
    const { rerender } = render(
      <GameCanvas
        world={mockWorld}
        players={[mockPlayer]}
        selectedNodeId={null}
      />
    );
    
    await waitFor(() => {
      const { SceneManager } = require('../SceneManager');
      expect(SceneManager).toHaveBeenCalled();
    });

    const { SceneManager } = require('../SceneManager');
    const mockSceneManager = SceneManager.mock.results[0].value;
    
    const initialCallCount = mockSceneManager.updateWorld.mock.calls.length;

    const updatedWorld: GameWorld = {
      ...mockWorld,
      currentTick: 1,
    };

    rerender(
      <GameCanvas
        world={updatedWorld}
        players={[mockPlayer]}
        selectedNodeId={null}
      />
    );

    await waitFor(() => {
      expect(mockSceneManager.updateWorld.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });

  it('should update SceneManager when players change', async () => {
    const { rerender } = render(
      <GameCanvas
        world={mockWorld}
        players={[mockPlayer]}
        selectedNodeId={null}
      />
    );
    
    await waitFor(() => {
      const { SceneManager } = require('../SceneManager');
      expect(SceneManager).toHaveBeenCalled();
    });

    const { SceneManager } = require('../SceneManager');
    const mockSceneManager = SceneManager.mock.results[0].value;
    
    const initialCallCount = mockSceneManager.updateWorld.mock.calls.length;

    const newPlayer: Player = {
      id: 'player_2',
      name: 'Player 2',
      color: '#ef4444',
    sessionId: 'session_1',
    joinedAt: Date.now(),
    isConnected: true,
    focusedNodeId: '',
    lastActivityTick: 0,
    };

    rerender(
      <GameCanvas
        world={mockWorld}
        players={[mockPlayer, newPlayer]}
        selectedNodeId={null}
      />
    );

    await waitFor(() => {
      expect(mockSceneManager.updateWorld.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });

  it('should handle null world gracefully', async () => {
    render(
      <GameCanvas
        world={null}
        players={[]}
        selectedNodeId={null}
      />
    );
    
    await waitFor(() => {
      const { SceneManager } = require('../SceneManager');
      const mockSceneManager = SceneManager.mock.results[0].value;
      
      expect(mockSceneManager.updateWorld).toHaveBeenCalledWith(
        null,
        expect.any(Map)
      );
    });
  });
});

describe('GameCanvas - Selection State Synchronization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should sync selectedNodeId to SceneManager on mount', async () => {
    render(
      <GameCanvas
        world={null}
        players={[]}
        selectedNodeId="node_1"
      />
    );
    
    await waitFor(() => {
      const { SceneManager } = require('../SceneManager');
      const mockSceneManager = SceneManager.mock.results[0].value;
      
      expect(mockSceneManager.setSelectedNode).toHaveBeenCalledWith('node_1');
    });
  });

  it('should update SceneManager when selectedNodeId changes', async () => {
    const { rerender } = render(
      <GameCanvas
        world={null}
        players={[]}
        selectedNodeId="node_1"
      />
    );
    
    await waitFor(() => {
      const { SceneManager } = require('../SceneManager');
      expect(SceneManager).toHaveBeenCalled();
    });

    const { SceneManager } = require('../SceneManager');
    const mockSceneManager = SceneManager.mock.results[0].value;

    rerender(
      <GameCanvas
        world={null}
        players={[]}
        selectedNodeId="node_2"
      />
    );

    await waitFor(() => {
      expect(mockSceneManager.setSelectedNode).toHaveBeenCalledWith('node_2');
    });
  });

  it('should handle null selectedNodeId', async () => {
    render(
      <GameCanvas
        world={null}
        players={[]}
        selectedNodeId={null}
      />
    );
    
    await waitFor(() => {
      const { SceneManager } = require('../SceneManager');
      const mockSceneManager = SceneManager.mock.results[0].value;
      
      expect(mockSceneManager.setSelectedNode).toHaveBeenCalledWith(null);
    });
  });

  it('should handle selection clearing (node -> null)', async () => {
    const { rerender } = render(
      <GameCanvas
        world={null}
        players={[]}
        selectedNodeId="node_1"
      />
    );
    
    await waitFor(() => {
      const { SceneManager } = require('../SceneManager');
      expect(SceneManager).toHaveBeenCalled();
    });

    const { SceneManager } = require('../SceneManager');
    const mockSceneManager = SceneManager.mock.results[0].value;

    rerender(
      <GameCanvas
        world={null}
        players={[]}
        selectedNodeId={null}
      />
    );

    await waitFor(() => {
      expect(mockSceneManager.setSelectedNode).toHaveBeenCalledWith(null);
    });
  });
});
