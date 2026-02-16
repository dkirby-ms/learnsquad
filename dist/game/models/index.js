"use strict";
/**
 * Models barrel export
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
exports.setNodes = exports.getAllConnections = exports.getAllNodes = exports.getNode = exports.clearEventQueue = exports.queueEvents = exports.unpause = exports.pause = exports.setSpeed = exports.advanceTick = exports.addWorldConnection = exports.updateNode = exports.addNode = exports.createGameWorld = void 0;
__exportStar(require("./resource"), exports);
__exportStar(require("./node"), exports);
__exportStar(require("./connection"), exports);
var world_1 = require("./world");
Object.defineProperty(exports, "createGameWorld", { enumerable: true, get: function () { return world_1.createGameWorld; } });
Object.defineProperty(exports, "addNode", { enumerable: true, get: function () { return world_1.addNode; } });
Object.defineProperty(exports, "updateNode", { enumerable: true, get: function () { return world_1.updateNode; } });
Object.defineProperty(exports, "addWorldConnection", { enumerable: true, get: function () { return world_1.addConnection; } });
Object.defineProperty(exports, "advanceTick", { enumerable: true, get: function () { return world_1.advanceTick; } });
Object.defineProperty(exports, "setSpeed", { enumerable: true, get: function () { return world_1.setSpeed; } });
Object.defineProperty(exports, "pause", { enumerable: true, get: function () { return world_1.pause; } });
Object.defineProperty(exports, "unpause", { enumerable: true, get: function () { return world_1.unpause; } });
Object.defineProperty(exports, "queueEvents", { enumerable: true, get: function () { return world_1.queueEvents; } });
Object.defineProperty(exports, "clearEventQueue", { enumerable: true, get: function () { return world_1.clearEventQueue; } });
Object.defineProperty(exports, "getNode", { enumerable: true, get: function () { return world_1.getNode; } });
Object.defineProperty(exports, "getAllNodes", { enumerable: true, get: function () { return world_1.getAllNodes; } });
Object.defineProperty(exports, "getAllConnections", { enumerable: true, get: function () { return world_1.getAllConnections; } });
Object.defineProperty(exports, "setNodes", { enumerable: true, get: function () { return world_1.setNodes; } });
//# sourceMappingURL=index.js.map