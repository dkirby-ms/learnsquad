### 2025-07-14: WebSocket Protocol for Game State Sync

**By:** Amos

**What:** Established WebSocket protocol for multiplayer game state synchronization. Uses `ws` library, JSON messages, and delta encoding for tick updates.

**Why:** JSON over binary for easier debugging during development. Delta encoding (only changed nodes per tick) reduces bandwidth without complexity of full binary serialization. Can optimize to binary later if needed.

---

## Message Protocol for Naomi (Frontend)

### Connection Flow
1. Connect to `ws://server:port/ws`
2. Send `join_room` message with room ID
3. Receive `room_joined` with initial game state
4. Receive `tick_complete` messages on each game tick

### Key Client → Server Messages
```typescript
// Join a game room
{ type: 'join_room', roomId: string, token?: string }

// Leave room
{ type: 'leave_room', roomId: string }

// Pause/Resume (Paradox-style)
{ type: 'pause_game' }
{ type: 'resume_game' }

// Set speed (0=paused, 1=normal, 2=fast, 5=very fast)
{ type: 'set_speed', speed: GameSpeed }

// Request full state resync
{ type: 'request_sync' }

// Latency measurement
{ type: 'ping', clientTime: number }
```

### Key Server → Client Messages
```typescript
// Full state (on join or resync)
{
  type: 'game_state_update',
  world: GameWorld,
  serverTime: number
}

// Delta update each tick
{
  type: 'tick_complete',
  tick: number,
  events: GameEvent[],
  changedNodeIds: string[],
  changedNodes: Record<string, Node>,
  isPaused: boolean,
  speed: GameSpeed,
  serverTime: number
}

// Room join confirmation
{
  type: 'room_joined',
  roomId: string,
  world: GameWorld,
  clientId: string
}

// Pause state changed
{
  type: 'pause_state_changed',
  isPaused: boolean,
  tick: number
}

// Errors
{
  type: 'error',
  code: string,
  message: string
}
```

### Type Definitions
Import from `server/src/ws/types.ts` — includes `ClientMessage`, `ServerMessage`, and all individual message types.

### Tick Rate
Default 1000ms (1 tick/second at normal speed). Configurable via `TICK_RATE` env var.
