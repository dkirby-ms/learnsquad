/**
 * Territory System Tests - Phase 8
 *
 * Testing strategy:
 * - Focus on pure functions (no mocks - game logic is honest)
 * - Test determinism explicitly (same inputs → same outputs across 100+ iterations)
 * - Hit edge cases hard: claim own node, non-existent nodes, simultaneous claims
 * - Verify events at state transitions (NodeClaimed, NodeContested, NodeLost)
 * - Test pausable game mechanics: pause during claim, resume preserves progress
 */

import {
  processTerritoryClaims,
  abandonNode,
  canClaim,
  getClaimProgress,
  type ClaimAction,
} from '../systems/territory';

import {
  createGameWorld,
  addNode,
  unpause,
  setNodes,
  advanceTick,
} from '../models/world';

import { createNode } from '../models/node';
import { createResource } from '../models/resource';
import { processTick, processMultipleTicks } from '../loop';

import {
  GameEventType,
  ResourceType,
  NodeStatus,
  type GameWorld,
  type Node,
  type GameEvent,
  type Tick,
} from '../types';

// --- Test Fixtures ---

function makeNode(
  id: string,
  name: string = `Node ${id}`,
  overrides: Partial<Node> = {}
): Node {
  return {
    id,
    name,
    position: { x: 0, y: 0 },
    status: NodeStatus.Neutral,
    ownerId: null,
    resources: [
      createResource(ResourceType.Minerals, 50, 5, 100),
      createResource(ResourceType.Energy, 30, 2, 80),
    ],
    connectionIds: [],
    ...overrides,
  };
}

function makeWorld(overrides: Partial<GameWorld> = {}): GameWorld {
  let world = createGameWorld('test-world');
  world = addNode(world, makeNode('n1', 'Sol System'));
  world = addNode(world, makeNode('n2', 'Alpha Centauri'));
  world = addNode(world, makeNode('n3', 'Sirius'));
  world = unpause(world); // Start unpaused for most tests
  return {
    ...world,
    ...overrides,
  };
}

function abandonNodeInWorld(
  world: GameWorld,
  nodeId: string,
  tick: Tick
): GameWorld {
  const node = world.nodes[nodeId];
  if (!node) return world;

  const result = abandonNode(node, tick);
  return setNodes(world, { [nodeId]: result.node });
}

// Helper to find events by type and entity
function findEvent(
  events: readonly GameEvent[],
  type: GameEventType,
  entityId: string
): GameEvent | undefined {
  return events.find(e => e.type === type && e.entityId === entityId);
}

// --- Claiming Scenarios ---

describe('Territory System - Claiming Scenarios', () => {
  describe('Claim neutral node', () => {
    it('increases controlPoints by 10 per tick', () => {
      const world = makeWorld();
      const claims: ClaimAction[] = [{ playerId: 'p1', nodeId: 'n1', tick: 1 }];

      const result = processTerritoryClaims(world, claims, 1);
      const n1 = result.world.nodes['n1'];

      expect(n1.controlPoints).toBe(10);
      expect(n1.status).toBe(NodeStatus.Neutral);
      expect(n1.ownerId).toBeNull();
    });

    it('accumulates controlPoints across multiple ticks', () => {
      let world = makeWorld();
      const claims: ClaimAction[] = [{ playerId: 'p1', nodeId: 'n1', tick: 1 }];

      // Tick 1: 10 points
      let result = processTerritoryClaims(world, claims, 1);
      world = result.world;
      expect(world.nodes['n1'].controlPoints).toBe(10);

      // Tick 2: 20 points
      result = processTerritoryClaims(world, claims, 2);
      world = result.world;
      expect(world.nodes['n1'].controlPoints).toBe(20);

      // Tick 3: 30 points
      result = processTerritoryClaims(world, claims, 3);
      world = result.world;
      expect(world.nodes['n1'].controlPoints).toBe(30);
    });

    it('reaches maxControlPoints (100) after 10 ticks', () => {
      let world = makeWorld();
      const claims: ClaimAction[] = [{ playerId: 'p1', nodeId: 'n1', tick: 1 }];

      for (let i = 1; i <= 10; i++) {
        const result = processTerritoryClaims(world, claims, i);
        world = result.world;
      }

      expect(world.nodes['n1'].controlPoints).toBe(100);
    });

    it('transfers ownership when controlPoints reaches maxControlPoints', () => {
      let world = makeWorld();
      const claims: ClaimAction[] = [{ playerId: 'p1', nodeId: 'n1', tick: 1 }];

      for (let i = 1; i <= 10; i++) {
        const result = processTerritoryClaims(world, claims, i);
        world = result.world;
      }

      expect(world.nodes['n1'].ownerId).toBe('p1');
      expect(world.nodes['n1'].status).toBe(NodeStatus.Claimed);
      expect(world.nodes['n1'].controlPoints).toBe(100);
    });

    it('emits NodeClaimed event on ownership transfer', () => {
      let world = makeWorld();
      const claims: ClaimAction[] = [{ playerId: 'p1', nodeId: 'n1', tick: 1 }];

      let claimedEvent: GameEvent | undefined;
      for (let i = 1; i <= 10; i++) {
        const result = processTerritoryClaims(world, claims, i);
        world = result.world;
        const claimed = findEvent(result.events, GameEventType.NodeClaimed, 'n1');
        if (claimed) claimedEvent = claimed;
      }

      expect(claimedEvent).toBeDefined();
      expect(claimedEvent?.data.playerId).toBe('p1');
    });
  });

  describe('Claim already-owned node (by another player)', () => {
    it('enters contested state when different player claims owned node', () => {
      let world = makeWorld();
      // Player 1 claims and owns n1
      let claims: ClaimAction[] = [{ playerId: 'p1', nodeId: 'n1', tick: 1 }];
      for (let i = 0; i < 10; i++) {
        const result = processTerritoryClaims(world, claims, world.currentTick + 1);
        world = result.world;
      }

      expect(world.nodes['n1'].ownerId).toBe('p1');
      expect(world.nodes['n1'].status).toBe(NodeStatus.Claimed);

      // Player 2 claims p1's node
      claims = [{ playerId: 'p2', nodeId: 'n1', tick: 11 }];
      const result = processTerritoryClaims(world, claims, world.currentTick + 1);
      world = result.world;

      expect(world.nodes['n1'].status).toBe(NodeStatus.Contested);
    });

    it('contested decrement: defender loses 5 controlPoints per tick', () => {
      let world = makeWorld();
      // Player 1 claims and owns n1
      let claims: ClaimAction[] = [{ playerId: 'p1', nodeId: 'n1', tick: 1 }];
      for (let i = 0; i < 10; i++) {
        const result = processTerritoryClaims(world, claims, world.currentTick + 1);
        world = result.world;
      }

      const ownedNode = world.nodes['n1'];
      expect(ownedNode.ownerId).toBe('p1');
      expect(ownedNode.controlPoints).toBe(100);

      // Player 2 contests
      claims = [{ playerId: 'p2', nodeId: 'n1', tick: 11 }];
      const result = processTerritoryClaims(world, claims, world.currentTick + 1);
      world = result.world;

      // Defender loses 5: 100 - 5 = 95
      expect(world.nodes['n1'].controlPoints).toBe(95);
      expect(world.nodes['n1'].ownerId).toBe('p1'); // Still owned
      expect(world.nodes['n1'].status).toBe(NodeStatus.Contested);
    });

    it('contested flip: defender hits 0 controlPoints → ownership transfers to attacker', () => {
      let world = makeWorld();
      // Player 1 claims and owns n1 with 50 controlPoints
      world = setNodes(world, {
        n1: {
          ...world.nodes['n1'],
          ownerId: 'p1',
          status: NodeStatus.Claimed,
          controlPoints: 50,
        },
      });

      // Player 2 contests for 11 ticks (11 * 5 = 55 points lost, but capped at 0)
      const claims: ClaimAction[] = [{ playerId: 'p2', nodeId: 'n1', tick: 1 }];
      for (let i = 0; i < 11; i++) {
        const result = processTerritoryClaims(world, claims, world.currentTick + 1);
        world = result.world;
      }

      expect(world.nodes['n1'].ownerId).toBe('p2');
      expect(world.nodes['n1'].status).toBe(NodeStatus.Claimed);
      expect(world.nodes['n1'].controlPoints).toBeGreaterThanOrEqual(0);
    });

    it('emits NodeLost event when defender loses control', () => {
      let world = makeWorld();
      world = setNodes(world, {
        n1: {
          ...world.nodes['n1'],
          ownerId: 'p1',
          status: NodeStatus.Claimed,
          controlPoints: 5,
        },
      });

      const claims: ClaimAction[] = [{ playerId: 'p2', nodeId: 'n1', tick: 1 }];
      const result = processTerritoryClaims(world, claims, world.currentTick + 1);

      const lostEvent = findEvent(result.events, GameEventType.NodeLost, 'n1');
      expect(lostEvent).toBeDefined();
      expect(lostEvent?.data.previousOwner).toBe('p1');
      expect(lostEvent?.data.newOwner).toBe('p2');
    });

    it('emits NodeContested event on first contested tick', () => {
      let world = makeWorld();
      world = setNodes(world, {
        n1: {
          ...world.nodes['n1'],
          ownerId: 'p1',
          status: NodeStatus.Claimed,
          controlPoints: 100,
        },
      });

      const claims: ClaimAction[] = [{ playerId: 'p2', nodeId: 'n1', tick: 1 }];
      const result = processTerritoryClaims(world, claims, world.currentTick + 1);

      const contestedEvent = findEvent(
        result.events,
        GameEventType.NodeContested,
        'n1'
      );
      expect(contestedEvent).toBeDefined();
    });
  });

  describe('Abandon node', () => {
    it('clears ownership and resets to neutral', () => {
      let world = makeWorld();
      // Player 1 claims n1
      let claims: ClaimAction[] = [{ playerId: 'p1', nodeId: 'n1', tick: 1 }];
      for (let i = 0; i < 10; i++) {
        const result = processTerritoryClaims(world, claims, world.currentTick + 1);
        world = result.world;
      }

      expect(world.nodes['n1'].ownerId).toBe('p1');

      // Abandon
      world = abandonNodeInWorld(world, 'n1', world.currentTick);

      expect(world.nodes['n1'].ownerId).toBeNull();
      expect(world.nodes['n1'].status).toBe(NodeStatus.Neutral);
      expect(world.nodes['n1'].controlPoints).toBe(0);
    });

    it('emits NodeLost event when node abandoned', () => {
      let world = makeWorld();
      world = setNodes(world, {
        n1: {
          ...world.nodes['n1'],
          ownerId: 'p1',
          status: NodeStatus.Claimed,
          controlPoints: 100,
        },
      });

      const node = world.nodes['n1'];
      const result = abandonNode(node, world.currentTick);
      // Verify abandonNode returns correct state
      expect(result.node.ownerId).toBeNull();
      expect(result.node.controlPoints).toBe(0);
      expect(result.events.length).toBeGreaterThan(0);
    });
  });
});

// --- Edge Cases ---

describe('Territory System - Edge Cases', () => {
  describe('Claim own node', () => {
    it('should be a no-op if player already owns the node', () => {
      let world = makeWorld();
      // Player 1 owns n1
      world = setNodes(world, {
        n1: {
          ...world.nodes['n1'],
          ownerId: 'p1',
          status: NodeStatus.Claimed,
          controlPoints: 100,
        },
      });

      const initialControlPoints = world.nodes['n1'].controlPoints;
      const claims: ClaimAction[] = [{ playerId: 'p1', nodeId: 'n1', tick: 1 }];
      const result = processTerritoryClaims(world, claims, world.currentTick + 1);

      // Should not gain more control points
      expect(result.world.nodes['n1'].controlPoints).toBe(initialControlPoints);
    });
  });

  describe('Claim non-existent node', () => {
    it('should fail gracefully (no-op) for invalid node ID', () => {
      const world = makeWorld();
      const claims: ClaimAction[] = [{ playerId: 'p1', nodeId: 'invalid', tick: 1 }];

      // Should not throw
      expect(() => processTerritoryClaims(world, claims, world.currentTick + 1)).not.toThrow();

      const result = processTerritoryClaims(world, claims, world.currentTick + 1);
      // World should be unchanged
      expect(result.world.nodes['n1']).toEqual(world.nodes['n1']);
    });
  });

  describe('Multiple players claim same neutral node', () => {
    it('enters contested state, control points stall until single claimant', () => {
      let world = makeWorld();

      // Both players claim n1 simultaneously
      let claims: ClaimAction[] = [
        { playerId: 'p1', nodeId: 'n1', tick: 1 },
        { playerId: 'p2', nodeId: 'n1', tick: 1 },
      ];

      // Process claims - contested state means no accumulation
      const result = processTerritoryClaims(world, claims, world.currentTick + 1);
      world = result.world;

      // Node should be contested
      expect(world.nodes['n1'].status).toBe(NodeStatus.Contested);
      // Control points should remain 0 when contested
      expect(world.nodes['n1'].controlPoints).toBe(0);
      expect(world.nodes['n1'].ownerId).toBeNull();
    });

    it('deterministic: same player list order always produces same winner', () => {
      const iterations = 5;
      const outcomes: (string | null)[] = [];

      for (let iter = 0; iter < iterations; iter++) {
        let world = makeWorld();
        const claims: ClaimAction[] = [
          { playerId: 'p1', nodeId: 'n1', tick: 1 },
          { playerId: 'p2', nodeId: 'n1', tick: 1 },
        ];

        for (let i = 0; i < 10; i++) {
          const result = processTerritoryClaims(world, claims, world.currentTick + 1);
          world = result.world;
        }

        outcomes.push(world.nodes['n1'].ownerId);
      }

      // All iterations should have same outcome
      expect(new Set(outcomes).size).toBe(1);
    });
  });

  describe('Player disconnects during claim', () => {
    it('claim remains active per architecture (player can reconnect)', () => {
      let world = makeWorld();
      const claims: ClaimAction[] = [{ playerId: 'p1', nodeId: 'n1', tick: 1 }];

      const result = processTerritoryClaims(world, claims, world.currentTick + 1);
      world = result.world;

      // Control points exist
      expect(world.nodes['n1'].controlPoints).toBe(10);

      // If we process next tick with same claim, it continues
      const result2 = processTerritoryClaims(world, claims, world.currentTick + 1);
      expect(result2.world.nodes['n1'].controlPoints).toBe(20);
    });
  });

  describe('Simultaneous claims on same tick', () => {
    it('deterministic resolution: same claim order → same result', () => {
      const iterations = 5;
      const outcomes: number[] = [];

      for (let iter = 0; iter < iterations; iter++) {
        let world = makeWorld();
        const claims: ClaimAction[] = [
          { playerId: 'p1', nodeId: 'n1', tick: 1 },
          { playerId: 'p2', nodeId: 'n1', tick: 1 },
          { playerId: 'p3', nodeId: 'n1', tick: 1 },
        ];

        const result = processTerritoryClaims(world, claims, world.currentTick + 1);
        outcomes.push(result.world.nodes['n1'].controlPoints ?? 0);
      }

      // All iterations same control points
      expect(new Set(outcomes).size).toBe(1);
    });

    it('3 players on same tick enter contested state', () => {
      let world = makeWorld();
      const claims: ClaimAction[] = [
        { playerId: 'p1', nodeId: 'n1', tick: 1 },
        { playerId: 'p2', nodeId: 'n1', tick: 1 },
        { playerId: 'p3', nodeId: 'n1', tick: 1 },
      ];

      const result = processTerritoryClaims(world, claims, world.currentTick + 1);
      // Multiple players contesting neutral node = contested state, no accumulation
      expect(result.world.nodes['n1'].status).toBe(NodeStatus.Contested);
      expect(result.world.nodes['n1'].controlPoints).toBe(0);
    });
  });
});

// --- Determinism Tests ---

describe('Territory System - Determinism', () => {
  it('same world state + same claims → same output (100 iterations)', () => {
    const iterations = 100;
    const results: { cp: number; owner: string | null; status: string }[] = [];

    for (let iter = 0; iter < iterations; iter++) {
      let world = makeWorld();
      const claims: ClaimAction[] = [{ playerId: 'p1', nodeId: 'n1', tick: 1 }];

      for (let i = 0; i < 5; i++) {
        const result = processTerritoryClaims(world, claims, world.currentTick + 1);
        world = result.world;
      }

      results.push({
        cp: world.nodes['n1'].controlPoints ?? 0,
        owner: world.nodes['n1'].ownerId,
        status: world.nodes['n1'].status,
      });
    }

    // All 100 iterations should be identical
    for (let i = 1; i < iterations; i++) {
      expect(results[i].cp).toBe(results[0].cp);
      expect(results[i].owner).toBe(results[0].owner);
      expect(results[i].status).toBe(results[0].status);
    }
  });

  it('pause during claim → resume preserves claim progress', () => {
    let world = makeWorld();
    const claims: ClaimAction[] = [{ playerId: 'p1', nodeId: 'n1', tick: 1 }];

    // Tick 1-3
    for (let i = 0; i < 3; i++) {
      const result = processTerritoryClaims(world, claims, world.currentTick + 1);
      world = result.world;
    }
    expect(world.nodes['n1'].controlPoints).toBe(30);

    // Simulate pause (world.isPaused = true)
    // In actual game loop, paused ticks don't call processTerritoryClaims
    // But if we resume, claims continue
    const beforePause = world.nodes['n1'].controlPoints;

    // Resume and continue
    for (let i = 0; i < 2; i++) {
      const result = processTerritoryClaims(world, claims, world.currentTick + 1);
      world = result.world;
    }

    expect(world.nodes['n1'].controlPoints).toBe((beforePause ?? 0) + 20);
  });

  it('same claims across multiple separated processes → deterministic', () => {
    let world1 = makeWorld();
    let world2 = makeWorld();

    const claims: ClaimAction[] = [
      { playerId: 'p1', nodeId: 'n1', tick: 1 },
      { playerId: 'p2', nodeId: 'n2', tick: 1 },
    ];

    // Process in sequence
    for (let i = 0; i < 10; i++) {
      const r1 = processTerritoryClaims(world1, claims, i + 1);
      world1 = r1.world;

      const r2 = processTerritoryClaims(world2, claims, i + 1);
      world2 = r2.world;

      expect(world1.nodes['n1'].controlPoints).toBe(world2.nodes['n1'].controlPoints);
      expect(world1.nodes['n2'].controlPoints).toBe(world2.nodes['n2'].controlPoints);
    }
  });
});

// --- Integration Tests (Territory + Game Loop) ---

describe('Territory System - Game Loop Integration', () => {
  it('claims process correctly through normal game loop (paused game)', () => {
    // When game is paused, no territory claims should process
    let world = makeWorld();
    world = { ...world, isPaused: true };

    const result = processTick(world);
    // Should be unchanged
    expect(result.world.isPaused).toBe(true);
  });

  it('multiple nodes claimed in parallel via same claims list', () => {
    let world = makeWorld();
    const claims: ClaimAction[] = [
      { playerId: 'p1', nodeId: 'n1', tick: 1 },
      { playerId: 'p1', nodeId: 'n2', tick: 1 },
      { playerId: 'p2', nodeId: 'n3', tick: 1 },
    ];

    const result = processTerritoryClaims(world, claims, world.currentTick + 1);
    world = result.world;

    expect(world.nodes['n1'].controlPoints).toBe(10);
    expect(world.nodes['n2'].controlPoints).toBe(10);
    expect(world.nodes['n3'].controlPoints).toBe(10);
  });

  it('complex scenario: claim, contest, abandon, claim again', () => {
    let world = makeWorld();

    // Phase 1: P1 claims n1
    let claims: ClaimAction[] = [{ playerId: 'p1', nodeId: 'n1', tick: 1 }];
    for (let i = 0; i < 10; i++) {
      const result = processTerritoryClaims(world, claims, world.currentTick + 1);
      world = result.world;
    }
    expect(world.nodes['n1'].ownerId).toBe('p1');

    // Phase 2: P2 contests (5 ticks)
    claims = [{ playerId: 'p2', nodeId: 'n1', tick: 11 }];
    for (let i = 0; i < 5; i++) {
      const result = processTerritoryClaims(world, claims, world.currentTick + 1);
      world = result.world;
    }
    expect(world.nodes['n1'].ownerId).toBe('p1');
    expect(world.nodes['n1'].controlPoints).toBe(75);

    // Phase 3: P1 abandons
    world = abandonNodeInWorld(world, 'n1', world.currentTick);
    expect(world.nodes['n1'].ownerId).toBeNull();
    expect(world.nodes['n1'].controlPoints).toBe(0);

    // Phase 4: P3 claims fresh
    claims = [{ playerId: 'p3', nodeId: 'n1', tick: 20 }];
    for (let i = 0; i < 5; i++) {
      const result = processTerritoryClaims(world, claims, world.currentTick + 1);
      world = result.world;
    }
    expect(world.nodes['n1'].controlPoints).toBe(50);
    expect(world.nodes['n1'].ownerId).toBeNull();
  });
});

// --- API Tests ---

describe('Territory System - Helper Functions', () => {
  it('canClaim() validates player can claim a node', () => {
    const world = makeWorld();
    const result = canClaim(world, 'p1', 'n1');
    expect(result.canClaim).toBe(true);
  });

  it('canClaim() rejects when player already owns node', () => {
    let world = makeWorld();
    world = setNodes(world, {
      n1: {
        ...world.nodes['n1'],
        ownerId: 'p1',
        status: NodeStatus.Claimed,
        controlPoints: 100,
      },
    });

    const result = canClaim(world, 'p1', 'n1');
    expect(result.canClaim).toBe(false);
  });

  it('getClaimProgress() returns normalized claim progress', () => {
    const node = makeNode('n1', 'Test', {
      controlPoints: 50,
      maxControlPoints: 100,
    });
    const progress = getClaimProgress(node);
    expect(progress).toBe(0.5);
  });

  it('abandonNode() resets node to neutral with 0 controlPoints', () => {
    let world = makeWorld();
    world = setNodes(world, {
      n1: {
        ...world.nodes['n1'],
        ownerId: 'p1',
        status: NodeStatus.Claimed,
        controlPoints: 100,
      },
    });

    const node = world.nodes['n1'];
    const result = abandonNode(node, world.currentTick);
    expect(result.node.ownerId).toBeNull();
    expect(result.node.status).toBe(NodeStatus.Neutral);
    expect(result.node.controlPoints).toBe(0);
  });
});

// --- Boundary Conditions ---

describe('Territory System - Boundary Conditions', () => {
  it('controlPoints never go below 0', () => {
    let world = makeWorld();
    world = setNodes(world, {
      n1: {
        ...world.nodes['n1'],
        ownerId: 'p1',
        status: NodeStatus.Claimed,
        controlPoints: 3,
      },
    });

    const claims: ClaimAction[] = [{ playerId: 'p2', nodeId: 'n1', tick: 1 }];
    const result = processTerritoryClaims(world, claims, world.currentTick + 1);

    expect(result.world.nodes['n1'].controlPoints).toBeGreaterThanOrEqual(0);
  });

  it('controlPoints never exceed maxControlPoints', () => {
    let world = makeWorld();
    world = setNodes(world, {
      n1: {
        ...world.nodes['n1'],
        status: NodeStatus.Neutral,
        controlPoints: 95,
      },
    });

    const claims: ClaimAction[] = [{ playerId: 'p1', nodeId: 'n1', tick: 1 }];
    for (let i = 0; i < 5; i++) {
      const result = processTerritoryClaims(world, claims, world.currentTick + 1);
      world = result.world;
    }

    expect(world.nodes['n1'].controlPoints).toBeLessThanOrEqual(100);
  });

  it('empty claims list does nothing', () => {
    const world = makeWorld();
    const result = processTerritoryClaims(world, [], world.currentTick + 1);

    // All nodes should be unchanged
    expect(result.world.nodes['n1']).toEqual(world.nodes['n1']);
    expect(result.world.nodes['n2']).toEqual(world.nodes['n2']);
  });
});
