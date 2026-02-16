/**
 * Pure functions for Resource operations.
 * No side effects - returns new state.
 */

import type { Resource, ResourceType } from '../types';

/** Create a new resource with default values */
export function createResource(
  type: ResourceType,
  amount: number = 0,
  regenRate: number = 0,
  maxCapacity: number = 1000
): Resource {
  return {
    type,
    amount: Math.max(0, Math.min(amount, maxCapacity)),
    regenRate,
    maxCapacity,
  };
}

/** 
 * Process resource regeneration for one tick.
 * Returns new resource state and whether cap was reached or depleted.
 */
export function tickResource(resource: Resource): {
  resource: Resource;
  wasDepleted: boolean;
  wasCapReached: boolean;
} {
  const newAmount = resource.amount + resource.regenRate;
  const clampedAmount = Math.max(0, Math.min(newAmount, resource.maxCapacity));
  
  return {
    resource: {
      ...resource,
      amount: clampedAmount,
    },
    wasDepleted: clampedAmount === 0 && resource.amount > 0,
    wasCapReached: clampedAmount === resource.maxCapacity && resource.amount < resource.maxCapacity,
  };
}

/** Update resource amount, respecting capacity bounds */
export function setResourceAmount(resource: Resource, amount: number): Resource {
  return {
    ...resource,
    amount: Math.max(0, Math.min(amount, resource.maxCapacity)),
  };
}

/** Update regeneration rate */
export function setRegenRate(resource: Resource, regenRate: number): Resource {
  return {
    ...resource,
    regenRate,
  };
}
