"use strict";
/**
 * Pure functions for Resource operations.
 * No side effects - returns new state.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createResource = createResource;
exports.tickResource = tickResource;
exports.setResourceAmount = setResourceAmount;
exports.setRegenRate = setRegenRate;
/** Create a new resource with default values */
function createResource(type, amount = 0, regenRate = 0, maxCapacity = 1000) {
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
function tickResource(resource) {
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
function setResourceAmount(resource, amount) {
    return {
        ...resource,
        amount: Math.max(0, Math.min(amount, resource.maxCapacity)),
    };
}
/** Update regeneration rate */
function setRegenRate(resource, regenRate) {
    return {
        ...resource,
        regenRate,
    };
}
//# sourceMappingURL=resource.js.map