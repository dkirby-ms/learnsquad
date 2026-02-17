/**
 * Connectivity System Tests - Phase 3
 *
 * Testing strategy:
 * - Pure functions (no mocks - mocks lie)
 * - Explicit determinism verification
 * - Edge cases: empty graphs, single nodes, disconnected components
 * - Gateway mechanics: cooldowns, costs, state transitions
 * - Pathfinding: A* correctness, optimality, performance
 */

import {
  canTraverse,
  getTraversalCost,
  defaultCostFunction,
  activateGateway,
  updateGatewayCooldown,
  createGateway,
  isGatewayReady,
  findPath,
  getNeighbors,
  getNeighborsWithCosts,
  getReachableNodes,
  areNodesConnected,
  getConnectionsBetween,
} from '../systems/connectivity';

import {
  createConnection,
  deactivateConnection,
} from '../models/connection';

import {
  createNode,
  addConnection as addConnectionToNode,
} from '../models/node';

import {
  createGameWorld,
  addNode as addNodeToWorld,
  addConnection as addConnectionToWorld,
} from '../models/world';

import {
  ConnectionType,
  ResourceType,
  GameEventType,
  NodeStatus,
  type Connection,
  type Node,
  type Gateway,
  type GameWorld,
  type ResourceCost,
  type TraversalContext,
  type Resource,
} from '../types';

import { createResource } from '../models/resource';

// --- Test Fixtures ---

function makeNode(
  id: string,
  position: { x: number; y: number } = { x: 0, y: 0 },
  connectionIds: string[] = [],
  resources: Resource[] = []
): Node {
  return {
    id,
    name: `Node ${id}`,
    position,
    status: NodeStatus.Neutral,
    ownerId: null,
    resources,
    connectionIds,
  };
}

function makeConnection(
  id: string,
  fromNodeId: string,
  toNodeId: string,
  travelTime: number = 1,
  isActive: boolean = true
): Connection {
  return {
    id,
    fromNodeId,
    toNodeId,
    type: ConnectionType.Direct,
    travelTime,
    isActive,
  };
}

function makeGateway(
  id: string,
  fromNodeId: string,
  toNodeId: string,
  travelTime: number = 1,
  activationCost: ResourceCost[] = [],
  activationTime: number = 0,
  isCoolingDown: boolean = false,
  lastActivatedTick: number | null = null
): Gateway {
  return {
    id,
    fromNodeId,
    toNodeId,
    type: ConnectionType.Gateway,
    travelTime,
    isActive: true,
    activationCost,
    activationTime,
    lastActivatedTick,
    isCoolingDown,
  };
}

/** Build a simple test world with the given nodes and connections */
function buildWorld(
  nodeSpecs: Array<{ id: string; x: number; y: number; connectionIds: string[]; resources?: Resource[] }>,
  connectionSpecs: Array<{ id: string; from: string; to: string; travelTime?: number; isActive?: boolean }>
): GameWorld {
  let world = createGameWorld('test-world');

  for (const spec of nodeSpecs) {
    const node = makeNode(
      spec.id,
      { x: spec.x, y: spec.y },
      spec.connectionIds,
      spec.resources
    );
    world = addNodeToWorld(world, node);
  }

  for (const spec of connectionSpecs) {
    const conn = makeConnection(
      spec.id,
      spec.from,
      spec.to,
      spec.travelTime ?? 1,
      spec.isActive ?? true
    );
    world = addConnectionToWorld(world, conn);
  }

  return world;
}

// === DIRECT LINK TRAVERSAL ===

describe('canTraverse', () => {
  describe('direct connections', () => {
    it('returns true for active direct connection', () => {
      const conn = makeConnection('c1', 'a', 'b', 5, true);
      expect(canTraverse(conn)).toBe(true);
    });

    it('returns false for inactive connection', () => {
      const conn = makeConnection('c1', 'a', 'b', 5, false);
      expect(canTraverse(conn)).toBe(false);
    });

    it('does not require context for direct connections', () => {
      const conn = makeConnection('c1', 'a', 'b', 5, true);
      expect(canTraverse(conn, undefined)).toBe(true);
    });
  });

  describe('gateway connections', () => {
    it('returns true for active gateway not cooling down', () => {
      const gateway = makeGateway('g1', 'a', 'b', 5, [], 0, false);
      expect(canTraverse(gateway)).toBe(true);
    });

    it('returns false for gateway on cooldown', () => {
      const gateway = makeGateway('g1', 'a', 'b', 5, [], 10, true, 0);
      expect(canTraverse(gateway)).toBe(false);
    });

    it('returns false for inactive gateway', () => {
      const gateway: Gateway = {
        ...makeGateway('g1', 'a', 'b'),
        isActive: false,
      };
      expect(canTraverse(gateway)).toBe(false);
    });

    it('returns true when resources are sufficient', () => {
      const gateway = makeGateway('g1', 'a', 'b', 5, [
        { type: ResourceType.Energy, amount: 10 },
      ]);
      const context: TraversalContext = {
        traverserId: 'player-1',
        currentTick: 0,
        availableResources: { 
          [ResourceType.Energy]: 20,
          [ResourceType.Minerals]: 0,
          [ResourceType.Alloys]: 0,
          [ResourceType.Research]: 0,
        },
      };
      expect(canTraverse(gateway, context)).toBe(true);
    });

    it('returns false when resources are insufficient', () => {
      const gateway = makeGateway('g1', 'a', 'b', 5, [
        { type: ResourceType.Energy, amount: 100 },
      ]);
      const context: TraversalContext = {
        traverserId: 'player-1',
        currentTick: 0,
        availableResources: { 
          [ResourceType.Energy]: 20,
          [ResourceType.Minerals]: 0,
          [ResourceType.Alloys]: 0,
          [ResourceType.Research]: 0,
        },
      };
      expect(canTraverse(gateway, context)).toBe(false);
    });

    it('returns false when required resource is missing entirely', () => {
      const gateway = makeGateway('g1', 'a', 'b', 5, [
        { type: ResourceType.Alloys, amount: 10 },
      ]);
      const context: TraversalContext = {
        traverserId: 'player-1',
        currentTick: 0,
        availableResources: { 
          [ResourceType.Energy]: 20,
          [ResourceType.Minerals]: 0,
          [ResourceType.Alloys]: 0,
          [ResourceType.Research]: 0,
        },
      };
      expect(canTraverse(gateway, context)).toBe(false);
    });

    it('returns true for zero-cost gateway', () => {
      const gateway = makeGateway('g1', 'a', 'b', 5, []);
      expect(canTraverse(gateway)).toBe(true);
    });

    it('handles multiple resource costs', () => {
      const gateway = makeGateway('g1', 'a', 'b', 5, [
        { type: ResourceType.Energy, amount: 10 },
        { type: ResourceType.Minerals, amount: 5 },
      ]);
      const context: TraversalContext = {
        traverserId: 'player-1',
        currentTick: 0,
        availableResources: {
          [ResourceType.Energy]: 10,
          [ResourceType.Minerals]: 10,
          [ResourceType.Alloys]: 0,
          [ResourceType.Research]: 0,
        },
      };
      expect(canTraverse(gateway, context)).toBe(true);
    });

    it('fails if any resource is insufficient in multi-cost', () => {
      const gateway = makeGateway('g1', 'a', 'b', 5, [
        { type: ResourceType.Energy, amount: 10 },
        { type: ResourceType.Minerals, amount: 20 },
      ]);
      const context: TraversalContext = {
        traverserId: 'player-1',
        currentTick: 0,
        availableResources: {
          [ResourceType.Energy]: 100,
          [ResourceType.Minerals]: 5, // Not enough
          [ResourceType.Alloys]: 0,
          [ResourceType.Research]: 0,
        },
      };
      expect(canTraverse(gateway, context)).toBe(false);
    });
  });
});

describe('getTraversalCost', () => {
  it('returns travel time for direct connection', () => {
    const conn = makeConnection('c1', 'a', 'b', 7);
    expect(getTraversalCost(conn)).toBe(7);
  });

  it('returns travel time for gateway', () => {
    const gateway = makeGateway('g1', 'a', 'b', 15);
    expect(getTraversalCost(gateway)).toBe(15);
  });

  it('returns zero for zero-cost connection', () => {
    const conn = makeConnection('c1', 'a', 'b', 0);
    expect(getTraversalCost(conn)).toBe(0);
  });
});

describe('defaultCostFunction', () => {
  it('returns travel time', () => {
    const conn = makeConnection('c1', 'a', 'b', 12);
    const nodeA = makeNode('a');
    const nodeB = makeNode('b');
    expect(defaultCostFunction(conn, nodeA, nodeB)).toBe(12);
  });
});

// === GATEWAY MECHANICS ===

describe('isGatewayReady', () => {
  it('returns true for ready gateway', () => {
    const gateway = makeGateway('g1', 'a', 'b', 1, [], 10, false);
    expect(isGatewayReady(gateway, 0)).toBe(true);
  });

  it('returns false for inactive gateway', () => {
    const gateway: Gateway = {
      ...makeGateway('g1', 'a', 'b', 1, [], 0, false),
      isActive: false,
    };
    expect(isGatewayReady(gateway, 0)).toBe(false);
  });

  it('returns false for gateway still cooling down', () => {
    const gateway = makeGateway('g1', 'a', 'b', 1, [], 10, true, 5);
    // Cooldown ends at tick 15 (5 + 10)
    expect(isGatewayReady(gateway, 10)).toBe(false);
    expect(isGatewayReady(gateway, 14)).toBe(false);
  });

  it('returns true when cooldown has finished', () => {
    const gateway = makeGateway('g1', 'a', 'b', 1, [], 10, true, 5);
    // Cooldown ends at tick 15
    expect(isGatewayReady(gateway, 15)).toBe(true);
    expect(isGatewayReady(gateway, 100)).toBe(true);
  });
});

describe('activateGateway', () => {
  it('deducts activation cost from node resources', () => {
    const gateway = makeGateway('g1', 'a', 'b', 1, [
      { type: ResourceType.Energy, amount: 25 },
    ], 10);
    const energy = createResource(ResourceType.Energy, 100, 0, 1000);
    const node = makeNode('a', { x: 0, y: 0 }, ['g1'], [energy]);

    const result = activateGateway(gateway, node, 5);
    const updatedEnergy = result.node.resources.find(r => r.type === ResourceType.Energy);

    expect(updatedEnergy?.amount).toBe(75);
  });

  it('deducts multiple resource costs', () => {
    const gateway = makeGateway('g1', 'a', 'b', 1, [
      { type: ResourceType.Energy, amount: 10 },
      { type: ResourceType.Minerals, amount: 20 },
    ], 5);
    const node = makeNode('a', { x: 0, y: 0 }, ['g1'], [
      createResource(ResourceType.Energy, 50, 0, 100),
      createResource(ResourceType.Minerals, 100, 0, 200),
    ]);

    const result = activateGateway(gateway, node, 0);

    expect(result.node.resources.find(r => r.type === ResourceType.Energy)?.amount).toBe(40);
    expect(result.node.resources.find(r => r.type === ResourceType.Minerals)?.amount).toBe(80);
  });

  it('sets gateway to cooling down state', () => {
    const gateway = makeGateway('g1', 'a', 'b', 1, [], 10);
    const node = makeNode('a');

    const result = activateGateway(gateway, node, 7);

    expect(result.gateway.isCoolingDown).toBe(true);
    expect(result.gateway.lastActivatedTick).toBe(7);
  });

  it('does not cool down for zero activation time', () => {
    const gateway = makeGateway('g1', 'a', 'b', 1, [], 0);
    const node = makeNode('a');

    const result = activateGateway(gateway, node, 0);

    expect(result.gateway.isCoolingDown).toBe(false);
  });

  it('emits GatewayActivated event', () => {
    const gateway = makeGateway('g1', 'a', 'b', 1, [], 5);
    const node = makeNode('a');

    const result = activateGateway(gateway, node, 10);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe(GameEventType.GatewayActivated);
    expect(result.events[0].tick).toBe(10);
    expect(result.events[0].entityId).toBe('g1');
  });

  it('does not go negative on resource deduction', () => {
    const gateway = makeGateway('g1', 'a', 'b', 1, [
      { type: ResourceType.Energy, amount: 1000 },
    ], 5);
    const node = makeNode('a', { x: 0, y: 0 }, ['g1'], [
      createResource(ResourceType.Energy, 50, 0, 100),
    ]);

    const result = activateGateway(gateway, node, 0);
    const energy = result.node.resources.find(r => r.type === ResourceType.Energy);

    expect(energy?.amount).toBe(0); // Clamped to 0
  });

  it('handles zero-cost gateway without changing resources', () => {
    const gateway = makeGateway('g1', 'a', 'b', 1, [], 5);
    const node = makeNode('a', { x: 0, y: 0 }, ['g1'], [
      createResource(ResourceType.Energy, 100, 0, 100),
    ]);

    const result = activateGateway(gateway, node, 0);

    expect(result.node.resources[0].amount).toBe(100);
  });
});

describe('updateGatewayCooldown', () => {
  it('removes cooldown when time is up', () => {
    const gateway = makeGateway('g1', 'a', 'b', 1, [], 10, true, 0);
    // Cooldown ends at tick 10

    const result = updateGatewayCooldown(gateway, 10);

    expect(result.gateway.isCoolingDown).toBe(false);
  });

  it('emits GatewayReady event when cooldown ends', () => {
    const gateway = makeGateway('g1', 'a', 'b', 1, [], 5, true, 10);
    // Cooldown ends at tick 15

    const result = updateGatewayCooldown(gateway, 15);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe(GameEventType.GatewayReady);
    expect(result.events[0].tick).toBe(15);
  });

  it('does not emit event if still cooling down', () => {
    const gateway = makeGateway('g1', 'a', 'b', 1, [], 10, true, 5);

    const result = updateGatewayCooldown(gateway, 10);

    expect(result.events).toHaveLength(0);
    expect(result.gateway.isCoolingDown).toBe(true);
  });

  it('no-ops for gateway not on cooldown', () => {
    const gateway = makeGateway('g1', 'a', 'b', 1, [], 10, false);

    const result = updateGatewayCooldown(gateway, 100);

    expect(result.gateway).toBe(gateway);
    expect(result.events).toHaveLength(0);
  });

  it('handles max cooldown value', () => {
    const gateway = makeGateway('g1', 'a', 'b', 1, [], 1000000, true, 0);

    const result = updateGatewayCooldown(gateway, 999999);

    expect(result.gateway.isCoolingDown).toBe(true);
    expect(result.events).toHaveLength(0);

    const result2 = updateGatewayCooldown(gateway, 1000000);
    expect(result2.gateway.isCoolingDown).toBe(false);
  });
});

describe('createGateway', () => {
  it('creates gateway with correct defaults', () => {
    const gateway = createGateway('g1', 'a', 'b', 5);

    expect(gateway.id).toBe('g1');
    expect(gateway.fromNodeId).toBe('a');
    expect(gateway.toNodeId).toBe('b');
    expect(gateway.travelTime).toBe(5);
    expect(gateway.type).toBe(ConnectionType.Gateway);
    expect(gateway.isActive).toBe(true);
    expect(gateway.isCoolingDown).toBe(false);
    expect(gateway.lastActivatedTick).toBeNull();
    expect(gateway.activationCost).toEqual([]);
    expect(gateway.activationTime).toBe(0);
  });

  it('creates gateway with activation cost', () => {
    const cost: ResourceCost[] = [{ type: ResourceType.Energy, amount: 50 }];
    const gateway = createGateway('g1', 'a', 'b', 5, cost, 10);

    expect(gateway.activationCost).toEqual(cost);
    expect(gateway.activationTime).toBe(10);
  });
});

// === A* PATHFINDING ===

describe('findPath', () => {
  describe('basic pathfinding', () => {
    it('finds path between directly connected nodes', () => {
      const world = buildWorld(
        [
          { id: 'a', x: 0, y: 0, connectionIds: ['c1'] },
          { id: 'b', x: 1, y: 0, connectionIds: ['c1'] },
        ],
        [{ id: 'c1', from: 'a', to: 'b', travelTime: 5 }]
      );

      const path = findPath(world, 'a', 'b');

      expect(path).not.toBeNull();
      expect(path!.from).toBe('a');
      expect(path!.to).toBe('b');
      expect(path!.totalCost).toBe(5);
      expect(path!.steps).toHaveLength(1);
      expect(path!.steps[0].nodeId).toBe('b');
    });

    it('returns empty path for same start and end', () => {
      const world = buildWorld(
        [{ id: 'a', x: 0, y: 0, connectionIds: [] }],
        []
      );

      const path = findPath(world, 'a', 'a');

      expect(path).not.toBeNull();
      expect(path!.steps).toHaveLength(0);
      expect(path!.totalCost).toBe(0);
    });

    it('returns null for disconnected nodes', () => {
      const world = buildWorld(
        [
          { id: 'a', x: 0, y: 0, connectionIds: [] },
          { id: 'b', x: 1, y: 0, connectionIds: [] },
        ],
        []
      );

      const path = findPath(world, 'a', 'b');

      expect(path).toBeNull();
    });

    it('returns null for non-existent start node', () => {
      const world = buildWorld(
        [{ id: 'a', x: 0, y: 0, connectionIds: [] }],
        []
      );

      const path = findPath(world, 'nonexistent', 'a');

      expect(path).toBeNull();
    });

    it('returns null for non-existent end node', () => {
      const world = buildWorld(
        [{ id: 'a', x: 0, y: 0, connectionIds: [] }],
        []
      );

      const path = findPath(world, 'a', 'nonexistent');

      expect(path).toBeNull();
    });
  });

  describe('multi-hop paths', () => {
    it('finds path through intermediate nodes', () => {
      // a -> b -> c
      const world = buildWorld(
        [
          { id: 'a', x: 0, y: 0, connectionIds: ['c1'] },
          { id: 'b', x: 1, y: 0, connectionIds: ['c1', 'c2'] },
          { id: 'c', x: 2, y: 0, connectionIds: ['c2'] },
        ],
        [
          { id: 'c1', from: 'a', to: 'b', travelTime: 3 },
          { id: 'c2', from: 'b', to: 'c', travelTime: 4 },
        ]
      );

      const path = findPath(world, 'a', 'c');

      expect(path).not.toBeNull();
      expect(path!.totalCost).toBe(7);
      expect(path!.steps).toHaveLength(2);
      expect(path!.steps[0].nodeId).toBe('b');
      expect(path!.steps[1].nodeId).toBe('c');
    });

    it('chooses optimal path when multiple exist', () => {
      // Direct: a -> c (cost 10)
      // Through b: a -> b -> c (cost 3 + 4 = 7)
      const world = buildWorld(
        [
          { id: 'a', x: 0, y: 0, connectionIds: ['c1', 'c3'] },
          { id: 'b', x: 1, y: 0, connectionIds: ['c1', 'c2'] },
          { id: 'c', x: 2, y: 0, connectionIds: ['c2', 'c3'] },
        ],
        [
          { id: 'c1', from: 'a', to: 'b', travelTime: 3 },
          { id: 'c2', from: 'b', to: 'c', travelTime: 4 },
          { id: 'c3', from: 'a', to: 'c', travelTime: 10 },
        ]
      );

      const path = findPath(world, 'a', 'c');

      expect(path!.totalCost).toBe(7);
      expect(path!.steps).toHaveLength(2);
    });

    it('respects A* heuristic by preferring closer nodes', () => {
      // Diamond: a -> b -> d (cost 2), a -> c -> d (cost 2)
      // But b is closer to d, so should be explored first
      const world = buildWorld(
        [
          { id: 'a', x: 0, y: 0, connectionIds: ['ab', 'ac'] },
          { id: 'b', x: 1, y: 0, connectionIds: ['ab', 'bd'] }, // Closer to d
          { id: 'c', x: 0, y: 1, connectionIds: ['ac', 'cd'] }, // Further from d
          { id: 'd', x: 2, y: 0, connectionIds: ['bd', 'cd'] },
        ],
        [
          { id: 'ab', from: 'a', to: 'b', travelTime: 1 },
          { id: 'ac', from: 'a', to: 'c', travelTime: 1 },
          { id: 'bd', from: 'b', to: 'd', travelTime: 1 },
          { id: 'cd', from: 'c', to: 'd', travelTime: 1 },
        ]
      );

      const path = findPath(world, 'a', 'd');

      expect(path!.totalCost).toBe(2);
      // With equal costs, heuristic should favor the b path
      expect(path!.steps[0].nodeId).toBe('b');
    });
  });

  describe('inactive connections', () => {
    it('does not traverse inactive connections', () => {
      const world = buildWorld(
        [
          { id: 'a', x: 0, y: 0, connectionIds: ['c1', 'c2'] },
          { id: 'b', x: 1, y: 0, connectionIds: ['c1', 'c3'] },
          { id: 'c', x: 2, y: 0, connectionIds: ['c2', 'c3'] },
        ],
        [
          { id: 'c1', from: 'a', to: 'b', travelTime: 1, isActive: false },
          { id: 'c2', from: 'a', to: 'c', travelTime: 10 },
          { id: 'c3', from: 'b', to: 'c', travelTime: 1 },
        ]
      );

      const path = findPath(world, 'a', 'c');

      // Should take direct a->c path since a->b is inactive
      expect(path!.totalCost).toBe(10);
      expect(path!.steps).toHaveLength(1);
    });

    it('returns null when only path has inactive connection', () => {
      const world = buildWorld(
        [
          { id: 'a', x: 0, y: 0, connectionIds: ['c1'] },
          { id: 'b', x: 1, y: 0, connectionIds: ['c1'] },
        ],
        [{ id: 'c1', from: 'a', to: 'b', travelTime: 1, isActive: false }]
      );

      const path = findPath(world, 'a', 'b');

      expect(path).toBeNull();
    });
  });

  describe('custom cost function', () => {
    it('uses custom cost function', () => {
      const world = buildWorld(
        [
          { id: 'a', x: 0, y: 0, connectionIds: ['c1', 'c2'] },
          { id: 'b', x: 1, y: 0, connectionIds: ['c1', 'c3'] },
          { id: 'c', x: 2, y: 0, connectionIds: ['c2', 'c3'] },
        ],
        [
          { id: 'c1', from: 'a', to: 'b', travelTime: 1 },
          { id: 'c2', from: 'a', to: 'c', travelTime: 10 },
          { id: 'c3', from: 'b', to: 'c', travelTime: 1 },
        ]
      );

      // Custom cost: double the travel time
      const doubleCost = (conn: Connection) => conn.travelTime * 2;
      const path = findPath(world, 'a', 'c', doubleCost);

      // a -> b -> c = 2 + 2 = 4
      expect(path!.totalCost).toBe(4);
    });

    it('handles cost function that considers node positions', () => {
      const world = buildWorld(
        [
          { id: 'a', x: 0, y: 0, connectionIds: ['c1'] },
          { id: 'b', x: 100, y: 100, connectionIds: ['c1'] },
        ],
        [{ id: 'c1', from: 'a', to: 'b', travelTime: 1 }]
      );

      // Cost based on Manhattan distance
      const distanceCost = (_conn: Connection, from: Node, to: Node) =>
        Math.abs(to.position.x - from.position.x) +
        Math.abs(to.position.y - from.position.y);

      const path = findPath(world, 'a', 'b', distanceCost);

      expect(path!.totalCost).toBe(200);
    });
  });

  describe('cumulative costs in steps', () => {
    it('includes correct cumulative cost at each step', () => {
      const world = buildWorld(
        [
          { id: 'a', x: 0, y: 0, connectionIds: ['c1'] },
          { id: 'b', x: 1, y: 0, connectionIds: ['c1', 'c2'] },
          { id: 'c', x: 2, y: 0, connectionIds: ['c2', 'c3'] },
          { id: 'd', x: 3, y: 0, connectionIds: ['c3'] },
        ],
        [
          { id: 'c1', from: 'a', to: 'b', travelTime: 2 },
          { id: 'c2', from: 'b', to: 'c', travelTime: 3 },
          { id: 'c3', from: 'c', to: 'd', travelTime: 5 },
        ]
      );

      const path = findPath(world, 'a', 'd');

      expect(path!.steps[0].cumulativeCost).toBe(2);  // a -> b
      expect(path!.steps[1].cumulativeCost).toBe(5);  // a -> b -> c
      expect(path!.steps[2].cumulativeCost).toBe(10); // a -> b -> c -> d
    });
  });
});

// === CONNECTION DISCOVERY ===

describe('getNeighbors', () => {
  it('returns directly connected nodes', () => {
    const world = buildWorld(
      [
        { id: 'a', x: 0, y: 0, connectionIds: ['c1', 'c2'] },
        { id: 'b', x: 1, y: 0, connectionIds: ['c1'] },
        { id: 'c', x: 0, y: 1, connectionIds: ['c2'] },
        { id: 'd', x: 2, y: 2, connectionIds: [] }, // Not connected
      ],
      [
        { id: 'c1', from: 'a', to: 'b' },
        { id: 'c2', from: 'a', to: 'c' },
      ]
    );

    const neighbors = getNeighbors(world, 'a');

    expect(neighbors).toHaveLength(2);
    const ids = neighbors.map(n => n.id);
    expect(ids).toContain('b');
    expect(ids).toContain('c');
    expect(ids).not.toContain('d');
  });

  it('returns empty array for isolated node', () => {
    const world = buildWorld(
      [{ id: 'a', x: 0, y: 0, connectionIds: [] }],
      []
    );

    const neighbors = getNeighbors(world, 'a');

    expect(neighbors).toHaveLength(0);
  });

  it('returns empty array for non-existent node', () => {
    const world = buildWorld([], []);

    const neighbors = getNeighbors(world, 'nonexistent');

    expect(neighbors).toHaveLength(0);
  });

  it('excludes neighbors via inactive connections', () => {
    const world = buildWorld(
      [
        { id: 'a', x: 0, y: 0, connectionIds: ['c1', 'c2'] },
        { id: 'b', x: 1, y: 0, connectionIds: ['c1'] },
        { id: 'c', x: 0, y: 1, connectionIds: ['c2'] },
      ],
      [
        { id: 'c1', from: 'a', to: 'b', isActive: false },
        { id: 'c2', from: 'a', to: 'c', isActive: true },
      ]
    );

    const neighbors = getNeighbors(world, 'a');

    expect(neighbors).toHaveLength(1);
    expect(neighbors[0].id).toBe('c');
  });

  it('works with bidirectional connections', () => {
    const world = buildWorld(
      [
        { id: 'a', x: 0, y: 0, connectionIds: ['c1'] },
        { id: 'b', x: 1, y: 0, connectionIds: ['c1'] },
      ],
      [{ id: 'c1', from: 'a', to: 'b' }]
    );

    const neighborsOfA = getNeighbors(world, 'a');
    const neighborsOfB = getNeighbors(world, 'b');

    expect(neighborsOfA[0].id).toBe('b');
    expect(neighborsOfB[0].id).toBe('a');
  });
});

describe('getNeighborsWithCosts', () => {
  it('returns neighbors with their connection costs', () => {
    const world = buildWorld(
      [
        { id: 'a', x: 0, y: 0, connectionIds: ['c1', 'c2'] },
        { id: 'b', x: 1, y: 0, connectionIds: ['c1'] },
        { id: 'c', x: 0, y: 1, connectionIds: ['c2'] },
      ],
      [
        { id: 'c1', from: 'a', to: 'b', travelTime: 5 },
        { id: 'c2', from: 'a', to: 'c', travelTime: 10 },
      ]
    );

    const neighbors = getNeighborsWithCosts(world, 'a');

    expect(neighbors).toHaveLength(2);
    const bNeighbor = neighbors.find(n => n.node.id === 'b');
    const cNeighbor = neighbors.find(n => n.node.id === 'c');
    expect(bNeighbor?.cost).toBe(5);
    expect(cNeighbor?.cost).toBe(10);
  });

  it('includes connection IDs', () => {
    const world = buildWorld(
      [
        { id: 'a', x: 0, y: 0, connectionIds: ['c1'] },
        { id: 'b', x: 1, y: 0, connectionIds: ['c1'] },
      ],
      [{ id: 'c1', from: 'a', to: 'b', travelTime: 5 }]
    );

    const neighbors = getNeighborsWithCosts(world, 'a');

    expect(neighbors[0].connectionId).toBe('c1');
  });
});

describe('getReachableNodes', () => {
  it('returns all reachable nodes without cost limit', () => {
    const world = buildWorld(
      [
        { id: 'a', x: 0, y: 0, connectionIds: ['c1'] },
        { id: 'b', x: 1, y: 0, connectionIds: ['c1', 'c2'] },
        { id: 'c', x: 2, y: 0, connectionIds: ['c2'] },
      ],
      [
        { id: 'c1', from: 'a', to: 'b', travelTime: 5 },
        { id: 'c2', from: 'b', to: 'c', travelTime: 10 },
      ]
    );

    const reachable = getReachableNodes(world, 'a');

    expect(reachable).toHaveLength(2);
    expect(reachable.map(r => r.node.id)).toContain('b');
    expect(reachable.map(r => r.node.id)).toContain('c');
  });

  it('respects maxCost budget', () => {
    const world = buildWorld(
      [
        { id: 'a', x: 0, y: 0, connectionIds: ['c1'] },
        { id: 'b', x: 1, y: 0, connectionIds: ['c1', 'c2'] },
        { id: 'c', x: 2, y: 0, connectionIds: ['c2'] },
      ],
      [
        { id: 'c1', from: 'a', to: 'b', travelTime: 5 },
        { id: 'c2', from: 'b', to: 'c', travelTime: 10 },
      ]
    );

    const reachable = getReachableNodes(world, 'a', 7);

    expect(reachable).toHaveLength(1);
    expect(reachable[0].node.id).toBe('b');
    expect(reachable[0].cost).toBe(5);
  });

  it('excludes starting node from results', () => {
    const world = buildWorld(
      [
        { id: 'a', x: 0, y: 0, connectionIds: ['c1'] },
        { id: 'b', x: 1, y: 0, connectionIds: ['c1'] },
      ],
      [{ id: 'c1', from: 'a', to: 'b', travelTime: 5 }]
    );

    const reachable = getReachableNodes(world, 'a');

    expect(reachable.map(r => r.node.id)).not.toContain('a');
  });

  it('returns empty array for isolated node', () => {
    const world = buildWorld(
      [{ id: 'a', x: 0, y: 0, connectionIds: [] }],
      []
    );

    const reachable = getReachableNodes(world, 'a');

    expect(reachable).toHaveLength(0);
  });

  it('returns sorted by cost', () => {
    const world = buildWorld(
      [
        { id: 'a', x: 0, y: 0, connectionIds: ['c1', 'c2', 'c3'] },
        { id: 'b', x: 1, y: 0, connectionIds: ['c1'] },
        { id: 'c', x: 0, y: 1, connectionIds: ['c2'] },
        { id: 'd', x: 1, y: 1, connectionIds: ['c3'] },
      ],
      [
        { id: 'c1', from: 'a', to: 'b', travelTime: 10 },
        { id: 'c2', from: 'a', to: 'c', travelTime: 5 },
        { id: 'c3', from: 'a', to: 'd', travelTime: 15 },
      ]
    );

    const reachable = getReachableNodes(world, 'a');

    expect(reachable[0].node.id).toBe('c'); // cost 5
    expect(reachable[1].node.id).toBe('b'); // cost 10
    expect(reachable[2].node.id).toBe('d'); // cost 15
  });

  it('finds shortest path cost in graph with cycles', () => {
    // a -> b (cost 1), b -> c (cost 1), c -> a (cost 100)
    // Going a -> b -> c should cost 2, not going through cycle
    const world = buildWorld(
      [
        { id: 'a', x: 0, y: 0, connectionIds: ['ab', 'ca'] },
        { id: 'b', x: 1, y: 0, connectionIds: ['ab', 'bc'] },
        { id: 'c', x: 2, y: 0, connectionIds: ['bc', 'ca'] },
      ],
      [
        { id: 'ab', from: 'a', to: 'b', travelTime: 1 },
        { id: 'bc', from: 'b', to: 'c', travelTime: 1 },
        { id: 'ca', from: 'c', to: 'a', travelTime: 100 },
      ]
    );

    const reachable = getReachableNodes(world, 'a');

    const cResult = reachable.find(r => r.node.id === 'c');
    expect(cResult?.cost).toBe(2); // Should be via b, not cycle
  });
});

describe('areNodesConnected', () => {
  it('returns true for directly connected nodes', () => {
    const world = buildWorld(
      [
        { id: 'a', x: 0, y: 0, connectionIds: ['c1'] },
        { id: 'b', x: 1, y: 0, connectionIds: ['c1'] },
      ],
      [{ id: 'c1', from: 'a', to: 'b' }]
    );

    expect(areNodesConnected(world, 'a', 'b')).toBe(true);
  });

  it('returns true for indirectly connected nodes', () => {
    const world = buildWorld(
      [
        { id: 'a', x: 0, y: 0, connectionIds: ['c1'] },
        { id: 'b', x: 1, y: 0, connectionIds: ['c1', 'c2'] },
        { id: 'c', x: 2, y: 0, connectionIds: ['c2'] },
      ],
      [
        { id: 'c1', from: 'a', to: 'b' },
        { id: 'c2', from: 'b', to: 'c' },
      ]
    );

    expect(areNodesConnected(world, 'a', 'c')).toBe(true);
  });

  it('returns false for disconnected nodes', () => {
    const world = buildWorld(
      [
        { id: 'a', x: 0, y: 0, connectionIds: [] },
        { id: 'b', x: 1, y: 0, connectionIds: [] },
      ],
      []
    );

    expect(areNodesConnected(world, 'a', 'b')).toBe(false);
  });

  it('returns true for same node', () => {
    const world = buildWorld(
      [{ id: 'a', x: 0, y: 0, connectionIds: [] }],
      []
    );

    expect(areNodesConnected(world, 'a', 'a')).toBe(true);
  });
});

describe('getConnectionsBetween', () => {
  it('returns connections between two nodes', () => {
    const world = buildWorld(
      [
        { id: 'a', x: 0, y: 0, connectionIds: ['c1'] },
        { id: 'b', x: 1, y: 0, connectionIds: ['c1'] },
      ],
      [{ id: 'c1', from: 'a', to: 'b' }]
    );

    const connections = getConnectionsBetween(world, 'a', 'b');

    expect(connections).toHaveLength(1);
    expect(connections[0].id).toBe('c1');
  });

  it('returns multiple connections if they exist', () => {
    let world = buildWorld(
      [
        { id: 'a', x: 0, y: 0, connectionIds: ['c1', 'c2'] },
        { id: 'b', x: 1, y: 0, connectionIds: ['c1', 'c2'] },
      ],
      [
        { id: 'c1', from: 'a', to: 'b', travelTime: 1 },
        { id: 'c2', from: 'a', to: 'b', travelTime: 5 },
      ]
    );

    const connections = getConnectionsBetween(world, 'a', 'b');

    expect(connections).toHaveLength(2);
  });

  it('returns empty array for non-adjacent nodes', () => {
    const world = buildWorld(
      [
        { id: 'a', x: 0, y: 0, connectionIds: ['c1'] },
        { id: 'b', x: 1, y: 0, connectionIds: ['c1', 'c2'] },
        { id: 'c', x: 2, y: 0, connectionIds: ['c2'] },
      ],
      [
        { id: 'c1', from: 'a', to: 'b' },
        { id: 'c2', from: 'b', to: 'c' },
      ]
    );

    const connections = getConnectionsBetween(world, 'a', 'c');

    expect(connections).toHaveLength(0);
  });

  it('works regardless of argument order', () => {
    const world = buildWorld(
      [
        { id: 'a', x: 0, y: 0, connectionIds: ['c1'] },
        { id: 'b', x: 1, y: 0, connectionIds: ['c1'] },
      ],
      [{ id: 'c1', from: 'a', to: 'b' }]
    );

    const ab = getConnectionsBetween(world, 'a', 'b');
    const ba = getConnectionsBetween(world, 'b', 'a');

    expect(ab).toHaveLength(1);
    expect(ba).toHaveLength(1);
    expect(ab[0].id).toBe(ba[0].id);
  });

  it('returns empty for non-existent node', () => {
    const world = buildWorld([], []);

    const connections = getConnectionsBetween(world, 'nonexistent', 'also-nonexistent');

    expect(connections).toHaveLength(0);
  });
});

// === EDGE CASES ===

describe('edge cases', () => {
  describe('empty graph', () => {
    it('handles empty world', () => {
      const world = createGameWorld('empty');

      expect(getNeighbors(world, 'any')).toHaveLength(0);
      expect(findPath(world, 'a', 'b')).toBeNull();
      expect(getReachableNodes(world, 'a')).toHaveLength(0);
    });
  });

  describe('single node', () => {
    it('handles single isolated node', () => {
      const world = buildWorld(
        [{ id: 'lonely', x: 0, y: 0, connectionIds: [] }],
        []
      );

      expect(getNeighbors(world, 'lonely')).toHaveLength(0);
      expect(findPath(world, 'lonely', 'lonely')?.totalCost).toBe(0);
      expect(getReachableNodes(world, 'lonely')).toHaveLength(0);
    });
  });

  describe('cycles', () => {
    it('handles simple cycle', () => {
      // a -- b -- c -- a (triangle)
      // All connections are bidirectional, so a can reach c directly (cost 1)
      // or via b (cost 2). It should find cost 1.
      const world = buildWorld(
        [
          { id: 'a', x: 0, y: 0, connectionIds: ['ab', 'ca'] },
          { id: 'b', x: 1, y: 0, connectionIds: ['ab', 'bc'] },
          { id: 'c', x: 1, y: 1, connectionIds: ['bc', 'ca'] },
        ],
        [
          { id: 'ab', from: 'a', to: 'b', travelTime: 1 },
          { id: 'bc', from: 'b', to: 'c', travelTime: 1 },
          { id: 'ca', from: 'c', to: 'a', travelTime: 1 },
        ]
      );

      const path = findPath(world, 'a', 'c');

      expect(path).not.toBeNull();
      // Direct path a -> c via ca connection (cost 1)
      expect(path!.totalCost).toBe(1);
    });

    it('finds optimal path avoiding expensive cycle edges', () => {
      // a -- b -- c, with a slow shortcut a -- c (cost 100)
      const world = buildWorld(
        [
          { id: 'a', x: 0, y: 0, connectionIds: ['ab', 'ac'] },
          { id: 'b', x: 1, y: 0, connectionIds: ['ab', 'bc'] },
          { id: 'c', x: 2, y: 0, connectionIds: ['bc', 'ac'] },
        ],
        [
          { id: 'ab', from: 'a', to: 'b', travelTime: 1 },
          { id: 'bc', from: 'b', to: 'c', travelTime: 1 },
          { id: 'ac', from: 'a', to: 'c', travelTime: 100 }, // expensive direct
        ]
      );

      const path = findPath(world, 'a', 'c');

      expect(path).not.toBeNull();
      // Should go a -> b -> c (cost 2), not a -> c (cost 100)
      expect(path!.totalCost).toBe(2);
      expect(path!.steps).toHaveLength(2);
    });
  });

  describe('large graph performance', () => {
    it('handles moderately large graph (100 nodes)', () => {
      // Create a grid of 10x10 nodes with connections
      const nodes: Array<{ id: string; x: number; y: number; connectionIds: string[] }> = [];
      const connections: Array<{ id: string; from: string; to: string; travelTime: number }> = [];

      for (let x = 0; x < 10; x++) {
        for (let y = 0; y < 10; y++) {
          const id = `n${x}_${y}`;
          const connIds: string[] = [];

          // Right connection
          if (x < 9) {
            const rightId = `conn_${x}_${y}_right`;
            connIds.push(rightId);
            connections.push({ id: rightId, from: id, to: `n${x + 1}_${y}`, travelTime: 1 });
          }
          // Down connection
          if (y < 9) {
            const downId = `conn_${x}_${y}_down`;
            connIds.push(downId);
            connections.push({ id: downId, from: id, to: `n${x}_${y + 1}`, travelTime: 1 });
          }
          // Add reverse connections to connectionIds
          if (x > 0) {
            connIds.push(`conn_${x - 1}_${y}_right`);
          }
          if (y > 0) {
            connIds.push(`conn_${x}_${y - 1}_down`);
          }

          nodes.push({ id, x, y, connectionIds: connIds });
        }
      }

      const world = buildWorld(nodes, connections);

      const start = performance.now();
      const path = findPath(world, 'n0_0', 'n9_9');
      const duration = performance.now() - start;

      expect(path).not.toBeNull();
      expect(path!.totalCost).toBe(18); // Manhattan distance in unit grid
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
    });
  });
});

// === DETERMINISM ===

describe('determinism', () => {
  it('findPath produces identical results on repeated calls', () => {
    const world = buildWorld(
      [
        { id: 'a', x: 0, y: 0, connectionIds: ['c1', 'c2'] },
        { id: 'b', x: 1, y: 0, connectionIds: ['c1', 'c3'] },
        { id: 'c', x: 0, y: 1, connectionIds: ['c2', 'c4'] },
        { id: 'd', x: 1, y: 1, connectionIds: ['c3', 'c4', 'c5'] },
        { id: 'e', x: 2, y: 1, connectionIds: ['c5'] },
      ],
      [
        { id: 'c1', from: 'a', to: 'b', travelTime: 1 },
        { id: 'c2', from: 'a', to: 'c', travelTime: 1 },
        { id: 'c3', from: 'b', to: 'd', travelTime: 1 },
        { id: 'c4', from: 'c', to: 'd', travelTime: 1 },
        { id: 'c5', from: 'd', to: 'e', travelTime: 1 },
      ]
    );

    const results = [];
    for (let i = 0; i < 10; i++) {
      results.push(findPath(world, 'a', 'e'));
    }

    const result1 = results[0];
    for (const result of results) {
      expect(result).toEqual(result1);
    }
  });

  it('getReachableNodes produces identical order on repeated calls', () => {
    const world = buildWorld(
      [
        { id: 'a', x: 0, y: 0, connectionIds: ['c1', 'c2', 'c3'] },
        { id: 'b', x: 1, y: 0, connectionIds: ['c1'] },
        { id: 'c', x: 0, y: 1, connectionIds: ['c2'] },
        { id: 'd', x: 1, y: 1, connectionIds: ['c3'] },
      ],
      [
        { id: 'c1', from: 'a', to: 'b', travelTime: 5 },
        { id: 'c2', from: 'a', to: 'c', travelTime: 5 },
        { id: 'c3', from: 'a', to: 'd', travelTime: 5 },
      ]
    );

    const results: ReturnType<typeof getReachableNodes>[] = [];
    for (let i = 0; i < 10; i++) {
      results.push(getReachableNodes(world, 'a'));
    }

    const result1 = results[0];
    for (const result of results) {
      expect(result.map(r => r.node.id)).toEqual(result1.map(r => r.node.id));
    }
  });

  it('equal-cost paths should be deterministic', () => {
    // Multiple paths with identical costs - should always pick the same one
    const world = buildWorld(
      [
        { id: 'a', x: 0, y: 0, connectionIds: ['ab', 'ac'] },
        { id: 'b', x: 1, y: 0, connectionIds: ['ab', 'bd'] },
        { id: 'c', x: 0, y: 1, connectionIds: ['ac', 'cd'] },
        { id: 'd', x: 1, y: 1, connectionIds: ['bd', 'cd'] },
      ],
      [
        { id: 'ab', from: 'a', to: 'b', travelTime: 1 },
        { id: 'ac', from: 'a', to: 'c', travelTime: 1 },
        { id: 'bd', from: 'b', to: 'd', travelTime: 1 },
        { id: 'cd', from: 'c', to: 'd', travelTime: 1 },
      ]
    );

    const paths = [];
    for (let i = 0; i < 20; i++) {
      paths.push(findPath(world, 'a', 'd'));
    }

    const path1 = paths[0];
    for (const path of paths) {
      expect(path!.steps.map((s: any) => s.nodeId)).toEqual(path1!.steps.map((s: any) => s.nodeId));
    }
  });

  it('gateway activation is deterministic', () => {
    const gateway = makeGateway('g1', 'a', 'b', 5, [
      { type: ResourceType.Energy, amount: 25 },
    ], 10);
    const node = makeNode('a', { x: 0, y: 0 }, ['g1'], [
      createResource(ResourceType.Energy, 100, 0, 1000),
    ]);

    const results: ReturnType<typeof activateGateway>[] = [];
    for (let i = 0; i < 10; i++) {
      results.push(activateGateway(gateway, node, 5));
    }

    for (const result of results) {
      expect(result.gateway).toEqual(results[0].gateway);
      expect(result.node).toEqual(results[0].node);
      expect(result.events).toEqual(results[0].events);
    }
  });
});

// === PURE FUNCTION VERIFICATION ===

describe('pure function verification', () => {
  it('canTraverse does not mutate connection', () => {
    const conn = makeConnection('c1', 'a', 'b', 5, true);
    const original = { ...conn };

    canTraverse(conn);

    expect(conn).toEqual(original);
  });

  it('activateGateway does not mutate inputs', () => {
    const gateway = makeGateway('g1', 'a', 'b', 1, [
      { type: ResourceType.Energy, amount: 25 },
    ], 10);
    const node = makeNode('a', { x: 0, y: 0 }, ['g1'], [
      createResource(ResourceType.Energy, 100, 0, 1000),
    ]);

    const originalGateway = JSON.parse(JSON.stringify(gateway));
    const originalNode = JSON.parse(JSON.stringify(node));

    activateGateway(gateway, node, 5);

    expect(gateway).toEqual(originalGateway);
    expect(node).toEqual(originalNode);
  });

  it('findPath does not mutate world', () => {
    const world = buildWorld(
      [
        { id: 'a', x: 0, y: 0, connectionIds: ['c1'] },
        { id: 'b', x: 1, y: 0, connectionIds: ['c1'] },
      ],
      [{ id: 'c1', from: 'a', to: 'b' }]
    );
    const originalWorld = JSON.parse(JSON.stringify(world));

    findPath(world, 'a', 'b');

    expect(world).toEqual(originalWorld);
  });
});
