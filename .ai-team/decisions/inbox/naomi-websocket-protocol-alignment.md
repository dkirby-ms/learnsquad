### 2025-07-15: WebSocket Protocol Alignment

**By:** Naomi

**What:** Aligned frontend WebSocket protocol with backend's existing implementation. Client messages now match `server/src/ws/types.ts` exactly:

- `join_room` (was `join_game` with nested payload)
- `pause_game` (was `pause`)
- `resume_game` (was `resume`)
- `set_speed` with direct `speed` property (was nested in payload)
- `ping` with `clientTime` (was empty)

Server message handling updated for:
- `room_joined` → initial world state
- `tick_complete` → delta updates with changed nodes
- `pause_state_changed` / `speed_changed` → state toggles
- `pong` → latency measurement

Also fixed WebSocket endpoint from `/ws/game?gameId=X` to `/ws` — the roomId is now passed in the `join_room` message.

**Why:** The frontend and backend had diverged. The backend's protocol (Amos's work) is more complete and well-structured with flat JSON messages using type discriminators. Rather than asking Amos to change the server, I adapted the frontend. This is the right call because:

1. The server protocol was already working and tested
2. Flat message format is cleaner than nested payloads
3. Single source of truth: `server/src/ws/types.ts` defines the protocol

**Files changed:**
- `src/store/gameState.ts` — updated message types and handler
- `src/hooks/useGameSocket.ts` — updated message sending
- `src/store/index.ts` — updated exports
