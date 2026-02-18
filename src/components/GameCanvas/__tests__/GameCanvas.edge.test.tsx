/**
 * GameCanvas Edge Case Tests
 * 
 * Tests edge cases and boundary conditions for the PixiJS canvas.
 * Focus: Empty states, single nodes, many nodes, rapid clicking,
 * extreme positions, and performance boundaries.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GameCanvas } from '../GameCanvas';
import { SceneManager } from '../SceneManager';
import { GameWorld, Node, NodeStatus, ConnectionType } from '../../../game/types';
import { Player } from '../../../store/gameState';

// Mock PixiJS and pixi-viewport to focus on logic
jest.mock('pixi.js', () => {
  return {
    Application: jest.fn().mockImplementation(() => {
      const mockCanvas = document.createElement('canvas');
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
            domElement: mockCanvas,
          },
        },
        destroy: jest.fn(),
      };
    }),
  };
});

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

jest.mock('../SceneManager', () => {
  return {
    SceneManager: jest.fn().mockImplementation(() => ({
      updateWorld: jest.fn(),
      setSelectedNode: jest.fn(),
      resize: jest.fn(),
      destroy: jest.fn(),
      clear: jest.fn(),
    })),
  };
});

describe('Edge Cases - Empty States', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle completely empty world (no nodes, no connections)', async () => {
    const emptyWorld: GameWorld = {
      id: 'world_1',
      currentTick: 0,
      speed: 0,
      isPaused: true,
      nodes: {},
      connections: {},
      eventQueue: [],
    };

    const { container } = render(
      <GameCanvas
        world={emptyWorld}
        players={[]}
        selectedNodeId={null}
      />
    );

    await waitFor(() => {
      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    // Should not throw with empty world
    expect(container).toBeInTheDocument();
  });

  it('should handle null world', async () => {
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

    // Should not throw with null world
    expect(container).toBeInTheDocument();
  });

  it('should handle empty players array', async () => {
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
      const mockSceneManager = (SceneManager as jest.Mock).mock.results[0].value;
      
      const playersArg = mockSceneManager.updateWorld.mock.calls[
        mockSceneManager.updateWorld.mock.calls.length - 1
      ][1];
      
      expect(playersArg.size).toBe(0);
    });
  });

  it('should handle nodes with no owner', async () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: {
        node_1: {
          id: 'node_1',
          name: 'Neutral',
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
      expect(container).toBeInTheDocument();
    });
  });

  it('should handle world with tick 0', async () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: {},
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
      expect(container).toBeInTheDocument();
    });
  });
});

describe('Edge Cases - Single Node', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('should handle single owned node', async () => {
    const world: GameWorld = {
      id: 'world_1',
      currentTick: 0,
      speed: 0,
      isPaused: true,
      nodes: {
        node_1: {
          id: 'node_1',
          name: 'Lone Node',
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

    const { container } = render(
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

  it('should handle single neutral node', async () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: {
        node_1: {
          id: 'node_1',
          name: 'Neutral',
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
      expect(container).toBeInTheDocument();
    });
  });

  it('should handle single node selected', async () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: {
        node_1: {
          id: 'node_1',
          name: 'Selected',
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
        selectedNodeId="node_1"
      />
    );

    await waitFor(() => {
      const mockSceneManager = (SceneManager as jest.Mock).mock.results[0].value;
      expect(mockSceneManager.setSelectedNode).toHaveBeenCalledWith('node_1');
    });
  });

  it('should handle single node at origin', async () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: {
        node_1: {
          id: 'node_1',
          name: 'Origin',
          position: { x: 0, y: 0 },
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
      expect(container).toBeInTheDocument();
    });
  });
});

describe('Edge Cases - Many Nodes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function generateNodes(count: number): Record<string, Node> {
    const nodes: Record<string, Node> = {};
    const gridSize = Math.ceil(Math.sqrt(count));
    
    for (let i = 0; i < count; i++) {
      nodes[`node_${i}`] = {
        id: `node_${i}`,
        name: `Node ${i}`,
        position: {
          x: (i % gridSize) * 100,
          y: Math.floor(i / gridSize) * 100,
        },
        status: i % 3 === 0 ? NodeStatus.Claimed : NodeStatus.Neutral,
        ownerId: i % 3 === 0 ? 'player_1' : null,
        resources: [],
        connectionIds: [],
      };
    }
    
    return nodes;
  }

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

  it('should handle 10 nodes', async () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,

      currentTick: 0,
      nodes: generateNodes(10),
      connections: {},
      eventQueue: [],
    };

    const { container } = render(
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

  it('should handle 50 nodes', async () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,

      currentTick: 0,
      nodes: generateNodes(50),
      connections: {},
      eventQueue: [],
    };

    const { container } = render(
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

  it('should handle 100 nodes (performance baseline)', async () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,

      currentTick: 0,
      nodes: generateNodes(100),
      connections: {},
      eventQueue: [],
    };

    const { container } = render(
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

  it('should handle 200 nodes (stress test)', async () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,

      currentTick: 0,
      nodes: generateNodes(200),
      connections: {},
      eventQueue: [],
    };

    const { container } = render(
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

  it('should handle adding nodes incrementally', async () => {
    const { rerender, container } = render(
      <GameCanvas
        world={{
          id: 'world_1',
          speed: 0,
          isPaused: true,
          currentTick: 0,
          nodes: generateNodes(10),
          connections: {},
          eventQueue: [],
        }}
        players={[player]}
        selectedNodeId={null}
      />
    );

    await waitFor(() => {
      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    // Add more nodes
    rerender(
      <GameCanvas
        world={{
          id: 'world_1',
          speed: 0,
          isPaused: true,
          currentTick: 1,
          nodes: generateNodes(50),
          connections: {},
          eventQueue: [],
        }}
        players={[player]}
        selectedNodeId={null}
      />
    );

    await waitFor(() => {
      expect(container).toBeInTheDocument();
    });

    // Add even more nodes
    rerender(
      <GameCanvas
        world={{
          id: 'world_1',
          speed: 0,
          isPaused: true,
          currentTick: 2,
          nodes: generateNodes(100),
          connections: {},
          eventQueue: [],
        }}
        players={[player]}
        selectedNodeId={null}
      />
    );

    await waitFor(() => {
      expect(container).toBeInTheDocument();
    });
  });
});

describe('Edge Cases - Rapid Interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
        status: NodeStatus.Neutral,
        ownerId: null,
        resources: [],
        connectionIds: [],
      },
      node_2: {
        id: 'node_2',
        name: 'Beta',
        position: { x: 200, y: 200 },
        status: NodeStatus.Neutral,
        ownerId: null,
        resources: [],
        connectionIds: [],
      },
      node_3: {
        id: 'node_3',
        name: 'Gamma',
        position: { x: 300, y: 300 },
        status: NodeStatus.Neutral,
        ownerId: null,
        resources: [],
        connectionIds: [],
      },
    },
    connections: {},
    eventQueue: [],
  };

  it('should handle rapid selection changes', async () => {
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

    // Rapid selection changes
    const selections = [null, 'node_1', 'node_2', 'node_3', null, 'node_2', 'node_1', null];
    
    for (const selection of selections) {
      rerender(
        <GameCanvas
          world={world}
          players={[player]}
          selectedNodeId={selection}
        />
      );
    }

    await waitFor(() => {
      expect(container).toBeInTheDocument();
    });
  });

  it('should handle clicking same node repeatedly', async () => {
    const mockOnNodeClick = jest.fn();
    
    const { container } = render(
      <GameCanvas
        world={world}
        players={[player]}
        selectedNodeId="node_1"
        onNodeClick={mockOnNodeClick}
      />
    );

    await waitFor(() => {
      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    const { SceneManager: MockSceneManager } = require('../SceneManager');
    const callbacks = MockSceneManager.mock.calls[0][1];

    // Simulate rapid clicks on same node
    for (let i = 0; i < 10; i++) {
      callbacks.onNodeClick?.('node_1');
    }

    expect(mockOnNodeClick).toHaveBeenCalledTimes(10);
  });

  it('should handle alternating between two nodes rapidly', async () => {
    const mockOnNodeClick = jest.fn();
    
    const { container } = render(
      <GameCanvas
        world={world}
        players={[player]}
        selectedNodeId={null}
        onNodeClick={mockOnNodeClick}
      />
    );

    await waitFor(() => {
      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    const { SceneManager: MockSceneManager } = require('../SceneManager');
    const callbacks = MockSceneManager.mock.calls[0][1];

    // Rapid alternating clicks
    for (let i = 0; i < 20; i++) {
      callbacks.onNodeClick?.(i % 2 === 0 ? 'node_1' : 'node_2');
    }

    expect(mockOnNodeClick).toHaveBeenCalledTimes(20);
  });

  it('should handle rapid world updates', async () => {
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

    // Rapid world updates
    for (let i = 0; i < 50; i++) {
      rerender(
        <GameCanvas
          world={{
            ...world,
            currentTick: i,
          }}
          players={[player]}
          selectedNodeId={null}
        />
      );
    }

    await waitFor(() => {
      expect(container).toBeInTheDocument();
    });
  });
});

describe('Edge Cases - Extreme Positions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle nodes at very large coordinates', async () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: {
        node_1: {
          id: 'node_1',
          name: 'Far Away',
          position: { x: 999999, y: 999999 },
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
      expect(container).toBeInTheDocument();
    });
  });

  it('should handle nodes at negative coordinates', async () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: {
        node_1: {
          id: 'node_1',
          name: 'Negative',
          position: { x: -100, y: -200 },
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
      expect(container).toBeInTheDocument();
    });
  });

  it('should handle nodes at zero coordinates', async () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: {
        node_1: {
          id: 'node_1',
          name: 'Origin',
          position: { x: 0, y: 0 },
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
      expect(container).toBeInTheDocument();
    });
  });

  it('should handle nodes with floating point coordinates', async () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: {
        node_1: {
          id: 'node_1',
          name: 'Float',
          position: { x: 123.456, y: 789.012 },
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
      expect(container).toBeInTheDocument();
    });
  });

  it('should handle nodes very close together', async () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: {
        node_1: {
          id: 'node_1',
          name: 'Close 1',
          position: { x: 100, y: 100 },
          status: NodeStatus.Neutral,
          ownerId: null,
          resources: [],
          connectionIds: [],
        },
        node_2: {
          id: 'node_2',
          name: 'Close 2',
          position: { x: 100.1, y: 100.1 },
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
      expect(container).toBeInTheDocument();
    });
  });
});

describe('Edge Cases - Invalid Data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle selection of non-existent node', async () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: {
        node_1: {
          id: 'node_1',
          name: 'Exists',
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
        selectedNodeId="nonexistent"
      />
    );

    await waitFor(() => {
      const mockSceneManager = (SceneManager as jest.Mock).mock.results[0].value;
      expect(mockSceneManager.setSelectedNode).toHaveBeenCalledWith('nonexistent');
    });
  });

  it('should handle player with invalid color format', async () => {
    const invalidPlayer: Player = {
      id: 'player_1',
      name: 'Invalid',
      color: 'not-a-color',
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
          name: 'Node',
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

    const { container } = render(
      <GameCanvas
        world={world}
        players={[invalidPlayer]}
        selectedNodeId={null}
      />
    );

    await waitFor(() => {
      expect(container).toBeInTheDocument();
    });
  });

  it('should handle node with owner that does not exist in players', async () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: {
        node_1: {
          id: 'node_1',
          name: 'Orphan',
          position: { x: 100, y: 100 },
          status: NodeStatus.Claimed,
          ownerId: 'nonexistent_player',
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
      expect(container).toBeInTheDocument();
    });
  });

  it('should handle empty string node ID', async () => {
    const world: GameWorld = {
      id: 'world_1',
      speed: 0,
      isPaused: true,
      currentTick: 0,
      nodes: {
        '': {
          id: '',
          name: 'Empty ID',
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
      expect(container).toBeInTheDocument();
    });
  });
});
