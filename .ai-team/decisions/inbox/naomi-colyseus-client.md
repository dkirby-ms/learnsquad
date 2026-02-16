### 2025-07-14: Migrated frontend to Colyseus client

**By:** Naomi

**What:** Replaced custom WebSocket implementation with Colyseus client library (`colyseus.js`). The `useGameSocket` hook now uses Colyseus `Client` and `Room` primitives instead of raw WebSocket. State synchronization happens through `room.onStateChange` rather than manual message parsing. Game controls send messages via `room.send()`.

**Coordination with Amos:**
- Room name: `"game"` (standard room name)
- Message types: `pause`, `resume`, `set_speed` (client → server)
- Event broadcast: `events` message type for game events
- State schema: Server state maps to `GameWorld` structure via converter functions

**Why:** Colyseus handles the complex parts of multiplayer networking:
1. **Automatic state synchronization** — schema-based state sync eliminates manual delta patching
2. **Reconnection with tokens** — `room.reconnectionToken` enables seamless reconnect without re-authenticating
3. **Built-in heartbeat** — no manual ping/pong needed
4. **Binary protocol** — more efficient than our JSON message format

The gameState store is now simpler—it just receives full snapshots from the Colyseus state converter. The old message type enums and delta handling code were removed.
