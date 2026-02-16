"use strict";
/**
 * Core game types for the simulation layer.
 *
 * Design principles:
 * - Pure data structures, no methods with side effects
 * - Deterministic: same input always produces same output
 * - Separable: could be translated to Rust/Go
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameSpeed = exports.GameEventType = exports.NodeStatus = exports.ConnectionType = exports.ResourceType = void 0;
/** Resource types available in the game */
var ResourceType;
(function (ResourceType) {
    ResourceType["Minerals"] = "minerals";
    ResourceType["Energy"] = "energy";
    ResourceType["Alloys"] = "alloys";
    ResourceType["Research"] = "research";
})(ResourceType || (exports.ResourceType = ResourceType = {}));
/** Connection type between nodes */
var ConnectionType;
(function (ConnectionType) {
    /** Direct connection - always traversable */
    ConnectionType["Direct"] = "direct";
    /** Gateway - may have access restrictions or costs */
    ConnectionType["Gateway"] = "gateway";
})(ConnectionType || (exports.ConnectionType = ConnectionType = {}));
/** Node status in the game */
var NodeStatus;
(function (NodeStatus) {
    NodeStatus["Neutral"] = "neutral";
    NodeStatus["Claimed"] = "claimed";
    NodeStatus["Contested"] = "contested";
})(NodeStatus || (exports.NodeStatus = NodeStatus = {}));
/** Event types that can occur during simulation */
var GameEventType;
(function (GameEventType) {
    GameEventType["ResourceDepleted"] = "resource_depleted";
    GameEventType["ResourceCapReached"] = "resource_cap_reached";
    GameEventType["NodeClaimed"] = "node_claimed";
    GameEventType["TickProcessed"] = "tick_processed";
})(GameEventType || (exports.GameEventType = GameEventType = {}));
/** Game speed settings */
var GameSpeed;
(function (GameSpeed) {
    GameSpeed[GameSpeed["Paused"] = 0] = "Paused";
    GameSpeed[GameSpeed["Normal"] = 1] = "Normal";
    GameSpeed[GameSpeed["Fast"] = 2] = "Fast";
    GameSpeed[GameSpeed["VeryFast"] = 5] = "VeryFast";
})(GameSpeed || (exports.GameSpeed = GameSpeed = {}));
//# sourceMappingURL=types.js.map