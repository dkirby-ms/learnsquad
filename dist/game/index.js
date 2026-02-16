"use strict";
/**
 * Game Simulation Module
 *
 * This module contains the core game simulation logic:
 * - Pure, deterministic tick processing
 * - Game world state management
 * - Resource regeneration and events
 *
 * Designed for potential extraction to Rust/Go.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processMultipleTicks = exports.processTick = exports.GameLoop = void 0;
// Core types
__exportStar(require("./types"), exports);
// Model operations
__exportStar(require("./models"), exports);
// Game loop
var loop_1 = require("./loop");
Object.defineProperty(exports, "GameLoop", { enumerable: true, get: function () { return loop_1.GameLoop; } });
Object.defineProperty(exports, "processTick", { enumerable: true, get: function () { return loop_1.processTick; } });
Object.defineProperty(exports, "processMultipleTicks", { enumerable: true, get: function () { return loop_1.processMultipleTicks; } });
//# sourceMappingURL=index.js.map