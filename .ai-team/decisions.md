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
