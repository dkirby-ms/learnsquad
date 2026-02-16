### Backend Migration: Custom WebSocket to Colyseus

**By:** Amos
**Date:** 2025-07-14

**What:** Replaced the custom `ws` WebSocket layer (`server/src/ws/`) with Colyseus 0.17. The old code is archived at `server/src/ws-archived/` for reference.

**Why:** Colyseus provides automatic state synchronization with delta encoding, built-in reconnection support, room lifecycle management, and matchmaking — all things we'd have to maintain ourselves with raw `ws`. It's battle-tested for real-time multiplayer games.

**Changes:**

1. **Dependencies added:**
   - `colyseus@0.17.8` — server framework
   - `@colyseus/schema@4.0.12` — state synchronization
   - `@colyseus/ws-transport@0.17.9` — WebSocket transport

2. **New files:**
   - `server/src/colyseus/schema.ts` — GameState, NodeSchema, PlayerSchema, etc.
   - `server/src/colyseus/converters.ts` — Bridge between GameWorld and Colyseus schema
   - `server/src/colyseus/GameRoom.ts` — Main room implementation
   - `server/src/colyseus/index.ts` — Module exports

3. **Room name:** `"game"` — frontend uses `client.joinOrCreate("game")`

4. **Message types preserved:**
   - `pause_game`, `resume_game`, `set_speed` — game control
   - `ping`/`pong` — latency measurement
   - `player_action` — future game commands
   - `request_sync` — manual state refresh

5. **State sync:** Automatic via Colyseus. Schema changes trigger delta patches to clients.

6. **Reconnection:** 30-second window for unexpected disconnects (non-consented).

**Naomi coordination:**

Frontend needs to switch from raw WebSocket to Colyseus client:
```typescript
import { Client } from "colyseus.js";

const client = new Client("ws://localhost:3000");
const room = await client.joinOrCreate("game");

// State changes via callbacks
room.state.listen("currentTick", (tick) => { ... });
room.state.nodes.onAdd((node, key) => { ... });

// Send messages
room.send("pause_game", {});
room.send("set_speed", { speed: 2 });
```

**tsconfig changes:**
- Added `experimentalDecorators: true`
- Added `emitDecoratorMetadata: true`

**Status:** Build passes. Server starts. Ready for frontend integration.
