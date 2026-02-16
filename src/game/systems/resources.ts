/**
 * Resource System - Production, consumption, and regeneration mechanics.
 * 
 * Design principles:
 * - Pure functions: no mutations, no side effects
 * - Deterministic: same input always produces same output
 * - Separable: suitable for Rust/Go extraction
 * 
 * Resource flow:
 * - Base regeneration adds resources each tick
 * - Producers add to resource amounts
 * - Consumers subtract from resource amounts
 * - Net rate = baseRegen + totalProduction - totalConsumption
 * - Amounts are clamped to [0, maxCapacity]
 */

import type {
  Node,
  Resource,
  ResourceType,
  EntityId,
  Tick,
  GameEvent,
  GameEventType,
} from '../types';

/** A producer adds resources per tick */
export interface Producer {
  readonly id: EntityId;
  readonly resourceType: ResourceType;
  /** Amount produced per tick */
  readonly rate: number;
  /** Whether this producer is currently active */
  readonly isActive: boolean;
}

/** A consumer uses resources per tick */
export interface Consumer {
  readonly id: EntityId;
  readonly resourceType: ResourceType;
  /** Amount consumed per tick */
  readonly rate: number;
  /** Whether this consumer is currently active */
  readonly isActive: boolean;
}

/** Tracks production and consumption rates for a node */
export interface ResourceRates {
  readonly nodeId: EntityId;
  /** Map of resource type to production rate */
  readonly production: Readonly<Record<ResourceType, number>>;
  /** Map of resource type to consumption rate */
  readonly consumption: Readonly<Record<ResourceType, number>>;
}

/** Result of resource processing */
export interface ResourceProcessResult {
  readonly node: Node;
  readonly events: GameEvent[];
}

// --- Pure Helper Functions ---

/**
 * Calculate net rate for a resource type.
 * Net = baseRegen + production - consumption
 */
export function calculateNetRate(
  baseRegen: number,
  productionRate: number,
  consumptionRate: number
): number {
  return baseRegen + productionRate - consumptionRate;
}

/**
 * Calculate total production rate from producers.
 */
export function calculateProductionRate(
  producers: readonly Producer[],
  resourceType: ResourceType
): number {
  return producers
    .filter(p => p.resourceType === resourceType && p.isActive)
    .reduce((sum, p) => sum + p.rate, 0);
}

/**
 * Calculate total consumption rate from consumers.
 */
export function calculateConsumptionRate(
  consumers: readonly Consumer[],
  resourceType: ResourceType
): number {
  return consumers
    .filter(c => c.resourceType === resourceType && c.isActive)
    .reduce((sum, c) => sum + c.rate, 0);
}

// --- Core Resource Functions ---

/**
 * Regenerate resources at a node based on regeneration rates.
 * Pure function: returns new node, no mutations.
 */
export function regenerateResources(node: Node, tick: Tick): Node {
  const newResources = node.resources.map(resource => {
    const newAmount = resource.amount + resource.regenRate;
    const clampedAmount = Math.max(0, Math.min(newAmount, resource.maxCapacity));
    return {
      ...resource,
      amount: clampedAmount,
    };
  });

  return {
    ...node,
    resources: newResources,
  };
}

/**
 * Deplete a specific resource type from a node.
 * Respects minimum of 0.
 * Pure function: returns new node, no mutations.
 */
export function depleteResource(
  node: Node,
  resourceType: ResourceType,
  amount: number
): Node {
  const newResources = node.resources.map(resource => {
    if (resource.type !== resourceType) {
      return resource;
    }
    const newAmount = Math.max(0, resource.amount - amount);
    return {
      ...resource,
      amount: newAmount,
    };
  });

  return {
    ...node,
    resources: newResources,
  };
}

/**
 * Add resources to a node (from production or other sources).
 * Respects max capacity.
 * Pure function: returns new node, no mutations.
 */
export function addResources(
  node: Node,
  resourceType: ResourceType,
  amount: number
): Node {
  const newResources = node.resources.map(resource => {
    if (resource.type !== resourceType) {
      return resource;
    }
    const newAmount = Math.min(resource.maxCapacity, resource.amount + amount);
    return {
      ...resource,
      amount: newAmount,
    };
  });

  return {
    ...node,
    resources: newResources,
  };
}

/**
 * Clamp all resources at a node to their capacity limits.
 * Pure function: returns new node, no mutations.
 */
export function clampToCapacity(node: Node): Node {
  const newResources = node.resources.map(resource => ({
    ...resource,
    amount: Math.max(0, Math.min(resource.amount, resource.maxCapacity)),
  }));

  return {
    ...node,
    resources: newResources,
  };
}

/**
 * Apply production and consumption to a node's resources.
 * Production adds, consumption subtracts, result is clamped.
 */
export function applyProductionConsumption(
  node: Node,
  producers: readonly Producer[],
  consumers: readonly Consumer[]
): Node {
  const newResources = node.resources.map(resource => {
    const production = calculateProductionRate(producers, resource.type);
    const consumption = calculateConsumptionRate(consumers, resource.type);
    const netChange = production - consumption;
    const newAmount = resource.amount + netChange;
    const clampedAmount = Math.max(0, Math.min(newAmount, resource.maxCapacity));
    
    return {
      ...resource,
      amount: clampedAmount,
    };
  });

  return {
    ...node,
    resources: newResources,
  };
}

/**
 * Process all resource changes for a single tick at a node.
 * Combines regeneration, production, and consumption.
 * Generates events for notable state changes.
 * 
 * This is the main entry point for the resource system.
 */
export function processNodeResources(
  node: Node,
  tick: Tick,
  producers: readonly Producer[] = [],
  consumers: readonly Consumer[] = []
): ResourceProcessResult {
  const events: GameEvent[] = [];
  const prevAmounts = new Map<ResourceType, number>();
  
  // Track previous amounts
  for (const resource of node.resources) {
    prevAmounts.set(resource.type, resource.amount);
  }

  // Calculate new resource amounts
  const newResources = node.resources.map(resource => {
    // Base regeneration
    const regen = resource.regenRate;
    
    // Production and consumption
    const production = calculateProductionRate(producers, resource.type);
    const consumption = calculateConsumptionRate(consumers, resource.type);
    
    // Total change
    const totalChange = regen + production - consumption;
    const newAmount = resource.amount + totalChange;
    const clampedAmount = Math.max(0, Math.min(newAmount, resource.maxCapacity));

    return {
      ...resource,
      amount: clampedAmount,
    };
  });

  // Generate events
  for (const newResource of newResources) {
    const prevAmount = prevAmounts.get(newResource.type) ?? 0;
    
    // Resource depleted: had some, now at 0
    if (prevAmount > 0 && newResource.amount === 0) {
      events.push({
        type: 'resource_depleted' as GameEventType,
        tick,
        entityId: node.id,
        data: {
          resourceType: newResource.type,
          previousAmount: prevAmount,
        },
      });
    }
    
    // Capacity reached: wasn't at max, now at max
    if (prevAmount < newResource.maxCapacity && newResource.amount === newResource.maxCapacity) {
      events.push({
        type: 'resource_cap_reached' as GameEventType,
        tick,
        entityId: node.id,
        data: {
          resourceType: newResource.type,
          capacity: newResource.maxCapacity,
        },
      });
    }
    
    // Resource produced: amount increased (only if net positive change)
    if (newResource.amount > prevAmount) {
      events.push({
        type: 'resource_produced' as GameEventType,
        tick,
        entityId: node.id,
        data: {
          resourceType: newResource.type,
          produced: newResource.amount - prevAmount,
          newAmount: newResource.amount,
        },
      });
    }
  }

  return {
    node: {
      ...node,
      resources: newResources,
    },
    events,
  };
}

/**
 * Build ResourceRates summary for a node.
 * Useful for UI display of production/consumption breakdown.
 */
export function buildResourceRates(
  nodeId: EntityId,
  producers: readonly Producer[],
  consumers: readonly Consumer[]
): ResourceRates {
  const production: Record<ResourceType, number> = {} as Record<ResourceType, number>;
  const consumption: Record<ResourceType, number> = {} as Record<ResourceType, number>;

  for (const producer of producers) {
    if (producer.isActive) {
      production[producer.resourceType] = 
        (production[producer.resourceType] ?? 0) + producer.rate;
    }
  }

  for (const consumer of consumers) {
    if (consumer.isActive) {
      consumption[consumer.resourceType] = 
        (consumption[consumer.resourceType] ?? 0) + consumer.rate;
    }
  }

  return {
    nodeId,
    production,
    consumption,
  };
}

/**
 * Check if a node has sufficient resources for consumption.
 * Returns true if all required resources are available.
 */
export function hasResources(
  node: Node,
  requirements: readonly { type: ResourceType; amount: number }[]
): boolean {
  for (const req of requirements) {
    const resource = node.resources.find(r => r.type === req.type);
    if (!resource || resource.amount < req.amount) {
      return false;
    }
  }
  return true;
}

/**
 * Get current amount of a specific resource at a node.
 * Returns 0 if resource type not present.
 */
export function getResourceAmount(node: Node, resourceType: ResourceType): number {
  const resource = node.resources.find(r => r.type === resourceType);
  return resource?.amount ?? 0;
}

/**
 * Get the capacity for a specific resource at a node.
 * Returns 0 if resource type not present.
 */
export function getResourceCapacity(node: Node, resourceType: ResourceType): number {
  const resource = node.resources.find(r => r.type === resourceType);
  return resource?.maxCapacity ?? 0;
}
