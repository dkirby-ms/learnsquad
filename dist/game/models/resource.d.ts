/**
 * Pure functions for Resource operations.
 * No side effects - returns new state.
 */
import type { Resource, ResourceType } from '../types';
/** Create a new resource with default values */
export declare function createResource(type: ResourceType, amount?: number, regenRate?: number, maxCapacity?: number): Resource;
/**
 * Process resource regeneration for one tick.
 * Returns new resource state and whether cap was reached or depleted.
 */
export declare function tickResource(resource: Resource): {
    resource: Resource;
    wasDepleted: boolean;
    wasCapReached: boolean;
};
/** Update resource amount, respecting capacity bounds */
export declare function setResourceAmount(resource: Resource, amount: number): Resource;
/** Update regeneration rate */
export declare function setRegenRate(resource: Resource, regenRate: number): Resource;
//# sourceMappingURL=resource.d.ts.map