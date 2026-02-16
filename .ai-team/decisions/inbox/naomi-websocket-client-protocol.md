### 2025-07-15: WebSocket Client Protocol

**By:** Naomi

**What:** Established the client-side WebSocket message protocol for game state sync. Server messages use typed enums: `WorldSnapshot` (full state), `WorldDelta` (incremental updates), `Events` (game events), `SpeedChanged` (pause/speed changes). Client messages: `JoinGame`, `Pause`, `Resume`, `SetSpeed`, `Ping`.

**Why:** This protocol gives us efficient state synchronization — full snapshots on connect, deltas during play. The delta format allows updating individual nodes/connections without retransmitting the entire world. Amos should implement the server side to match these types, which are exported from `src/store/gameState.ts`.

---

### 2025-07-15: Client State Store Architecture

**By:** Naomi

**What:** Using a simple singleton store pattern with `useSyncExternalStore` instead of Redux/Zustand. The `gameStateStore` holds GameWorld, event history, and tick history. Components subscribe via hooks like `useGameWorld()`.

**Why:** Minimal dependencies, fast performance, and React 18+ native integration. We can upgrade to Zustand later if complexity warrants it, but for now the store is ~200 lines and does exactly what we need. The store integrates with `handleServerMessage()` for automatic state updates from WebSocket.
