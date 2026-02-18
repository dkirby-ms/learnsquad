/**
 * GameCanvas Integration Tests
 * 
 * Tests the full canvas → scene manager → render cycle.
 * Focus: End-to-end flow, state synchronization, interaction handling,
 * and integration between GameCanvas and SceneManager.
 */

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GameCanvas } from '../GameCanvas';
import { GameWorld, Node, NodeStatus, ConnectionType } from '../../../game/types';
import { Player } from '../../../store/gameState';

// These tests use real SceneManager (not mocked) to test integration
// But we still mock PixiJS to avoid actual rendering

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
      text: options.text || '',
      anchor: { set: jest.fn() },
      x: 0,
      y: 0,
    };
  });

  const MockContainer = jest.fn().mockImplementation(function() {
    const children: any[] = [];
    const listeners: Record<string, Function[]> = {};
    
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
      on: jest.fn((event: string, handler: Function) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(handler);
      }),
      emit: jest.fn((event: string, ...args: any[]) => {
        if (listeners[event]) {
          listeners[event].forEach(handler => handler(...args));
        }
      }),
      children: children,
      _children: children,
      _listeners: listeners,
    };
  });

  return {
    Application: jest.fn().mockImplementation(() => {
      const mockCanvas = document.createElement('canvas');
      return {
        init: jest.fn().mockResolvedValue(undefined),
        canvas: mockCanvas,
        stage: MockContainer(),
        screen: { width: 800, height: 600 },
        renderer: {
          resize: jest.fn(),
          events: {
            domElement: mockCanvas,
          },
        },
        destroy: jest.fn(),
      };
    }),
    Graphics: MockGraphics,
    Text: MockText,
    Container: MockContainer,
  };
});

jest.mock('pixi-viewport', () => {
  return {
    Viewport: jest.fn().mockImplementation(() => {
      const MockContainer = require('pixi.js').Container;
      const viewport = MockContainer();
      
      return {
        ...viewport,
        resize: jest.fn(),
        drag: jest.fn().mockReturnThis(),
        pinch: jest.fn().mockReturnThis(),
        wheel: jest.fn().mockReturnThis(),
        decelerate: jest.fn().mockReturnThis(),
        moveCenter: jest.fn().mockReturnThis(),
        setZoom: jest.fn().mockReturnThis(),
        screenWidth: 800,
        screenHeight: 600,
        destroy: jest.fn(),
      };
    }),
  };
});

describe('GameCanvas Integration - Full Render Cycle', () => {
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
      node_2: {
        id: 'node_2',
        name: 'Beta',
        position: { x: 200, y: 200 },
        status: NodeStatus.Neutral,
        ownerId: null,
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

  it('should complete full initialization and render cycle', async () => {
    const { container } = render(
      <GameCanvas
        world={mockWorld}
        players={[mockPlayer]}
        selectedNodeId={null}
      />
    );

    // Wait for initialization
    await waitFor(() => {
      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    // Should complete without errors
    expect(container).toBeInTheDocument();
  });

  it('should handle world state update after initialization', async () => {
    const { rerender, container } = render(
      <GameCanvas
        world={null}
        players={[]}
        selectedNodeId={null}
      />
    );

    await waitFor(() => {
      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    // Update with actual world
    rerender(
      <GameCanvas
        world={mockWorld}
        players={[mockPlayer]}
        selectedNodeId={null}
      />
    );

    // Should complete without errors
    await waitFor(() => {
      expect(container).toBeInTheDocument();
    });
  });

  it('should handle node selection through full cycle', async () => {
    const mockOnNodeClick = jest.fn();
    
    const { rerender, container } = render(
      <GameCanvas
        world={mockWorld}
        players={[mockPlayer]}
        selectedNodeId={null}
        onNodeClick={mockOnNodeClick}
      />
    );

    await waitFor(() => {
      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    // Update selection
    rerender(
      <GameCanvas
        world={mockWorld}
        players={[mockPlayer]}
        selectedNodeId="node_1"
        onNodeClick={mockOnNodeClick}
      />
    );

    await waitFor(() => {
      expect(container).toBeInTheDocument();
    });

    // Should not throw during selection update
    expect(mockOnNodeClick).not.toHaveBeenCalled(); // Not clicked yet
  });

  it('should handle rapid state changes', async () => {
    const { rerender, container } = render(
      <GameCanvas
        world={mockWorld}
        players={[mockPlayer]}
        selectedNodeId={null}
      />
    );

    await waitFor(() => {
      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    // Rapid updates
    for (let i = 0; i < 10; i++) {
      rerender(
        <GameCanvas
          world={{
            ...mockWorld,
            currentTick: i,
          }}
          players={[mockPlayer]}
          selectedNodeId={i % 2 === 0 ? 'node_1' : null}
        />
      );
    }

    // Should handle rapid updates without errors
    await waitFor(() => {
      expect(container).toBeInTheDocument();
    });
  });

  it('should handle player list changes', async () => {
    const { rerender, container } = render(
      <GameCanvas
        world={mockWorld}
        players={[mockPlayer]}
        selectedNodeId={null}
      />
    );

    await waitFor(() => {
      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    const newPlayer: Player = {
      id: 'player_2',
      name: 'Player 2',
      color: '#ef4444',
      sessionId: 'session_2',
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
      expect(container).toBeInTheDocument();
    });
  });

  it('should handle node ownership changes', async () => {
    const { rerender, container } = render(
      <GameCanvas
        world={mockWorld}
        players={[mockPlayer]}
        selectedNodeId={null}
      />
    );

    await waitFor(() => {
      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    const updatedWorld: GameWorld = {
      ...mockWorld,
      currentTick: 1,
      nodes: {
        ...mockWorld.nodes,
        node_2: {
          ...mockWorld.nodes.node_2,
          status: NodeStatus.Claimed,
          ownerId: 'player_1', // Now owned
        },
      },
    };

    rerender(
      <GameCanvas
        world={updatedWorld}
        players={[mockPlayer]}
        selectedNodeId={null}
      />
    );

    await waitFor(() => {
      expect(container).toBeInTheDocument();
    });
  });
});

describe('GameCanvas Integration - State Transitions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should transition from empty to populated world', async () => {
    const { rerender, container } = render(
      <GameCanvas
        world={null}
        players={[]}
        selectedNodeId={null}
      />
    );

    await waitFor(() => {
      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    const player: Player = {
      id: 'player_1',
      name: 'Player',
      color: '#3b82f6',
    sessionId: 'session_1',
    joinedAt: Date.now(),
    isConnected: true,
    focusedNodeId: '',
    lastActivityTick: 0,
  };

    const world: GameWorld = {
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
          connectionIds: [],
        },
      },
      connections: {},
      eventQueue: [],
    };

    rerender(
      <GameCanvas
        world={world}
        players={[player]}
        selectedNodeId={null}
      />
    );

    await waitFor(() => {
      expect(container).toBeInTheDocument();
    });
  });

  it('should transition from populated to empty world', async () => {
    const player: Player = {
      id: 'player_1',
      name: 'Player',
      color: '#3b82f6',
    sessionId: 'session_1',
    joinedAt: Date.now(),
    isConnected: true,
    focusedNodeId: '',
    lastActivityTick: 0,
  };

    const world: GameWorld = {
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
          connectionIds: [],
        },
      },
      connections: {},
      eventQueue: [],
    };

    const { rerender, container } = render(
      <GameCanvas
        world={world}
        players={[player]}
        selectedNodeId={null}
      />
    );

    await waitFor(() => {
      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    rerender(
      <GameCanvas
        world={null}
        players={[]}
        selectedNodeId={null}
      />
    );

    await waitFor(() => {
      expect(container).toBeInTheDocument();
    });
  });

  it('should handle nodes appearing and disappearing', async () => {
    const player: Player = {
      id: 'player_1',
      name: 'Player',
      color: '#3b82f6',
    sessionId: 'session_1',
    joinedAt: Date.now(),
    isConnected: true,
    focusedNodeId: '',
    lastActivityTick: 0,
  };

    const world1: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: {
        node_1: {
          id: 'node_1',
          name: 'Alpha',
          position: { x: 100, y: 100 },
          status: NodeStatus.Neutral,
          ownerId: null,
          resources: [],
          connectionIds: [],
        },
      },
      connections: {},
      eventQueue: [],
    };

    const world2: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 1,
      nodes: {
        node_1: world1.nodes.node_1,
        node_2: {
          id: 'node_2',
          name: 'Beta',
          position: { x: 200, y: 200 },
          status: NodeStatus.Neutral,
          ownerId: null,
          resources: [],
          connectionIds: [],
        },
      },
      connections: {},
      eventQueue: [],
    };

    const world3: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 2,
      nodes: {
        node_2: world2.nodes.node_2,
      },
      connections: {},
      eventQueue: [],
    };

    const { rerender, container } = render(
      <GameCanvas
        world={world1}
        players={[player]}
        selectedNodeId={null}
      />
    );

    await waitFor(() => {
      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    rerender(
      <GameCanvas
        world={world2}
        players={[player]}
        selectedNodeId={null}
      />
    );

    await waitFor(() => {
      expect(container).toBeInTheDocument();
    });

    rerender(
      <GameCanvas
        world={world3}
        players={[player]}
        selectedNodeId={null}
      />
    );

    await waitFor(() => {
      expect(container).toBeInTheDocument();
    });
  });
});

describe('GameCanvas Integration - Resize Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle resize after full initialization', async () => {
    const { container } = render(
      <GameCanvas
        world={null}
        players={[]}
        selectedNodeId={null}
      />
    );

    await waitFor(() => {
      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    // Trigger resize
    window.dispatchEvent(new Event('resize'));

    // Should not throw
    await waitFor(() => {
      expect(container).toBeInTheDocument();
    });
  });

  it('should handle resize with active world', async () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: {
        node_1: {
          id: 'node_1',
          name: 'Alpha',
          position: { x: 100, y: 100 },
          status: NodeStatus.Neutral,
          ownerId: null,
          resources: [],
          connectionIds: [],
        },
      },
      connections: {},
      eventQueue: [],
    };

    const { container } = render(
      <GameCanvas
        world={world}
        players={[]}
        selectedNodeId={null}
      />
    );

    await waitFor(() => {
      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    // Trigger resize
    window.dispatchEvent(new Event('resize'));

    await waitFor(() => {
      expect(container).toBeInTheDocument();
    });
  });
});

describe('GameCanvas Integration - Error Recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should recover from malformed world data', async () => {
    const malformedWorld: any = {
      currentTick: 0,
      nodes: {
        node_1: null, // Invalid node
      },
      connections: {},
      eventQueue: [],
    };

    const { container } = render(
      <GameCanvas
        world={malformedWorld}
        players={[]}
        selectedNodeId={null}
      />
    );

    await waitFor(() => {
      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    // Should not crash
    expect(container).toBeInTheDocument();
  });

  it('should handle missing node references in connections', async () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: {
        node_1: {
          id: 'node_1',
          name: 'Alpha',
          position: { x: 100, y: 100 },
          status: NodeStatus.Neutral,
          ownerId: null,
          resources: [],
          connectionIds: ['conn_1'],
        },
      },
      connections: {
        conn_1: {
          id: 'conn_1',
          fromNodeId: 'node_1',
          toNodeId: 'nonexistent', // Node doesn't exist
          type: ConnectionType.Direct,
          travelTime: 1,
          isActive: true,
        },
      },
      eventQueue: [],
    };

    const { container } = render(
      <GameCanvas
        world={world}
        players={[]}
        selectedNodeId={null}
      />
    );

    await waitFor(() => {
      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    // Should handle gracefully
    expect(container).toBeInTheDocument();
  });
});
