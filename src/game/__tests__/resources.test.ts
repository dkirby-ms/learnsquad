/**
 * Resource System Tests - Phase 2
 *
 * Testing strategy:
 * - Focus on pure functions (no mocks needed - the code is honest)
 * - Test determinism explicitly (same inputs → same outputs)
 * - Hit edge cases hard: zeros, negatives, boundaries
 * - Verify events are generated at the right moments
 */

import {
  regenerateResources,
  depleteResource,
  addResources,
  clampToCapacity,
  calculateNetRate,
  calculateProductionRate,
  calculateConsumptionRate,
  applyProductionConsumption,
  processNodeResources,
  buildResourceRates,
  hasResources,
  getResourceAmount,
  getResourceCapacity,
  type Producer,
  type Consumer,
} from '../systems/resources';

import {
  ResourceType,
  NodeStatus,
  GameEventType,
  type Node,
  type Resource,
} from '../types';

import { createResource } from '../models/resource';
import { createNode } from '../models/node';

// --- Test Fixtures ---

function makeNode(
  id: string,
  resources: Resource[],
  overrides: Partial<Node> = {}
): Node {
  return {
    id,
    name: `Node ${id}`,
    position: { x: 0, y: 0 },
    status: NodeStatus.Neutral,
    ownerId: null,
    resources,
    connectionIds: [],
    ...overrides,
  };
}

function makeProducer(
  id: string,
  resourceType: ResourceType,
  rate: number,
  isActive: boolean = true
): Producer {
  return { id, resourceType, rate, isActive };
}

function makeConsumer(
  id: string,
  resourceType: ResourceType,
  rate: number,
  isActive: boolean = true
): Consumer {
  return { id, resourceType, rate, isActive };
}

// --- regenerateResources Tests ---

describe('regenerateResources', () => {
  it('regenerates resources at correct rate', () => {
    const minerals = createResource(ResourceType.Minerals, 50, 10, 1000);
    const node = makeNode('n1', [minerals]);

    const result = regenerateResources(node, 1);
    const resultResource = result.resources.find(r => r.type === ResourceType.Minerals);

    expect(resultResource?.amount).toBe(60);
  });

  it('respects capacity limits - does not exceed maxCapacity', () => {
    const minerals = createResource(ResourceType.Minerals, 95, 10, 100);
    const node = makeNode('n1', [minerals]);

    const result = regenerateResources(node, 1);
    const resultResource = result.resources.find(r => r.type === ResourceType.Minerals);

    expect(resultResource?.amount).toBe(100); // Capped at 100
  });

  it('handles zero regeneration rate', () => {
    const minerals = createResource(ResourceType.Minerals, 50, 0, 100);
    const node = makeNode('n1', [minerals]);

    const result = regenerateResources(node, 1);
    const resultResource = result.resources.find(r => r.type === ResourceType.Minerals);

    expect(resultResource?.amount).toBe(50); // No change
  });

  it('handles negative regeneration rate (decay)', () => {
    const minerals = createResource(ResourceType.Minerals, 50, -10, 100);
    const node = makeNode('n1', [minerals]);

    const result = regenerateResources(node, 1);
    const resultResource = result.resources.find(r => r.type === ResourceType.Minerals);

    expect(resultResource?.amount).toBe(40);
  });

  it('does not go below 0 with negative regen', () => {
    const minerals = createResource(ResourceType.Minerals, 5, -10, 100);
    const node = makeNode('n1', [minerals]);

    const result = regenerateResources(node, 1);
    const resultResource = result.resources.find(r => r.type === ResourceType.Minerals);

    expect(resultResource?.amount).toBe(0);
  });

  it('handles empty node (no resources)', () => {
    const node = makeNode('n1', []);

    const result = regenerateResources(node, 1);

    expect(result.resources).toHaveLength(0);
    expect(result.id).toBe('n1');
  });

  it('handles multiple resources independently', () => {
    const minerals = createResource(ResourceType.Minerals, 50, 10, 100);
    const energy = createResource(ResourceType.Energy, 80, -5, 100);
    const node = makeNode('n1', [minerals, energy]);

    const result = regenerateResources(node, 1);

    expect(getResourceAmount(result, ResourceType.Minerals)).toBe(60);
    expect(getResourceAmount(result, ResourceType.Energy)).toBe(75);
  });

  it('is a pure function - does not mutate input', () => {
    const minerals = createResource(ResourceType.Minerals, 50, 10, 100);
    const node = makeNode('n1', [minerals]);
    const originalAmount = node.resources[0].amount;

    regenerateResources(node, 1);

    expect(node.resources[0].amount).toBe(originalAmount);
  });
});

// --- depleteResource Tests ---

describe('depleteResource', () => {
  it('depletes correct amount', () => {
    const minerals = createResource(ResourceType.Minerals, 100, 0, 1000);
    const node = makeNode('n1', [minerals]);

    const result = depleteResource(node, ResourceType.Minerals, 30);
    const resultResource = result.resources.find(r => r.type === ResourceType.Minerals);

    expect(resultResource?.amount).toBe(70);
  });

  it('cannot deplete below 0', () => {
    const minerals = createResource(ResourceType.Minerals, 20, 0, 1000);
    const node = makeNode('n1', [minerals]);

    const result = depleteResource(node, ResourceType.Minerals, 50);
    const resultResource = result.resources.find(r => r.type === ResourceType.Minerals);

    expect(resultResource?.amount).toBe(0);
  });

  it('depleting non-existent resource type leaves node unchanged', () => {
    const minerals = createResource(ResourceType.Minerals, 100, 0, 1000);
    const node = makeNode('n1', [minerals]);

    const result = depleteResource(node, ResourceType.Energy, 50);
    const mineralsResult = result.resources.find(r => r.type === ResourceType.Minerals);

    // Minerals unchanged
    expect(mineralsResult?.amount).toBe(100);
    // No energy resource created
    expect(result.resources.find(r => r.type === ResourceType.Energy)).toBeUndefined();
  });

  it('depleting from empty node returns node unchanged', () => {
    const node = makeNode('n1', []);

    const result = depleteResource(node, ResourceType.Minerals, 50);

    expect(result.resources).toHaveLength(0);
  });

  it('depleting 0 amount changes nothing', () => {
    const minerals = createResource(ResourceType.Minerals, 100, 0, 1000);
    const node = makeNode('n1', [minerals]);

    const result = depleteResource(node, ResourceType.Minerals, 0);
    const resultResource = result.resources.find(r => r.type === ResourceType.Minerals);

    expect(resultResource?.amount).toBe(100);
  });

  it('is a pure function - does not mutate input', () => {
    const minerals = createResource(ResourceType.Minerals, 100, 0, 1000);
    const node = makeNode('n1', [minerals]);

    depleteResource(node, ResourceType.Minerals, 30);

    expect(node.resources[0].amount).toBe(100);
  });

  it('handles multiple resources - only affects target type', () => {
    const minerals = createResource(ResourceType.Minerals, 100, 0, 1000);
    const energy = createResource(ResourceType.Energy, 50, 0, 1000);
    const node = makeNode('n1', [minerals, energy]);

    const result = depleteResource(node, ResourceType.Minerals, 30);

    expect(getResourceAmount(result, ResourceType.Minerals)).toBe(70);
    expect(getResourceAmount(result, ResourceType.Energy)).toBe(50); // Unchanged
  });
});

// --- addResources Tests ---

describe('addResources', () => {
  it('adds resources correctly', () => {
    const minerals = createResource(ResourceType.Minerals, 50, 0, 100);
    const node = makeNode('n1', [minerals]);

    const result = addResources(node, ResourceType.Minerals, 30);
    const resultResource = result.resources.find(r => r.type === ResourceType.Minerals);

    expect(resultResource?.amount).toBe(80);
  });

  it('respects max capacity', () => {
    const minerals = createResource(ResourceType.Minerals, 80, 0, 100);
    const node = makeNode('n1', [minerals]);

    const result = addResources(node, ResourceType.Minerals, 50);
    const resultResource = result.resources.find(r => r.type === ResourceType.Minerals);

    expect(resultResource?.amount).toBe(100);
  });

  it('does nothing for non-existent resource type', () => {
    const minerals = createResource(ResourceType.Minerals, 50, 0, 100);
    const node = makeNode('n1', [minerals]);

    const result = addResources(node, ResourceType.Energy, 30);

    expect(getResourceAmount(result, ResourceType.Minerals)).toBe(50);
    expect(result.resources.find(r => r.type === ResourceType.Energy)).toBeUndefined();
  });
});

// --- clampToCapacity Tests ---

describe('clampToCapacity', () => {
  it('clamps values over capacity down to max', () => {
    // Note: This creates a resource that bypasses normal bounds checking
    const resource: Resource = {
      type: ResourceType.Minerals,
      amount: 150,
      regenRate: 0,
      maxCapacity: 100,
    };
    const node = makeNode('n1', [resource]);

    const result = clampToCapacity(node);
    const resultResource = result.resources.find(r => r.type === ResourceType.Minerals);

    expect(resultResource?.amount).toBe(100);
  });

  it('clamps negative values up to 0', () => {
    const resource: Resource = {
      type: ResourceType.Minerals,
      amount: -50,
      regenRate: 0,
      maxCapacity: 100,
    };
    const node = makeNode('n1', [resource]);

    const result = clampToCapacity(node);
    const resultResource = result.resources.find(r => r.type === ResourceType.Minerals);

    expect(resultResource?.amount).toBe(0);
  });

  it('handles 0 capacity - everything clamps to 0', () => {
    const resource: Resource = {
      type: ResourceType.Minerals,
      amount: 50,
      regenRate: 0,
      maxCapacity: 0,
    };
    const node = makeNode('n1', [resource]);

    const result = clampToCapacity(node);
    const resultResource = result.resources.find(r => r.type === ResourceType.Minerals);

    expect(resultResource?.amount).toBe(0);
  });

  it('leaves valid amounts unchanged', () => {
    const minerals = createResource(ResourceType.Minerals, 50, 0, 100);
    const node = makeNode('n1', [minerals]);

    const result = clampToCapacity(node);
    const resultResource = result.resources.find(r => r.type === ResourceType.Minerals);

    expect(resultResource?.amount).toBe(50);
  });
});

// --- Production/Consumption Rate Calculations ---

describe('calculateProductionRate', () => {
  it('sums rates from active producers of matching type', () => {
    const producers: Producer[] = [
      makeProducer('p1', ResourceType.Minerals, 10),
      makeProducer('p2', ResourceType.Minerals, 5),
    ];

    expect(calculateProductionRate(producers, ResourceType.Minerals)).toBe(15);
  });

  it('ignores inactive producers', () => {
    const producers: Producer[] = [
      makeProducer('p1', ResourceType.Minerals, 10, true),
      makeProducer('p2', ResourceType.Minerals, 5, false), // inactive
    ];

    expect(calculateProductionRate(producers, ResourceType.Minerals)).toBe(10);
  });

  it('ignores producers of different resource types', () => {
    const producers: Producer[] = [
      makeProducer('p1', ResourceType.Minerals, 10),
      makeProducer('p2', ResourceType.Energy, 5),
    ];

    expect(calculateProductionRate(producers, ResourceType.Minerals)).toBe(10);
  });

  it('returns 0 for empty producer list', () => {
    expect(calculateProductionRate([], ResourceType.Minerals)).toBe(0);
  });
});

describe('calculateConsumptionRate', () => {
  it('sums rates from active consumers of matching type', () => {
    const consumers: Consumer[] = [
      makeConsumer('c1', ResourceType.Energy, 5),
      makeConsumer('c2', ResourceType.Energy, 3),
    ];

    expect(calculateConsumptionRate(consumers, ResourceType.Energy)).toBe(8);
  });

  it('ignores inactive consumers', () => {
    const consumers: Consumer[] = [
      makeConsumer('c1', ResourceType.Energy, 5, true),
      makeConsumer('c2', ResourceType.Energy, 3, false),
    ];

    expect(calculateConsumptionRate(consumers, ResourceType.Energy)).toBe(5);
  });
});

describe('calculateNetRate', () => {
  it('calculates correct net rate', () => {
    // Net = baseRegen + production - consumption
    expect(calculateNetRate(10, 5, 3)).toBe(12);
  });

  it('can be negative when consumption exceeds production', () => {
    expect(calculateNetRate(5, 0, 10)).toBe(-5);
  });

  it('returns 0 when everything balances', () => {
    expect(calculateNetRate(0, 5, 5)).toBe(0);
  });
});

// --- applyProductionConsumption Tests ---

describe('applyProductionConsumption', () => {
  it('applies production correctly', () => {
    const minerals = createResource(ResourceType.Minerals, 50, 0, 1000);
    const node = makeNode('n1', [minerals]);
    const producers: Producer[] = [makeProducer('p1', ResourceType.Minerals, 10)];

    const result = applyProductionConsumption(node, producers, []);

    expect(getResourceAmount(result, ResourceType.Minerals)).toBe(60);
  });

  it('applies consumption correctly', () => {
    const minerals = createResource(ResourceType.Minerals, 50, 0, 1000);
    const node = makeNode('n1', [minerals]);
    const consumers: Consumer[] = [makeConsumer('c1', ResourceType.Minerals, 10)];

    const result = applyProductionConsumption(node, [], consumers);

    expect(getResourceAmount(result, ResourceType.Minerals)).toBe(40);
  });

  it('handles multiple producers and consumers', () => {
    const minerals = createResource(ResourceType.Minerals, 100, 0, 1000);
    const node = makeNode('n1', [minerals]);
    const producers: Producer[] = [
      makeProducer('p1', ResourceType.Minerals, 20),
      makeProducer('p2', ResourceType.Minerals, 15),
    ];
    const consumers: Consumer[] = [
      makeConsumer('c1', ResourceType.Minerals, 10),
      makeConsumer('c2', ResourceType.Minerals, 5),
    ];

    // Net = 100 + 20 + 15 - 10 - 5 = 120
    const result = applyProductionConsumption(node, producers, consumers);

    expect(getResourceAmount(result, ResourceType.Minerals)).toBe(120);
  });

  it('production capped at capacity', () => {
    const minerals = createResource(ResourceType.Minerals, 90, 0, 100);
    const node = makeNode('n1', [minerals]);
    const producers: Producer[] = [makeProducer('p1', ResourceType.Minerals, 50)];

    const result = applyProductionConsumption(node, producers, []);

    expect(getResourceAmount(result, ResourceType.Minerals)).toBe(100);
  });

  it('consumption clamped at 0 (no debt)', () => {
    const minerals = createResource(ResourceType.Minerals, 10, 0, 1000);
    const node = makeNode('n1', [minerals]);
    const consumers: Consumer[] = [makeConsumer('c1', ResourceType.Minerals, 50)];

    const result = applyProductionConsumption(node, [], consumers);

    expect(getResourceAmount(result, ResourceType.Minerals)).toBe(0);
  });
});

// --- processNodeResources (Tick Processing) Tests ---

describe('processNodeResources', () => {
  describe('resource updates', () => {
    it('combines regeneration, production, and consumption', () => {
      const minerals = createResource(ResourceType.Minerals, 100, 5, 1000); // +5 regen
      const node = makeNode('n1', [minerals]);
      const producers: Producer[] = [makeProducer('p1', ResourceType.Minerals, 10)]; // +10 production
      const consumers: Consumer[] = [makeConsumer('c1', ResourceType.Minerals, 3)]; // -3 consumption

      // Net = 100 + 5 + 10 - 3 = 112
      const result = processNodeResources(node, 1, producers, consumers);

      expect(getResourceAmount(result.node, ResourceType.Minerals)).toBe(112);
    });

    it('is deterministic - same inputs produce same outputs', () => {
      const minerals = createResource(ResourceType.Minerals, 100, 5, 1000);
      const node = makeNode('n1', [minerals]);
      const producers: Producer[] = [makeProducer('p1', ResourceType.Minerals, 10)];
      const consumers: Consumer[] = [makeConsumer('c1', ResourceType.Minerals, 3)];

      const result1 = processNodeResources(node, 1, producers, consumers);
      const result2 = processNodeResources(node, 1, producers, consumers);

      expect(result1.node.resources).toEqual(result2.node.resources);
      expect(result1.events.length).toBe(result2.events.length);
    });

    it('processes each resource type independently', () => {
      const minerals = createResource(ResourceType.Minerals, 100, 10, 1000);
      const energy = createResource(ResourceType.Energy, 50, -5, 1000);
      const node = makeNode('n1', [minerals, energy]);

      const result = processNodeResources(node, 1, [], []);

      expect(getResourceAmount(result.node, ResourceType.Minerals)).toBe(110);
      expect(getResourceAmount(result.node, ResourceType.Energy)).toBe(45);
    });
  });

  describe('event generation', () => {
    it('emits ResourceDepleted when resource hits 0', () => {
      const minerals = createResource(ResourceType.Minerals, 5, 0, 1000);
      const node = makeNode('n1', [minerals]);
      const consumers: Consumer[] = [makeConsumer('c1', ResourceType.Minerals, 10)];

      const result = processNodeResources(node, 42, [], consumers);

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: GameEventType.ResourceDepleted,
          tick: 42,
          entityId: 'n1',
          data: expect.objectContaining({
            resourceType: ResourceType.Minerals,
            previousAmount: 5,
          }),
        })
      );
    });

    it('does not emit ResourceDepleted if already at 0', () => {
      const minerals = createResource(ResourceType.Minerals, 0, 0, 1000);
      const node = makeNode('n1', [minerals]);
      const consumers: Consumer[] = [makeConsumer('c1', ResourceType.Minerals, 10)];

      const result = processNodeResources(node, 1, [], consumers);

      expect(result.events.find(e => e.type === GameEventType.ResourceDepleted)).toBeUndefined();
    });

    it('emits ResourceCapacityReached when hitting max', () => {
      const minerals = createResource(ResourceType.Minerals, 95, 0, 100);
      const node = makeNode('n1', [minerals]);
      const producers: Producer[] = [makeProducer('p1', ResourceType.Minerals, 10)];

      const result = processNodeResources(node, 42, producers, []);

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: GameEventType.ResourceCapReached,
          tick: 42,
          entityId: 'n1',
          data: expect.objectContaining({
            resourceType: ResourceType.Minerals,
            capacity: 100,
          }),
        })
      );
    });

    it('does not emit ResourceCapacityReached if already at max', () => {
      const minerals = createResource(ResourceType.Minerals, 100, 0, 100);
      const node = makeNode('n1', [minerals]);
      const producers: Producer[] = [makeProducer('p1', ResourceType.Minerals, 10)];

      const result = processNodeResources(node, 1, producers, []);

      expect(result.events.find(e => e.type === GameEventType.ResourceCapReached)).toBeUndefined();
    });

    it('emits ResourceProduced when net gain', () => {
      const minerals = createResource(ResourceType.Minerals, 50, 10, 1000);
      const node = makeNode('n1', [minerals]);

      const result = processNodeResources(node, 42, [], []);

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: GameEventType.ResourceProduced,
          tick: 42,
          entityId: 'n1',
          data: expect.objectContaining({
            resourceType: ResourceType.Minerals,
            produced: 10,
            newAmount: 60,
          }),
        })
      );
    });

    it('does not emit ResourceProduced when net loss', () => {
      const minerals = createResource(ResourceType.Minerals, 50, 0, 1000);
      const node = makeNode('n1', [minerals]);
      const consumers: Consumer[] = [makeConsumer('c1', ResourceType.Minerals, 10)];

      const result = processNodeResources(node, 1, [], consumers);

      expect(result.events.find(e => e.type === GameEventType.ResourceProduced)).toBeUndefined();
    });

    it('handles multiple events in single tick', () => {
      // One resource depletes, another hits capacity
      const minerals = createResource(ResourceType.Minerals, 5, -10, 100);
      const energy = createResource(ResourceType.Energy, 95, 10, 100);
      const node = makeNode('n1', [minerals, energy]);

      const result = processNodeResources(node, 1, [], []);

      const depletedEvent = result.events.find(
        e => e.type === GameEventType.ResourceDepleted && e.data.resourceType === ResourceType.Minerals
      );
      const capEvent = result.events.find(
        e => e.type === GameEventType.ResourceCapReached && e.data.resourceType === ResourceType.Energy
      );

      expect(depletedEvent).toBeDefined();
      expect(capEvent).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('handles node with no resources', () => {
      const node = makeNode('n1', []);

      const result = processNodeResources(node, 1, [], []);

      expect(result.node.resources).toHaveLength(0);
      expect(result.events).toHaveLength(0);
    });

    it('handles no producers or consumers', () => {
      const minerals = createResource(ResourceType.Minerals, 100, 5, 1000);
      const node = makeNode('n1', [minerals]);

      const result = processNodeResources(node, 1);

      expect(getResourceAmount(result.node, ResourceType.Minerals)).toBe(105);
    });

    it('handles very large amounts', () => {
      const minerals = createResource(ResourceType.Minerals, Number.MAX_SAFE_INTEGER - 10, 5, Number.MAX_SAFE_INTEGER);
      const node = makeNode('n1', [minerals]);

      const result = processNodeResources(node, 1, [], []);

      expect(getResourceAmount(result.node, ResourceType.Minerals)).toBe(Number.MAX_SAFE_INTEGER - 5);
    });
  });
});

// --- Helper Function Tests ---

describe('buildResourceRates', () => {
  it('aggregates production rates by resource type', () => {
    const producers: Producer[] = [
      makeProducer('p1', ResourceType.Minerals, 10),
      makeProducer('p2', ResourceType.Minerals, 5),
      makeProducer('p3', ResourceType.Energy, 8),
    ];

    const rates = buildResourceRates('n1', producers, []);

    expect(rates.production[ResourceType.Minerals]).toBe(15);
    expect(rates.production[ResourceType.Energy]).toBe(8);
  });

  it('aggregates consumption rates by resource type', () => {
    const consumers: Consumer[] = [
      makeConsumer('c1', ResourceType.Energy, 5),
      makeConsumer('c2', ResourceType.Energy, 3),
    ];

    const rates = buildResourceRates('n1', [], consumers);

    expect(rates.consumption[ResourceType.Energy]).toBe(8);
  });

  it('ignores inactive producers/consumers', () => {
    const producers: Producer[] = [
      makeProducer('p1', ResourceType.Minerals, 10, true),
      makeProducer('p2', ResourceType.Minerals, 5, false),
    ];

    const rates = buildResourceRates('n1', producers, []);

    expect(rates.production[ResourceType.Minerals]).toBe(10);
  });
});

describe('hasResources', () => {
  it('returns true when all requirements met', () => {
    const minerals = createResource(ResourceType.Minerals, 100, 0, 1000);
    const energy = createResource(ResourceType.Energy, 50, 0, 1000);
    const node = makeNode('n1', [minerals, energy]);

    const result = hasResources(node, [
      { type: ResourceType.Minerals, amount: 50 },
      { type: ResourceType.Energy, amount: 25 },
    ]);

    expect(result).toBe(true);
  });

  it('returns false when any requirement not met', () => {
    const minerals = createResource(ResourceType.Minerals, 100, 0, 1000);
    const node = makeNode('n1', [minerals]);

    const result = hasResources(node, [
      { type: ResourceType.Minerals, amount: 150 },
    ]);

    expect(result).toBe(false);
  });

  it('returns false for missing resource type', () => {
    const minerals = createResource(ResourceType.Minerals, 100, 0, 1000);
    const node = makeNode('n1', [minerals]);

    const result = hasResources(node, [{ type: ResourceType.Energy, amount: 10 }]);

    expect(result).toBe(false);
  });

  it('returns true for empty requirements', () => {
    const node = makeNode('n1', []);

    expect(hasResources(node, [])).toBe(true);
  });
});

describe('getResourceAmount', () => {
  it('returns correct amount for existing resource', () => {
    const minerals = createResource(ResourceType.Minerals, 42, 0, 1000);
    const node = makeNode('n1', [minerals]);

    expect(getResourceAmount(node, ResourceType.Minerals)).toBe(42);
  });

  it('returns 0 for non-existent resource', () => {
    const node = makeNode('n1', []);

    expect(getResourceAmount(node, ResourceType.Minerals)).toBe(0);
  });
});

describe('getResourceCapacity', () => {
  it('returns correct capacity for existing resource', () => {
    const minerals = createResource(ResourceType.Minerals, 42, 0, 500);
    const node = makeNode('n1', [minerals]);

    expect(getResourceCapacity(node, ResourceType.Minerals)).toBe(500);
  });

  it('returns 0 for non-existent resource', () => {
    const node = makeNode('n1', []);

    expect(getResourceCapacity(node, ResourceType.Minerals)).toBe(0);
  });
});

// --- Determinism Stress Test ---

describe('determinism', () => {
  it('produces identical results across many iterations', () => {
    const initialMinerals = createResource(ResourceType.Minerals, 500, 3, 1000);
    const initialEnergy = createResource(ResourceType.Energy, 200, -2, 1000);
    const initialNode = makeNode('n1', [initialMinerals, initialEnergy]);
    const producers: Producer[] = [
      makeProducer('p1', ResourceType.Minerals, 7),
      makeProducer('p2', ResourceType.Energy, 10),
    ];
    const consumers: Consumer[] = [
      makeConsumer('c1', ResourceType.Minerals, 2),
      makeConsumer('c2', ResourceType.Energy, 5),
    ];

    // Run two parallel simulations
    let node1 = initialNode;
    let node2 = initialNode;

    for (let tick = 1; tick <= 100; tick++) {
      const result1 = processNodeResources(node1, tick, producers, consumers);
      const result2 = processNodeResources(node2, tick, producers, consumers);

      node1 = result1.node;
      node2 = result2.node;

      expect(result1.node.resources).toEqual(result2.node.resources);
    }

    // Final state should be identical
    expect(getResourceAmount(node1, ResourceType.Minerals)).toBe(
      getResourceAmount(node2, ResourceType.Minerals)
    );
    expect(getResourceAmount(node1, ResourceType.Energy)).toBe(
      getResourceAmount(node2, ResourceType.Energy)
    );
  });
});
