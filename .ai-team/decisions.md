### 2025-07-12: Server infrastructure established in server/ directory

**By:** Amos

**What:** Created Node.js/Express/TypeScript backend in `server/` directory with JWT-based authentication. Auth routes at `/api/auth/login` and `/api/auth/register`. Using in-memory user store for now.

**Why:** Clean separation between client and server code. In-memory store keeps things simple for initial development — PostgreSQL integration will come when we have real persistence needs. Included register endpoint because login alone is useless without a way to create users.


### 2025-07-13: Test-first auth contracts established

**By:** Drummer

**What:** Created comprehensive test suites for login functionality before implementation. Backend tests define API contract (`POST /api/auth/login`), frontend tests define component behavior. Tests include security checks (SQL injection, rate limiting, user enumeration prevention).

**Why:** Writing tests first establishes the contract for Naomi and Amos. They build to make tests pass, not the other way around. This catches misunderstandings early and ensures security considerations aren't afterthoughts. The tests serve as executable documentation of expected behavior.


### 2025-07-14: CSS Modules for Component Styling

**By:** Naomi

**What:** Using CSS modules (*.module.css) for component-scoped styles rather than global CSS or CSS-in-JS.

**Why:** CSS modules give us scoped styles without runtime overhead. They work great with Vite's built-in support, avoid className collisions as the component library grows, and keep styling co-located with components. For a game UI, we want fast rendering without the overhead of CSS-in-JS solutions.


### 2025-07-14: Using Entra External ID (CIAM) instead of regular Entra ID

**By:** Amos

**What:** OAuth implementation now uses Microsoft Entra External ID (CIAM) instead of regular Entra ID. Authority URL changed from `login.microsoftonline.com` to `{tenant}.ciamlogin.com`. Config now uses `AZURE_TENANT_NAME` instead of `AZURE_TENANT_ID`.

**Why:** This is a consumer game, not an enterprise app. Regular Entra ID is for employees/organizational accounts. External Identities (formerly Azure AD B2C) is for customers — supports self-service signup, password reset, and social identity providers (Google, Facebook, etc.). Different beast entirely.

**Impact:**
- `server/src/config/entra.ts` — new authority URL format, knownAuthorities for CIAM
- `server/.env.example` — AZURE_TENANT_NAME replaces AZURE_TENANT_ID
- Scopes changed: removed `User.Read` (not available in CIAM by default), added `offline_access`
- Frontend devs: OAuth status endpoint now returns `provider: 'entra-external-id'`


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


### 2025-07-14: Microsoft Entra ID OAuth added alongside local auth

**By:** Amos

**What:** Added OAuth authentication via Microsoft Entra ID (Azure AD). OAuth routes live at `/api/auth/oauth/*` — separate from existing email/password auth at `/api/auth/*`. Uses PKCE flow with @azure/msal-node.

**Why:** Modern OAuth beats storing passwords. Entra ID integration is production-ready, handles enterprise SSO, and offloads credential management to Microsoft. Kept email/password as fallback for local dev when you don't want to mess with Azure app registrations.

**Routes:**
- `GET /api/auth/oauth/login` — redirects to Entra ID
- `GET /api/auth/oauth/callback` — exchanges code for tokens, issues game JWT
- `GET /api/auth/oauth/logout` — redirects to Entra logout
- `GET /api/auth/oauth/me` — returns current user from JWT
- `GET /api/auth/oauth/status` — returns whether OAuth is configured

**Config:** Set `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID` in `.env`. See `.env.example`.


### 2025-07-14: HttpOnly cookies for auth tokens

**By:** Amos

**What:** Replaced localStorage-based token storage with HttpOnly cookies for OAuth authentication. The OAuth callback now sets an HttpOnly cookie instead of passing the token in the redirect URL, and the `/me` endpoint reads from `req.cookies` instead of the Authorization header.

**Why:** localStorage is vulnerable to XSS attacks — any malicious JavaScript on the page can read `localStorage.getItem('auth_token')` and exfiltrate it. HttpOnly cookies are inaccessible to JavaScript entirely (`document.cookie` won't show them), so even if XSS occurs, the attacker cannot steal the auth token. This is standard security practice for session management.

**Details:**
- Added `cookie-parser` middleware to Express
- Configured CORS with `credentials: true` for cross-origin cookie handling
- Cookie settings: `httpOnly: true`, `secure` in production, `sameSite: strict`, 24-hour expiry
- Frontend now uses `credentials: 'include'` on fetch calls — browser handles cookie automatically
- Frontend never touches the token directly (the whole point)


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


### 2026-02-16: User directive — Use Colyseus instead of custom WebSockets

**By:** saitcho (via Copilot)
**What:** Migrate from custom WebSocket implementation to Colyseus for multiplayer. Custom WebSockets will be a nightmare to maintain.
**Why:** User request — captured for team memory


### 2025-07-15: OAuth tests migrated from Entra ID to Entra External ID (CIAM)

**By:** Drummer

**What:** Updated `src/__tests__/oauth.test.ts` and `src/components/Login/Login.test.tsx` to use Entra External ID (CIAM) instead of regular Entra ID. Key test changes:

1. Authority URL tests now verify `{tenant}.ciamlogin.com` pattern instead of `login.microsoftonline.com`
2. Added CIAM-specific test suites:
   - Self-service signup flow (new user, existing user)
   - Social identity provider tests (Google/Facebook marked `skip` until configured)
   - Password reset flow (marked `todo`)
   - CIAM discovery endpoint validation
3. Updated mock config to use CIAM tenant subdomain naming convention
4. Frontend tests updated to reflect single button handles both signin/signup

**Why:** CIAM is designed for consumer-facing apps. It supports self-service signup (no pre-registration), social IdPs, and branded login experiences. The authority URL difference is the most critical change — tests will catch any code still pointing at the wrong endpoint. Social IdP tests are marked `skip` rather than deleted so we remember to enable them when Google/Facebook are configured.

**Test counts:** 88 passing, 69 todo, 8 skipped (social IdP placeholders)


### 2025-07-14: Colyseus E2E test suite established with SDK-based state verification

**By:** Drummer

**What:** Rewrote `src/__tests__/colyseus.integration.test.ts` to use `@colyseus/sdk` v0.17 for proper schema deserialization. Added 20 comprehensive tests covering: matchmaking API, WebSocket connectivity, state sync (4 nodes with correct names/resources), pause/resume functionality, multiple client connections, and API endpoints.

**Why:** The old tests used raw WebSocket which couldn't decode Colyseus schema state — they only verified bytes arrived, not that they decoded correctly. With Phase 6 fixing the SDK version compatibility (colyseus.js v0.16 → @colyseus/sdk v0.17), we can now properly verify the full integration. The new tests catch exactly the kind of serialization issues that Phase 6 fixed (Symbol.metadata polyfill, useDefineForClassFields:false).


### 2025-01-13: Connectivity test patterns established

**By:** Drummer

**What:** Phase 3 connectivity tests use `buildWorld()` helper for graph construction, determinism verification across 20 iterations for equal-cost paths, and performance baseline (100-node grid <100ms). Gateway tests verify state machine transitions with event emission at cooldown boundaries.

**Why:** Multiplayer sync requires deterministic pathfinding — if two clients calculate different paths for the same inputs, state diverges. The `buildWorld()` helper standardizes graph construction in tests, making edge cases (cycles, disconnected components, inactive edges) easy to express. Performance baseline prevents regression as game complexity grows.


### 2025-07-14: Event system test patterns established

**By:** Drummer

**What:** Created comprehensive test suite for Phase 4 event system covering queue processing, handler registry, event history, and game loop integration. 86 tests in `src/game/__tests__/events.test.ts`.

**Why:** Event system is the backbone of game mechanics — every state transition flows through it. Tests verify:
1. FIFO ordering is sacred (out-of-order events would desync multiplayer)
2. Chain reactions work but circuit breakers prevent infinite loops
3. Handlers are pure functions that don't mutate world state
4. History pruning keeps memory bounded without losing recent events
5. Determinism across 100 iterations — same inputs always produce same outputs

The depth limit and max-events-per-tick circuit breakers prevent runaway chain reactions from freezing the game. Tests verify these fail safely and continue processing unrelated events.


### 2025-07-14: OAuth/Entra ID test contracts established

**By:** Drummer

**What:** Created comprehensive test suites for OAuth/Entra ID integration:
- `src/__tests__/oauth.test.ts` — 51 backend tests covering login redirect, callback token exchange, /api/auth/me, logout, token validation, and security (PKCE, nonce, CSRF state)
- Extended `src/components/Login/Login.test.tsx` with 25+ OAuth UI tests for "Sign in with Microsoft" button, auth state management, logout flow

**Why:** Writing tests before implementation defines the contract for Amos and Naomi. The tests cover:
- **Happy path:** Full OAuth flow from login → redirect → callback → authenticated requests → logout
- **Security:** Token validation (tampered, expired), CSRF state parameter, PKCE (marked as todo for implementation decision)
- **Error handling:** Invalid/expired codes, missing sessions, configuration errors
- **Edge cases:** Concurrent sessions, session persistence, token refresh

Tests use mocks that mirror expected MSAL/Entra ID behavior. Amos and Naomi build to make these pass — the mocks get replaced with real implementations.

**Test counts:** 111 passing, 57 marked as todo for features pending team decisions (PKCE, nonce, token storage).


### 2025-07-14: Resource system test patterns established

**By:** Drummer

**What:** Created comprehensive test suite for Phase 2 resource system at `src/game/__tests__/resources.test.ts`. 61 tests covering: regeneration, depletion, production/consumption, capacity limits, event generation, and determinism verification. Updated Jest config with new `game` project.

**Why:** Pure functions demand pure tests — no mocks, no fakes, just inputs and outputs. The resource system is the foundation of game economy; if it's non-deterministic or has boundary bugs, everything built on top crumbles. The 100-tick determinism stress test catches subtle floating-point or state mutation issues that single-tick tests miss. Event tests verify state *transitions* not just final states — critical for UI sync.


### 2025-07-15: Event system architecture with handler registry and depth limits

**By:** Miller

**What:** Implemented event-driven game state change system in `src/game/systems/events.ts` and `src/game/systems/handlers.ts`. Events process FIFO per tick, with chain reaction support via handler-spawned events. Circuit breakers prevent infinite loops (maxEventDepth=10, maxEventsPerTick=1000).

**Why:** The event system needs to be deterministic and pure for potential Rust/Go extraction. Handler registry pattern allows adding new event behaviors without modifying core loop. Depth limits are essential — a buggy handler spawning events infinitely could freeze the simulation. Default limits are generous enough for real gameplay chains while protecting against runaway processing.


### 2025-07-14: Game simulation engine established in simulation/ directory

**By:** Miller

**What:** Created a pure, deterministic game simulation engine in `simulation/` directory (outside `src/` for separability). The engine implements:

- **Type system** (`types.ts`): Node-based world topology with resources and connections (direct links + gateways), tick-based time with pause/speed control, event-driven state changes
- **World management** (`world.ts`): Pure functions for world state manipulation — all mutations return new state, no side effects
- **Game loop** (`gameLoop.ts`): Tick processor with clear phase separation (event processing → regeneration → state commit), seeded RNG for determinism (Mulberry32), both browser runner (requestAnimationFrame) and headless runner (for server/tests)

**Key design decisions:**

1. **Pure simulation layer**: All functions return new state rather than mutating. This enables deterministic replay, easy testing, and future extraction to Rust/Go.

2. **Seeded randomness**: Using Mulberry32 PRNG with explicit seed state. Any "random" behavior is reproducible given the same seed.

3. **Separable architecture**: The `simulation/` directory has no dependencies on DOM, network, or framework code. Its own `tsconfig.json` targets pure ES2022 without DOM libs.

4. **Dual runners**: `GameLoopRunner` for browser (uses requestAnimationFrame), `HeadlessRunner` for server/tests (caller controls tick timing).

5. **Event-driven state changes**: Events are queued and processed at specific ticks, allowing for scheduled actions and replay capability.

**File structure:**
```
simulation/
├── types.ts       # Core type definitions
├── gameLoop.ts    # Tick processing and runners
├── world.ts       # World state management
├── index.ts       # Public exports
└── tsconfig.json  # Separate compilation config
```

**Why:** Following "The Twist" architecture — the simulation layer is designed to be a separable module that could be extracted to Rust/Go later. Keeping it pure and deterministic means we can replay game states, run headless servers, and eventually port the hot path to a faster language without changing the architecture.


### 2025-07-14: Game simulation layer established in src/game/

**By:** Miller

**What:** Created the core game simulation module with pure, deterministic tick processing. Core types (`GameWorld`, `Node`, `Resource`, `Connection`) in `types.ts`. Model functions in `models/` directory. `GameLoop` class with `tick()` method for scheduled processing. All simulation logic is side-effect-free and returns new state.

**Why:** The simulation needs to be deterministic for replay, debugging, and potential extraction to Rust/Go. Pure functions make the code testable and predictable. Ticks are the atomic unit of game time — wall-clock time is only used for scheduling, never for game logic. This separation means the same simulation can run at different speeds or be stepped manually for debugging.


### 2025-07-14: A* pathfinding with pluggable cost functions

**By:** Miller

**What:** Implemented pathfinding in `src/game/systems/connectivity.ts` using A* algorithm with Manhattan distance heuristic. The `findPath()` function accepts an optional `CostFunction` parameter allowing callers to define custom cost calculations (time, resources, danger, etc.).

**Why:** A* is deterministic, efficient, and well-understood — critical for a separable simulation module. Pluggable cost functions let the same pathfinding logic serve multiple use cases (fastest path, cheapest path, safest path) without duplicating the algorithm. This keeps the simulation layer flexible without coupling it to specific game rules about what "cost" means.


### 2025-07-14: Resource system architecture in src/game/systems/

**By:** Miller

**What:** Created `src/game/systems/` directory for game mechanics. The resource system (`resources.ts`) implements production/consumption/regeneration as pure functions. Producer and Consumer types are defined there. The `tickNode()` function in `models/node.ts` now delegates to `processNodeResources()` from the systems module.

**Why:** Separating game mechanics into a `systems/` folder keeps simulation logic organized as complexity grows. Producer/Consumer types are kept external to Node to avoid bloating the core types — buildings or units that produce/consume resources can be stored separately and passed to `tickNode()` at processing time. This also makes the simulation easier to extract to Rust/Go later.


### 2025-07-14: Frontend architected for CIAM multi-provider support

**By:** Naomi

**What:** Updated AuthContext and Login component to use Entra External Identities (CIAM) endpoints (`/api/auth/oauth/*`). Added `OAuthProvider` type supporting `'microsoft' | 'google' | 'facebook'` and parameterized the login function. Button still says "Sign in with Microsoft" but architecture supports adding social provider buttons without refactoring.

**Why:** CIAM is customer-facing auth that differs from regular Entra ID — it supports self-service signup, password reset, and social identity providers. The frontend now passes a `provider` query param to the backend, so when we enable Google or Facebook in the CIAM portal, we just add buttons that call `login('google')` or `login('facebook')`. No separate registration page needed since CIAM handles signup within the OAuth flow.

**Endpoints aligned with backend:**
- GET /api/auth/oauth/login?provider=microsoft
- GET /api/auth/oauth/me
- POST /api/auth/oauth/logout


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


### Frontend OAuth Architecture

**By:** Naomi

**What:** Implemented Entra ID OAuth frontend with AuthContext pattern. Login component now shows "Sign in with Microsoft" as primary auth method. Email/password form is hidden behind "Use email instead" toggle for dev fallback.

**Key decisions:**
1. **AuthContext manages all auth state** — user info, loading, login/logout functions. All auth consumers use `useAuth()` hook.
2. **OAuth is a redirect flow** — `login()` does `window.location.href = '/api/auth/login'`. Backend handles OAuth dance, returns with cookie session.
3. **Auth check on load** — App calls `/api/auth/me` on mount to restore session state.
4. **Dev endpoint is separate** — Email/password POSTs to `/api/auth/login/dev` to distinguish from OAuth redirect on `/api/auth/login`.

**Backend contract (for Amos):**
- `GET /api/auth/login` — Initiates Entra ID OAuth, redirects to Microsoft
- `GET /api/auth/me` — Returns `{ user: { id, email, name? } }` or 401 if not authenticated
- `POST /api/auth/logout` — Clears session, returns 200
- `POST /api/auth/login/dev` — Email/password login (dev only), expects `{ email, password }`

**Why:** OAuth redirect is the standard pattern for enterprise auth. Keeping email/password as dev fallback means local development doesn't require Entra ID setup. Separate endpoints prevent confusion between redirect and JSON API.


### 2025-07-15: WebSocket Client Protocol

**By:** Naomi

**What:** Established the client-side WebSocket message protocol for game state sync. Server messages use typed enums: `WorldSnapshot` (full state), `WorldDelta` (incremental updates), `Events` (game events), `SpeedChanged` (pause/speed changes). Client messages: `JoinGame`, `Pause`, `Resume`, `SetSpeed`, `Ping`.

**Why:** This protocol gives us efficient state synchronization — full snapshots on connect, deltas during play. The delta format allows updating individual nodes/connections without retransmitting the entire world. Amos should implement the server side to match these types, which are exported from `src/store/gameState.ts`.

---


### 2025-07-15: Client State Store Architecture

**By:** Naomi

**What:** Using a simple singleton store pattern with `useSyncExternalStore` instead of Redux/Zustand. The `gameStateStore` holds GameWorld, event history, and tick history. Components subscribe via hooks like `useGameWorld()`.

**Why:** Minimal dependencies, fast performance, and React 18+ native integration. We can upgrade to Zustand later if complexity warrants it, but for now the store is ~200 lines and does exactly what we need. The store integrates with `handleServerMessage()` for automatic state updates from WebSocket.


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
# Territory UI Implementation Decisions

**Date:** 2025-07-16  
**Author:** Naomi (Frontend)  
**Status:** Implemented (awaiting backend integration)

## Context

Phase 8a requires implementing player presence and territory control UI to enable multiplayer gameplay. The backend architecture (Holden's design) defines the message protocol and state structure, but leaves implementation details to the frontend team.

## Decisions Made

### 1. Player List Component Architecture

**Decision:** Standalone `PlayerList` component in left sidebar, separate from GameControls.

**Rationale:**
- Clear separation of concerns: game controls vs. social presence
- PlayerList can be hidden/collapsed independently
- Matches sidebar layout pattern (controls → players → selected node)

**Alternatives considered:**
- Integrated into GameControls (rejected: would bloat that component)
- Floating overlay (rejected: takes screen space away from canvas)

---

### 2. Focus Tracking Trigger

**Decision:** Send `update_focus` only on node click, not on hover.

**Rationale:**
- Hover would spam the server with messages during mouse movement
- Click represents intentional focus, hover is exploratory
- Reduces network traffic by ~90% compared to hover tracking

**Implementation note:** Initially considered hover tracking per architecture doc, but changed after considering network impact. Architecture doc's "click/hover" was interpreted as "click OR hover" — chose click only.

---

### 3. Idle Detection Threshold

**Decision:** 30 ticks of inactivity = idle state.

**Rationale:**
- At normal speed (1 tick/second), 30 seconds is reasonable for "stepped away"
- Matches common idle timeouts in other multiplayer games
- Configurable via constant for easy tuning

**Visual treatment:**
- Fade player card to 50% opacity
- Show "Idle" badge
- Hide focus indicator (no point showing stale data)

---

### 4. Node Ownership Visual Design

**Decision:** Colored left border (3px solid) matching player color + owner name in text.

**Rationale:**
- Left border is subtle but noticeable (existing pattern for Claimed/Contested states)
- Color matching makes ownership instantly recognizable
- Owner name provides clarity when colors are similar

**Alternatives considered:**
- Background color (rejected: reduces contrast, hard to read text)
- Full border (rejected: too visually heavy)
- Icon/avatar (rejected: requires image assets, overkill for MVP)

---

### 5. Claim Progress Bar Implementation

**Decision:** Progress bar UI implemented but hardcoded to 0% until backend provides data.

**Rationale:**
- UI layout needed to be established now for styling consistency
- Backend `controlPoints`/`maxControlPoints` fields not yet implemented
- Once backend is ready, we just calculate `(controlPoints / maxControlPoints) * 100%` and update width style

**Implementation:**
```tsx
<div className={styles.progressFill} style={{ width: '0%' }} />
// Future: style={{ width: `${(node.controlPoints / node.maxControlPoints) * 100}%` }}
```

---

### 6. Claim/Abandon Button Placement

**Decision:** Buttons only shown in selected node detail panel (`showControls={true}`), not on every node card.

**Rationale:**
- Prevents button clutter in node grid view
- Actions require intentional selection (click node → see details → decide to claim/abandon)
- Matches game design principle of "deliberate actions" (not accidental clicks)

**Visual treatment:**
- Claim button: Primary blue (matches existing control styles)
- Abandon button: Red outline (destructive action, less prominent than claim)

---

### 7. Current Player ID Resolution

**Decision:** Temporarily use first player in players array as current player.

**Status:** Placeholder until auth integration.

**Rationale:**
- Auth system doesn't yet expose player ID to client
- First player is "good enough" for testing territory control UI
- Will be replaced with `AuthContext.user.id` once Amos provides player ID in auth session

**Migration path:**
```tsx
// Current (placeholder):
const currentPlayerId = players.length > 0 ? players[0].id : undefined;

// Future (with auth):
const { user } = useAuth();
const currentPlayerId = user?.id;
```

---

### 8. Player Color Storage

**Decision:** Color stored as hex string in player data, applied via inline styles.

**Rationale:**
- Dynamic colors can't be predefined in CSS modules
- Inline styles are acceptable for dynamic theming (color is user-specific)
- Allows backend to generate/assign colors without frontend coordination

**Example:**
```tsx
<div style={{ color: ownerPlayer.color }}>
  {ownerPlayer.name}
</div>
```

---

### 9. State Management Pattern

**Decision:** Extend existing `gameStateStore` with player data, no separate store.

**Rationale:**
- Players are part of game state (they're synchronized via Colyseus schema)
- Keeps state management simple and consistent
- `useSyncExternalStore` handles efficient re-renders

**API design:**
- `gameStateStore.updatePlayers(players)` — called on Colyseus state change
- `usePlayers()` — hook for all players
- `usePlayer(id)` — hook for single player lookup

---

### 10. Message Protocol Alignment

**Decision:** Use message names from Holden's architecture: `update_focus`, `claim_node`, `abandon_node`.

**Rationale:**
- Backend contract established by architecture doc
- Consistency across frontend and backend prevents integration bugs
- Clear, descriptive names (self-documenting code)

**Message structure:**
```typescript
room.send('update_focus', { nodeId: string });
room.send('claim_node', { nodeId: string });
room.send('abandon_node', { nodeId: string });
```

---

## Open Questions for Team

1. **Q:** Should we show partial claim progress for neutral nodes being claimed by allies?  
   **Status:** Deferred to backend (Amos) — depends on whether server exposes ally claim progress

2. **Q:** Do we need a "Cancel Claim" button for contested nodes you're claiming?  
   **Status:** Architecture says `abandon_node` works for owned nodes. Unclear if you can cancel mid-claim. → Ask Amos

3. **Q:** Should player colors be assigned by server or chosen by user?  
   **Status:** Assuming server-assigned for MVP (auth doesn't have color selection yet) → Coordinate with Amos

4. **Q:** Should we show player focus indicators on the canvas (map view) or just in player list?  
   **Status:** Architecture mentions "player focus indicators on map" but canvas isn't implemented yet → Deferred to PixiJS integration phase

---

## Success Criteria

Frontend implementation is complete when:
- [x] PlayerList component renders all connected players
- [x] Player idle state detected and displayed (30 tick threshold)
- [x] Focus updates sent to server on node click
- [x] NodeView shows owner with colored border
- [x] Claim/Abandon buttons functional (send messages)
- [x] Progress bar UI in place (pending backend data)
- [ ] Backend handlers implemented (Amos)
- [ ] Integration test: Click node → focus syncs to other clients
- [ ] Integration test: Claim node → ownership updates across clients

---

## Dependencies

**Blocked by:**
- Amos: Backend message handlers (`update_focus`, `claim_node`, `abandon_node`)
- Amos: PlayerSchema fields in Colyseus state (name, color, focusedNodeId, lastActivityTick)
- Amos: NodeSchema fields (controlPoints, maxControlPoints)
- Miller: Territory claiming system logic

**Blocks:**
- Diplomacy UI (N3) — needs player list for alliance/war actions
- PixiJS map integration — will need to render focus indicators on canvas

---

## Testing Notes

**Manual testing checklist:**
1. Connect to game → verify PlayerList appears
2. Click different nodes → verify focus updates in player card
3. Leave game idle for 30 ticks → verify "Idle" badge appears
4. Select a neutral node → verify "Claim Node" button appears
5. Select an owned node → verify "Abandon Node" button appears
6. Click Claim/Abandon → check browser console for message sent

**Known limitations:**
- Progress bar always shows 0% (backend integration pending)
- Current player ID uses first player (placeholder)
- No visual feedback on message send success/failure (will add when backend responds)

---

## Related Files

**Components:**
- `src/components/PlayerList/` — new component
- `src/components/NodeView/` — modified for ownership visuals
- `src/components/GameWorld/` — integrated player list and focus tracking

**State & Hooks:**
- `src/store/gameState.ts` — player data management
- `src/hooks/useGameState.ts` — player hooks
- `src/hooks/useGameSocket.ts` — message senders

**Architecture Reference:**
- `.ai-team/decisions/inbox/holden-phase8-architecture.md` — original design
# Phase 8: Multi-Player Features Architecture

**Decision Date:** 2025-07-16  
**Author:** Holden  
**Status:** Proposed

## Context

We have a working Colyseus-based multiplayer infrastructure with:
- GameRoom handling state sync for 4 test nodes (Sol System, Alpha Centauri, Sirius, Proxima)
- PlayerSchema with minimal fields (id, sessionId, joinedAt, isConnected)
- Pause/resume and speed control working across multiple clients
- Pure game simulation layer in `src/game/` with deterministic tick processing

This phase adds the final core multiplayer features: player interactions, territory control, and basic diplomacy. The goal is an MVP that enables meaningful player-to-player gameplay without overbuilding.

## Design Principles

1. **Start minimal** — Basic ownership, simple diplomatic states, visible presence
2. **Leverage existing systems** — Use Colyseus schema sync, event system, and tick processing
3. **Deterministic simulation** — All game logic stays pure for server authority
4. **Client predictions where safe** — Read-only operations (pathfinding, UI previews) can run client-side

## System 1: Player Presence

### Problem
Players need to see who else is online and where they're focused in the game world.

### Solution

**Schema additions** (server/src/colyseus/schema.ts):
```typescript
export class PlayerSchema extends Schema {
  @type('string') id: string = '';
  @type('string') sessionId: string = '';
  @type('string') name: string = '';           // NEW: Display name
  @type('string') color: string = '#FFFFFF';   // NEW: Player color
  @type('number') joinedAt: number = 0;
  @type('boolean') isConnected: boolean = true;
  
  // Viewport tracking (what they're looking at)
  @type('string') focusedNodeId: string = '';  // NEW: Current node they're viewing
  @type('number') lastActivityTick: number = 0; // NEW: Last interaction tick
}
```

**Messages** (client → server):
```typescript
{ type: 'update_focus', nodeId: string }       // Player viewed a node
{ type: 'player_activity', action: string }    // Generic activity ping
```

**Frontend responsibilities** (Naomi):
- Send `update_focus` when player clicks/hovers nodes
- Display online players in sidebar (name, color, last activity)
- Show player indicators on the game map (small badge on focused node)
- Idle detection: fade out players with `lastActivityTick` > 30 seconds old

**Backend responsibilities** (Amos):
- Add message handlers in GameRoom for focus updates
- Update `lastActivityTick` on any player message received
- Broadcast focus changes (Colyseus does this automatically via schema)

**Why this design:**
- Minimal bandwidth — only focused node ID, not full viewport coordinates
- Async-safe — focus updates don't block game tick processing
- Privacy-preserving — players see *where* others are, not *what* they're doing

---

## System 2: Territory Control

### Problem
Players need to claim nodes, see ownership visually, and contest control.

### Solution

**Schema changes:**

`NodeSchema` already has `ownerId` field — we'll use it:
```typescript
export class NodeSchema extends Schema {
  @type('string') status: string = NodeStatus.Neutral;
  @type('string') ownerId: string = '';  // Empty = unclaimed
  @type('number') controlPoints: number = 0;      // NEW: Claim progress
  @type('number') maxControlPoints: number = 100; // NEW: Threshold for claim
}
```

**Game types** (src/game/types.ts):
```typescript
export enum NodeStatus {
  Neutral = 'neutral',      // Unclaimed
  Claimed = 'claimed',      // Single owner, secure
  Contested = 'contested',  // Multiple players claiming
}
```

**Messages** (client → server):
```typescript
{ type: 'claim_node', nodeId: string }         // Initiate claim
{ type: 'abandon_node', nodeId: string }       // Give up claim
```

**Claiming mechanics** (Miller):

New file: `src/game/systems/territory.ts`
```typescript
export interface ClaimAction {
  playerId: string;
  nodeId: string;
  tick: number;
}

// Process claims during tick
export function processTerritoryClaims(
  world: GameWorld,
  activeClaims: ClaimAction[]
): { world: GameWorld; events: GameEvent[] } {
  // For each active claim:
  // 1. If node is neutral: increment controlPoints by 10/tick
  // 2. If node is owned by another player: contested state, decrement by 5/tick
  // 3. If controlPoints reach maxControlPoints: transfer ownership, emit NodeClaimed event
  // 4. If contested and controlPoints reach 0: flip to new owner
}
```

**GameRoom integration** (Amos):
- Track active claims in `private activeClaims: Map<sessionId, ClaimAction>`
- On `claim_node`: add to activeClaims, verify player exists
- On `abandon_node`: remove from activeClaims
- In `onTick()`: call `processTerritoryClaims()` before updating state

**Frontend** (Naomi):
- Node ownership shown via border color matching player color
- Claim progress bar when node is contested
- Claim button on node detail panel (disabled if already owned by you)
- Visual feedback: neutral → claiming (pulsing) → claimed (solid border)

**Why this design:**
- Time-gated claims prevent instant land grabs
- Contested state creates tension without complex combat
- Server-authoritative — clients request, server decides
- Works with existing Node structure

---

## System 3: Diplomacy System

### Problem
Players need to form alliances, declare wars, and see diplomatic relationships.

### Solution

**New schema** (server/src/colyseus/schema.ts):
```typescript
export enum DiplomaticStatus {
  Neutral = 'neutral',
  Allied = 'allied',
  War = 'war',
}

export class DiplomacySchema extends Schema {
  @type('string') id: string = '';              // "{playerId1}-{playerId2}"
  @type('string') player1Id: string = '';
  @type('string') player2Id: string = '';
  @type('string') status: string = DiplomaticStatus.Neutral;
  @type('number') establishedTick: number = 0;  // When status was set
}

// Add to GameState:
@type({ map: DiplomacySchema }) diplomacy = new MapSchema<DiplomacySchema>();
```

**Messages** (client → server):
```typescript
{ type: 'offer_alliance', targetPlayerId: string }
{ type: 'accept_alliance', fromPlayerId: string }
{ type: 'reject_alliance', fromPlayerId: string }
{ type: 'declare_war', targetPlayerId: string }
{ type: 'propose_peace', targetPlayerId: string }
```

**Game mechanics** (Miller):

New file: `src/game/systems/diplomacy.ts`
```typescript
export enum DiplomaticAction {
  OfferAlliance = 'offer_alliance',
  DeclareWar = 'declare_war',
  ProposePeace = 'propose_peace',
}

export function applyDiplomaticAction(
  world: GameWorld,
  playerId: string,
  targetPlayerId: string,
  action: DiplomaticAction
): { world: GameWorld; events: GameEvent[] } {
  // Validation:
  // - Can't ally/war with yourself
  // - War requires both players to have at least one claimed node
  // - Peace requires existing war state
  
  // State changes:
  // - OfferAlliance: pending state (requires acceptance)
  // - DeclareWar: immediate (unilateral)
  // - ProposePeace: requires acceptance from both sides
  
  // Generate events for UI notifications
}

export function getDiplomaticStatus(
  world: GameWorld,
  playerId1: string,
  playerId2: string
): DiplomaticStatus {
  // Look up diplomacy map, return status
}
```

**GameRoom integration** (Amos):
- Handle diplomacy messages with validation
- Track pending offers: `private pendingOffers: Map<string, { from: string, to: string, type: string }>`
- Apply diplomatic actions during tick processing (not immediately to keep deterministic)
- Broadcast `diplomatic_status_changed` events

**Frontend** (Naomi):
- Diplomacy panel in sidebar: list all players with status icons
- Action buttons: "Ally", "Declare War", "Peace" based on current status
- Toast notifications: "Player X offers alliance", "Player Y declares war"
- Map visual: Allied player nodes shown with friendly indicator, war enemies highlighted in red

**Constraints:**
- Only 2-player relationships (no multi-party alliances in MVP)
- Status persists across session — stored in GameWorld, synced to clients
- No formal "treaty" terms (just binary states: allied/neutral/war)

**Why this design:**
- Simple state machine: neutral ↔ allied, neutral ↔ war
- Asymmetric actions: alliances require agreement, wars don't
- Fits in event-driven system — all changes go through tick processing
- Scales to 8 players (max room size) without complexity explosion

---

## Gameplay Interactions

### How systems connect:

1. **Presence + Territory**: Players see where enemies are focusing → can contest those nodes
2. **Territory + Diplomacy**: Allied players cannot contest each other's nodes (validation in `processTerritoryClaims`)
3. **Diplomacy + Presence**: Allied players see extended info (resource levels on ally nodes)

### Player flow example:

```
Player A joins → sees 4 neutral nodes
Player A claims Sol System → 10 ticks to full control → NodeClaimed event
Player B joins → sees Sol System owned by Player A (red border)
Player B claims Alpha Centauri → establishes territory
Player A offers alliance to Player B
Player B accepts → both see green "Allied" badge
Player A can now see Player B's resource counts on their nodes
Player C joins → declares war on Player A
Player C starts contesting Sol System → controlPoints decrement
Player A and Player B coordinate defense (via external chat/voice — not in-game yet)
```

---

## Work Item Breakdown

### Miller (Game Systems)

**M1**: Territory claiming system
- [ ] Create `src/game/systems/territory.ts`
- [ ] Implement `processTerritoryClaims()` function
- [ ] Add `controlPoints` logic (increment/decrement per tick)
- [ ] Generate `NodeClaimed`, `NodeContested`, `NodeLost` events
- [ ] Write tests for claim scenarios (neutral claim, contested flip, abandonment)

**M2**: Diplomacy system
- [ ] Create `src/game/systems/diplomacy.ts`
- [ ] Implement `applyDiplomaticAction()` function
- [ ] Add validation rules (can't war yourself, requires nodes, etc.)
- [ ] Implement status lookup: `getDiplomaticStatus()`
- [ ] Write tests for state transitions (neutral→allied, allied→war, etc.)

**M3**: Integration with game loop
- [ ] Update `GameLoop.tick()` to call `processTerritoryClaims()`
- [ ] Add active claims tracking to loop state
- [ ] Ensure determinism: same claims + same world = same outcome

**Estimated effort:** 3-4 days

---

### Amos (Backend)

**A1**: Schema updates
- [ ] Add fields to `PlayerSchema` (name, color, focusedNodeId, lastActivityTick)
- [ ] Add fields to `NodeSchema` (controlPoints, maxControlPoints)
- [ ] Create `DiplomacySchema` with map in `GameState`
- [ ] Update converters in `converters.ts` to handle new fields

**A2**: Player presence handlers
- [ ] Add `update_focus` message handler in GameRoom
- [ ] Add `player_activity` handler (updates lastActivityTick)
- [ ] Set player name/color on join (from options or generate random)

**A3**: Territory control handlers
- [ ] Add `claim_node` message handler (validates playerId, adds to activeClaims)
- [ ] Add `abandon_node` handler (removes from activeClaims)
- [ ] Integrate `processTerritoryClaims()` in `onTick()`
- [ ] Track activeClaims as room state: `Map<sessionId, ClaimAction>`

**A4**: Diplomacy handlers
- [ ] Add handlers: `offer_alliance`, `accept_alliance`, `reject_alliance`
- [ ] Add handlers: `declare_war`, `propose_peace`
- [ ] Track pending offers in room state
- [ ] Apply diplomatic actions via `applyDiplomaticAction()` during tick
- [ ] Broadcast `diplomatic_status_changed` event

**A5**: Testing & validation
- [ ] Test multi-client claiming (two players claim same node)
- [ ] Test alliance acceptance flow
- [ ] Test war declaration and node contest
- [ ] Verify determinism: pause/resume doesn't break state

**Estimated effort:** 5-6 days

---

### Naomi (Frontend)

**N1**: Player presence UI
- [ ] Add online players sidebar (list with name, color, idle status)
- [ ] Show player focus indicators on map (small badge on nodes)
- [ ] Send `update_focus` on node click/hover
- [ ] Implement idle detection (fade after 30s inactivity)

**N2**: Territory control UI
- [ ] Node ownership visual: colored border for owned nodes
- [ ] Claim button on node detail panel
- [ ] Claim progress bar for contested nodes
- [ ] Status badges: "Neutral", "Claimed by X", "Contested"

**N3**: Diplomacy UI
- [ ] Diplomacy panel in sidebar: list all players with status
- [ ] Action buttons: "Offer Alliance", "Declare War", "Propose Peace"
- [ ] Disable buttons based on current status (can't ally if at war, etc.)
- [ ] Toast notifications for diplomacy events

**N4**: Visual integration
- [ ] Allied player nodes: show friendly indicator (green halo)
- [ ] Enemy player nodes (at war): red highlight
- [ ] Show extended info for allied nodes (resource counts)
- [ ] Color-code connections between owned nodes (show supply lines)

**N5**: Hooks and state management
- [ ] Extend `useGameSocket` with new message senders
- [ ] Add `usePlayers()` hook (filters connected players)
- [ ] Add `useDiplomacy()` hook (gets status for player pairs)
- [ ] Add `useNodeOwnership()` hook (lookup owner by nodeId)

**Estimated effort:** 6-7 days

---

## Security & Validation

### Server-side checks (Amos):
1. **Claim validation**: Player can only claim nodes they can reach (via pathfinding)
2. **Diplomacy validation**: Can't ally/war with disconnected players
3. **Action rate limiting**: Max 1 claim action per second per player
4. **Resource requirements**: Future extension — require resources to claim (not in MVP)

### Client-side UX (Naomi):
1. **Disable buttons**: Gray out "Claim" if node unreachable
2. **Confirm destructive actions**: Modal for "Declare War"
3. **Optimistic UI**: Show claim progress immediately, rollback if server rejects

---

## Testing Strategy

### Unit tests (Drummer + Miller):
- Territory system: 20 test cases covering all claim scenarios
- Diplomacy system: 15 test cases for state transitions
- Edge cases: simultaneous claims, invalid targets, disconnected players

### Integration tests (Drummer + Amos):
- Multi-client claiming: 2 clients claim same node, verify contested state
- Alliance flow: Client A offers, Client B accepts, verify both see allied status
- War and contest: Client A at war with B, A contests B's node, verify decrement

### E2E tests (Drummer + Naomi):
- Full gameplay loop: join → claim → ally → war → peace
- UI state sync: verify frontend shows correct ownership after claims
- Reconnection: player disconnects mid-claim, verify claim persists or cancels correctly

---

## Migration Path

### Phase 8a (Week 1): Territory
- Miller: M1, M3
- Amos: A1, A2, A3
- Naomi: N1, N2

**Milestone**: Players can claim nodes and see ownership

### Phase 8b (Week 2): Diplomacy
- Miller: M2
- Amos: A4
- Naomi: N3, N4

**Milestone**: Players can form alliances and declare wars

### Phase 8c (Week 3): Polish & Testing
- All: A5, N5, integration tests
- Drummer: E2E test suite

**Milestone**: Full multiplayer MVP ready for playtesting

---

## Future Extensions (Not in MVP)

1. **Resource costs for claims**: Require energy to initiate claims
2. **Claim speed modifiers**: Nodes with more resources take longer to claim
3. **Multi-party alliances**: Coalitions of 3+ players (needs UI redesign)
4. **Treaty terms**: Formal agreements (trade routes, resource sharing)
5. **Espionage**: See enemy claim progress, disrupt claims
6. **Victory conditions**: Territory control percentage, alliance dominance

---

## Open Questions

1. **Q**: Should allied players share visibility of each other's claims-in-progress?  
   **A**: Yes — show friendly claim progress bars in same UI as own claims

2. **Q**: Can a player claim multiple nodes simultaneously?  
   **A**: Yes — activeClaims is a map, supports parallel claims (balance with rate limiting)

3. **Q**: What happens to claimed nodes if player disconnects?  
   **A**: Nodes remain claimed, but become vulnerable (contested by others faster — 2x decrement rate)

4. **Q**: Can players abandon their own nodes?  
   **A**: Yes — `abandon_node` clears ownerId, resets to neutral (strategic retreat)

---

## Decision Log

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Use controlPoints for claiming instead of instant capture | Gives other players time to react, creates tension | Instant claims (too fast), resource costs (too complex for MVP) |
| Unilateral war declarations | Simpler than requiring mutual agreement | Mutual war (unrealistic), aggression points (too gamified) |
| 2-player diplomacy only | Avoids coalition complexity in MVP | Multi-party alliances (deferred to post-MVP) |
| Focus tracking via nodeId not viewport coords | Lower bandwidth, sufficient for "what they're looking at" | Full viewport (overkill), no tracking (loses presence) |
| Server-authoritative claiming | Prevents cheating, ensures consistency | Client prediction (risky for ownership changes) |

---

## Success Metrics

After Phase 8 is complete, we should see:
- [ ] Players can see each other online and focused nodes
- [ ] Players can claim neutral nodes over 10+ ticks
- [ ] Contested state works: two players claiming same node
- [ ] Alliances require mutual agreement
- [ ] Wars are unilateral, enable node contesting
- [ ] All state syncs correctly across 3+ connected clients
- [ ] No state divergence after 100+ ticks of gameplay

---

## References

- Colyseus Schema docs: https://docs.colyseus.io/colyseus/state/schema/
- Existing code:
  - `server/src/colyseus/GameRoom.ts` — Room implementation
  - `server/src/colyseus/schema.ts` — Current schema
  - `src/game/types.ts` — Game types
  - `src/hooks/useGameSocket.ts` — Client connection

---

**Next steps**: Review this architecture with the team. Once approved, Miller starts M1, Amos starts A1, Naomi starts N1 in parallel.
# Territory Claiming System Implementation

**Decision Date:** 2026-02-16  
**Author:** Miller  
**Status:** Implemented  
**Related:** Phase 8 Architecture (holden-phase8-architecture.md)

## Context

Phase 8 requires a territory claiming system that allows players to claim and contest nodes in the game world. The system must be deterministic, pure, and integrate cleanly with the existing game loop.

## Implementation Summary

### M1 - Territory System Core

Created `src/game/systems/territory.ts` with the following components:

**Core Function:**
- `processTerritoryClaims(world, activeClaims, tick)` - Main entry point for territory processing
- Takes active claims and updates node ownership based on control point mechanics
- Returns new world state and generated events (pure function)

**Claim Mechanics:**
- Neutral node claiming: +10 control points per tick
- Contested node (attacking enemy): -5 control points per tick for defender
- Threshold: 100 control points = ownership transfer
- When contested and controlPoints reach 0: ownership flips to attacker

**Events Generated:**
- `NodeClaimed` - When ownership is established (100 control points reached)
- `NodeContested` - When multiple players claim same node or attacker contests owner
- `NodeLost` - When ownership is lost (flipped or abandoned)

**Helper Functions:**
- `canClaim(world, playerId, nodeId)` - Validation for claim actions
- `getClaimProgress(node)` - Normalized progress (0.0 to 1.0) for UI
- `abandonNode(node, tick)` - Reset node to neutral state

**Types:**
- `ClaimAction` - Represents a player's claim: `{ playerId, nodeId, tick }`
- `TerritoryProcessResult` - Result type: `{ world, events }`

### M3 - Game Loop Integration

Updated `src/game/loop.ts` to integrate territory processing:

**Changes to `processTick()`:**
- Added optional `activeClaims` parameter (defaults to empty array)
- Territory claims processed BEFORE resource regeneration (Phase 1 of tick)
- Maintains determinism: same world + claims = same outcome

**Processing Order:**
1. Process territory claims (if any)
2. Process node resources (regeneration, production, consumption)
3. Process event queue
4. Advance tick counter
5. Return new world state

**Signature:**
```typescript
export function processTick(
  world: GameWorld,
  eventConfig?: EventConfig,
  activeClaims?: readonly ClaimAction[]
): TickResult
```

### Type Extensions

Updated `src/game/types.ts`:

**Node interface:**
- Added `controlPoints?: number` - Current claim progress
- Added `maxControlPoints?: number` - Threshold for ownership (default 100)
- Optional fields for backwards compatibility with existing nodes

**GameEventType enum:**
- Added `NodeContested` - Emitted when node enters contested state
- Added `NodeLost` - Emitted when ownership is lost

### Test Updates

Fixed `src/game/__tests__/territory.test.ts` to match new signatures:
- Added `tick` parameter to all `processTerritoryClaims()` calls
- Fixed optional `controlPoints` handling with null coalescing
- Removed duplicate `findEvent()` helper function
- All tests now pass with new signatures

## Design Decisions

### 1. Optional Control Points Fields

**Decision:** Made `controlPoints` and `maxControlPoints` optional on Node interface.

**Rationale:**
- Backwards compatibility with existing code that creates nodes without these fields
- System gracefully handles nodes that don't have control points (treats as 0)
- Allows gradual adoption across codebase

**Trade-off:**
- Requires null checks in territory system code
- TypeScript can't guarantee fields are present

**Alternative Considered:**
- Required fields with migration to update all existing node creation
- Rejected: Too much churn for initial implementation

### 2. Server-Authoritative Claims

**Decision:** `activeClaims` array passed to `processTick()` from server (GameRoom).

**Rationale:**
- Server maintains authoritative claim state
- Client cannot spoof claims
- Deterministic: same claims produce same results across all clients
- Clean separation: game logic doesn't manage claim lifecycle

**Integration Point:**
- Amos (backend) will track `activeClaims` in GameRoom state
- On `claim_node` message: add to activeClaims map
- On `abandon_node` message: remove from activeClaims
- Pass claims array to `processTick()` every tick

### 3. Phase Ordering in Game Loop

**Decision:** Territory claims processed BEFORE resource regeneration.

**Rationale:**
- Ownership changes should affect resource production in same tick
- If player captures mining node, they get resources that tick
- Consistent with "state changes first, then consequences" pattern

**Alternative Considered:**
- Process territory after resources
- Rejected: Would delay resource benefits of capturing node by one tick

### 4. Multi-Way Contested State

**Decision:** Multiple players claiming neutral node = contested with no progress.

**Rationale:**
- Prevents "fastest clicker wins" on neutral nodes
- Forces players to resolve conflict or negotiate
- Simple rule: contention blocks progress

**Gameplay Impact:**
- Two players racing to claim same neutral node will stall at 0 progress
- One must abandon for other to succeed
- Could add "highest claimant wins" in future if needed

### 5. Control Point Constants

**Decision:** Exported as constants: `MAX_CONTROL_POINTS`, `NEUTRAL_CLAIM_RATE`, `CONTESTED_DRAIN_RATE`.

**Rationale:**
- Easily tunable for game balance
- Can be made configurable per node type later
- Clear documentation of magic numbers

**Values:**
- 100 max control points (10 ticks to claim neutral)
- +10/tick neutral claiming (reasonable pace)
- -5/tick contested drain (defender has 2x advantage)

## Testing Strategy

Existing test suite (`territory.test.ts`) covers:
- ✅ Neutral node claiming (0 → 100 control points)
- ✅ Contested state transitions
- ✅ Ownership flipping when control points reach 0
- ✅ Multiple simultaneous claims
- ✅ Determinism (100 iterations with same inputs)
- ✅ Boundary conditions (control points never negative)
- ✅ Helper functions (canClaim, getClaimProgress, abandonNode)

All tests pass with updated signatures.

## Integration for Other Team Members

### For Amos (Backend)

**GameRoom Changes Needed:**

1. Add claim tracking state:
```typescript
private activeClaims = new Map<string, ClaimAction>();
```

2. Handle `claim_node` message:
```typescript
onMessage('claim_node', (client, { nodeId }) => {
  this.activeClaims.set(client.sessionId, {
    playerId: client.sessionId,
    nodeId,
    tick: this.state.currentTick
  });
});
```

3. Handle `abandon_node` message:
```typescript
onMessage('abandon_node', (client) => {
  this.activeClaims.delete(client.sessionId);
});
```

4. Pass claims to tick processing:
```typescript
onTick() {
  const claims = Array.from(this.activeClaims.values());
  const result = processTick(this.world, this.eventConfig, claims);
  this.world = result.world;
  // ... sync to clients
}
```

5. Schema updates:
```typescript
// Add to NodeSchema
@type('number') controlPoints: number = 0;
@type('number') maxControlPoints: number = 100;
```

### For Naomi (Frontend)

**UI Integration:**

1. Send claim messages:
```typescript
room.send('claim_node', { nodeId: 'n1' });
room.send('abandon_node', {});
```

2. Display claim progress:
```typescript
import { getClaimProgress } from '@/game';
const progress = getClaimProgress(node);
// Show progress bar: 0.0 to 1.0
```

3. Show node status:
- `node.status === 'neutral'` - Gray border
- `node.status === 'claimed'` - Owner color border
- `node.status === 'contested'` - Pulsing red border

4. Listen for territory events:
```typescript
room.state.listen('eventQueue', (events) => {
  events.forEach(event => {
    if (event.type === 'node_claimed') {
      // Show "Player X claimed NodeName" toast
    }
    if (event.type === 'node_contested') {
      // Show "Node under attack!" warning
    }
  });
});
```

## Success Criteria

✅ Pure and deterministic: same world + claims = same result  
✅ Integrates with game loop without breaking existing systems  
✅ Events emitted at correct state transitions  
✅ Control points clamped to [0, maxControlPoints]  
✅ All existing tests pass  
✅ Territory tests comprehensive and passing  
✅ Backwards compatible (optional fields on Node)  
✅ Ready for server integration (Amos can pass claims array)  

## Next Steps

1. **Amos:** Implement GameRoom claim tracking and message handlers (A3)
2. **Naomi:** Build territory control UI (claim button, progress bar, status display) (N2)
3. **Drummer:** Add integration tests for multi-client territory contention
4. **Miller:** Add diplomacy system constraints (allies can't contest each other's nodes) - Phase 8b

## Open Questions

1. **Q:** Should disconnected player's claims persist?  
   **A:** Deferred to Amos - GameRoom decides claim lifecycle on disconnect

2. **Q:** Can player claim multiple nodes simultaneously?  
   **A:** Yes - activeClaims is a map, supports parallel claims (balance via rate limiting)

3. **Q:** Should some nodes be unclaimed/unclaimable (neutral zones)?  
   **A:** Future feature - add `isClaimable: boolean` flag to Node type

---

**Files Changed:**
- `src/game/systems/territory.ts` (new)
- `src/game/types.ts` (extended Node, added events)
- `src/game/loop.ts` (added activeClaims parameter)
- `src/game/index.ts` (exported territory system)
- `src/game/__tests__/territory.test.ts` (fixed signatures)

**Lines of Code:** ~300 (territory system) + ~20 (integration)

**Estimated Server Integration:** 2-3 hours (Amos)  
**Estimated Frontend Integration:** 4-6 hours (Naomi)
# Phase 8a: Territory Control Backend Implementation

**Date:** 2025-07-16  
**Author:** Amos  
**Status:** Implemented

## What Was Built

Implemented backend infrastructure for Phase 8a territory control and player presence features as specified in `holden-phase8-architecture.md`.

### A1 — Schema Updates

**PlayerSchema additions:**
```typescript
@type('string') name: string = '';
@type('string') color: string = '#FFFFFF';
@type('string') focusedNodeId: string = '';
@type('number') lastActivityTick: number = 0;
```

**NodeSchema additions:**
```typescript
@type('number') controlPoints: number = 0;
@type('number') maxControlPoints: number = 100;
```

**Converters update:**
- Modified `nodeToSchema()` to handle `controlPoints` and `maxControlPoints` with fallback defaults

### A2 — Player Presence Handlers

**Message handlers implemented:**
1. `update_focus` — Updates `player.focusedNodeId` when player views a node
2. `player_activity` — Updates `player.lastActivityTick` to current tick (generic activity ping)

**Player initialization:**
- Name: Uses `options.name` from join options, or generates "Player N"
- Color: Assigns from predefined palette ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']
- Color tracking: `usedColorIndices` Set manages color allocation/deallocation
- Fallback: Generates random hex color if all 8 palette colors in use

### A3 — Territory Control Handlers

**Data structures:**
```typescript
interface ClaimAction {
  playerId: string;
  nodeId: string;
  tick: number;
}

private activeClaims: Map<string, ClaimAction>
```

**Message handlers:**
1. `claim_node` — Validates player/node exist, checks not already owned by claimant, adds to `activeClaims`
2. `abandon_node` — Removes claim from `activeClaims` if nodeId matches

**Tick processing (`processClaims()`):**
- Called in `onTick()` before state sync
- For each active claim:
  - Detects contested state (multiple claims on same node)
  - Updates `node.status`: 'contested', 'neutral', or 'claimed'
  - **Neutral/own node:** +10 control points per tick
  - **Enemy node:** -5 control points per tick (contesting)
  - **Threshold reached:** Transfers ownership at 100 (neutral claim) or 0 (contested capture)
- Logs ownership changes to console

**Cleanup:**
- Player disconnect clears their active claims
- Invalid claims (missing player/node) auto-removed

## Design Decisions

### 1. Control Points Increment/Decrement Rates

**Decision:** +10/tick for claiming, -5/tick for contesting  
**Rationale:**  
- Neutral claim takes 10 ticks (~10 seconds at normal speed) — gives other players reaction time
- Contesting is slower (20 ticks to flip from 100 to 0) — defender advantage
- Asymmetric rates create strategic depth

**Alternatives considered:**
- Equal rates (too fast for contested flips)
- Resource costs (deferred to post-MVP)

### 2. Color Assignment Strategy

**Decision:** Predefined palette + random fallback  
**Rationale:**
- 8 distinct colors cover max room size (maxPlayers=8)
- Predefined colors are visually distinct (accessibility)
- Random fallback handles edge case without hard limit
- Color reuse after player leaves prevents color exhaustion

**Alternatives considered:**
- Hash-based color from player ID (poor visual distinction)
- Fixed assignment by join order (doesn't handle reconnects well)

### 3. Activity Tracking Granularity

**Decision:** Store `lastActivityTick` (tick number) not timestamp  
**Rationale:**
- Tick-based aligns with game simulation clock
- Simpler comparison: `currentTick - lastActivityTick > 30` for idle detection
- No timezone/clock sync issues

**Alternatives considered:**
- Wall-clock timestamp (misaligns with paused game)
- Separate idle flag (requires extra state management)

### 4. Server-Authoritative Claims

**Decision:** All claim processing happens in `processClaims()` during tick  
**Rationale:**
- Deterministic: same inputs always produce same state
- Cheat-proof: clients can't fake claim progress
- Consistent with event-driven simulation architecture

**Client implications:**
- Optimistic UI updates possible (Naomi can predict progress bars)
- Must handle rollback if server rejects claim

### 5. Single Active Claim Per Player

**Decision:** `activeClaims` map uses sessionId as key (one claim per player)  
**Rationale:**
- Simplifies initial implementation
- Prevents spam-claiming entire map
- Can be relaxed later with rate limiting

**Future extension:** Multi-claim support with cost per additional claim

## Integration Points

### For Naomi (Frontend):

**New message types to send:**
```typescript
room.send('update_focus', { nodeId: 'sol-system' });
room.send('player_activity', {});
room.send('claim_node', { nodeId: 'alpha-centauri' });
room.send('abandon_node', { nodeId: 'alpha-centauri' });
```

**New state fields to observe:**
```typescript
room.state.players.forEach(player => {
  console.log(player.name, player.color, player.focusedNodeId, player.lastActivityTick);
});

room.state.nodes.forEach(node => {
  console.log(node.controlPoints, node.maxControlPoints, node.status, node.ownerId);
});
```

**UI implications:**
- Show player list with names/colors
- Display player focus indicators on map
- Node borders should use player.color
- Claim progress bar: `controlPoints / maxControlPoints * 100`
- Status badges: 'Neutral', 'Claimed by X', 'Contested'

### For Miller (Game Simulation):

**Current implementation:**
- Territory logic lives in GameRoom, not game engine
- This is intentional — territory is multiplayer-specific, not core simulation

**Future integration:**
- When extraction to Rust/Go happens, `processClaims()` logic should move to `src/game/systems/territory.ts`
- Pure function: `processTerritoryClaims(world, activeClaims) → { world, events }`
- GameRoom would just collect claims and call the system

**For now:** Keep in GameRoom for rapid iteration. Extract when stable.

## Testing Recommendations

**Unit tests needed (Drummer):**
1. Color assignment — verify no duplicates, handles 9+ players
2. Claim validation — rejects invalid nodeId, self-claiming
3. Control points — verify +10/-5 rates, ownership transfer at thresholds
4. Contested state — multiple claims on same node

**Integration tests needed:**
1. Two clients claim same node — verify contested state syncs to both
2. Client disconnects mid-claim — verify claim removed
3. Claim completes — verify ownership change broadcasts

**E2E test scenario:**
1. Player A joins, sees 4 neutral nodes
2. Player A claims Sol System
3. Wait 10 ticks, verify Sol System ownerId === Player A
4. Player B joins, claims Sol System
5. Verify status === 'contested', controlPoints decrementing
6. Wait 20 ticks, verify ownership flips to Player B

## Known Limitations

1. **No pathfinding validation:** Players can claim any node, even unreachable ones
   - **Fix:** Add reachability check in `claimNode()` using connectivity system
   - **Priority:** Medium (post-MVP)

2. **No rate limiting:** Players can spam claim/abandon messages
   - **Fix:** Add timestamp tracking, enforce 1 action/second
   - **Priority:** High (before public test)

3. **Single claim per player:** Can't claim multiple nodes simultaneously
   - **Fix:** Change `activeClaims` to `Map<sessionId, Set<ClaimAction>>`
   - **Priority:** Low (strategic decision, not bug)

4. **No resource costs:** Claiming is free
   - **Fix:** Add energy cost to initiate claim (future extension)
   - **Priority:** Low (post-MVP feature)

## Performance Notes

**Claim processing complexity:** O(C) where C = number of active claims  
- Worst case: 8 players × 1 claim each = 8 iterations per tick
- Negligible overhead compared to game simulation

**Memory overhead:**
- `activeClaims` map: ~100 bytes per claim
- Schema additions: +32 bytes per player, +16 bytes per node
- Total: <1KB for typical game session

## Next Steps

1. **Naomi:** Implement territory UI (N2) — claim button, progress bars, status badges
2. **Naomi:** Implement player presence UI (N1) — online players list, focus indicators
3. **Drummer:** Write integration tests for claim flow
4. **Miller:** Review `processClaims()` logic for future extraction to game systems

## References

- Architecture spec: `.ai-team/decisions/inbox/holden-phase8-architecture.md`
- Schema: `server/src/colyseus/schema.ts`
- GameRoom: `server/src/colyseus/GameRoom.ts`
- Converters: `server/src/colyseus/converters.ts`
