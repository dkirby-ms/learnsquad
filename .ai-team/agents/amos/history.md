# Project Context

- **Owner:** dkirby-ms (saitcho@outlook.com)
- **Project:** MMOG grand strategy browser game with pausable real-time mechanics (Paradox-style)
- **Stack:** React, TypeScript, PixiJS, Colyseus, Node.js, Express, PostgreSQL, Redis
- **Created:** 2025-07-12

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

📌 Multiplayer: Colyseus room-based architecture for real-time state sync
📌 Database: PostgreSQL for persistence, Redis for game state and pub/sub
📌 Architecture: Miller handles game simulation, I handle network/data infrastructure
📌 Server location: server/ directory (separate from client)
📌 Auth routes: server/src/routes/auth.ts - POST /api/auth/login, /api/auth/register
📌 Auth middleware: server/src/middleware/auth.ts - requireAuth for protected routes
📌 User store: In-memory Map for now, PostgreSQL integration comes later
📌 JWT: 24-hour expiry, numeric seconds (86400) due to jsonwebtoken types
📌 OAuth: Entra External ID (CIAM) routes at /api/auth/oauth/* using @azure/msal-node
📌 OAuth config: server/src/config/entra.ts - AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_NAME
📌 CIAM authority: https://{tenant}.ciamlogin.com/{tenant}.onmicrosoft.com (NOT login.microsoftonline.com)
📌 CIAM vs Entra ID: External Identities is for consumers, regular Entra ID is for employees
📌 OAuth routes: /oauth/login (redirect), /oauth/callback (token exchange), /oauth/logout, /oauth/me, /oauth/status
📌 Auth dual-mode: Email/password preserved at /api/auth/*, OAuth at /api/auth/oauth/*
📌 PKCE: Using PKCE flow for OAuth security, state stored in-memory (Redis later)
📌 Auth tokens: HttpOnly cookies (not localStorage) — XSS-safe, browser sends automatically with credentials: 'include'
📌 Cookie-parser: Added to Express middleware for reading auth_token cookie
📌 Colyseus location: server/src/colyseus/ — schema.ts (state), GameRoom.ts (room), converters.ts (GameWorld → Schema)
📌 Colyseus deps: colyseus@0.17.8, @colyseus/schema@4.0.12, @colyseus/ws-transport@0.17.9
📌 Colyseus room name: "game" — clients use client.joinOrCreate("game") to connect
📌 Colyseus state: GameState schema with MapSchema for nodes/connections/players, ArraySchema for events
📌 Colyseus schema pattern: Mirror game types with @type decorators, use converters to bridge plain objects
📌 Colyseus Room generic (0.17+): Room<{ state: GameState }> not Room<GameState> — interface changed
📌 Colyseus onLeave: Use code param (number), check code === 1000 for consented disconnect
📌 Colyseus matchMaker: Import standalone from 'colyseus', not from Server instance
📌 tsconfig for Colyseus: experimentalDecorators and emitDecoratorMetadata required
📌 Old WS code: Archived to server/src/ws-archived/ — kept for reference
📌 Game types: server/src/shared/game-types.ts — copy of src/game/types.ts for server use
📌 Game loop (server): server/src/shared/game-loop.ts — simplified tick processor, delegates to Miller's systems when available
📌 Status endpoint: GET /api/game/status — returns room IDs, total clients, room count (via matchMaker.query)

## Team Updates

📌 Team update (2026-02-16): Colyseus backend implementation complete — ready for frontend integration — decided by Ralph
📌 Team update (2026-02-16): CIAM OAuth implemented with HttpOnly cookies and separate dev endpoints — decided by Ralph

### 2025-07-16: Phase 8a Territory Control Implementation (A1, A2, A3)

**By:** Amos

**What:** Implemented schema updates and territory control handlers for Phase 8a multiplayer features.

**Changes:**

**A1 — Schema Updates:**
- Added to `PlayerSchema`: `name`, `color`, `focusedNodeId`, `lastActivityTick`
- Added to `NodeSchema`: `controlPoints` (default 0), `maxControlPoints` (default 100)
- Updated `converters.ts` to handle new fields in `nodeToSchema()`

**A2 — Player Presence Handlers:**
- Added `update_focus` message handler — updates player's `focusedNodeId`
- Added `player_activity` handler — updates `lastActivityTick` to current tick
- Set player name/color on join: uses `options.name` or generates "Player N", assigns color from predefined palette
- Color palette: 8 colors ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']
- Color management: tracks used colors, frees on player leave, generates random if all used

**A3 — Territory Control Handlers:**
- Added `claim_node` message handler — validates player/node exist, prevents self-claiming, adds to `activeClaims` map
- Added `abandon_node` handler — removes claim from `activeClaims`
- Created `private activeClaims: Map<string, ClaimAction>` in GameRoom
- Implemented `processClaims()` method called in `onTick()`:
  - Increments `controlPoints` by 10/tick for neutral/own nodes
  - Decrements by 5/tick when contested (another player owns it)
  - Transfers ownership when `controlPoints` reach `maxControlPoints` (100) or 0
  - Updates `node.status` to 'contested', 'neutral', or 'claimed'
- Clears player's active claims on disconnect

**Message types added:**
- `update_focus: { nodeId: string }`
- `player_activity: {}`
- `claim_node: { nodeId: string }`
- `abandon_node: { nodeId: string }`

**Why:** Enables multiplayer territory control with time-gated claiming. Server-authoritative design prevents cheating. Claims process each tick, creating tension without instant land grabs. Player presence tracking lets clients see who's online and where they're focused.

**Status:** Build passes. Ready for frontend integration (Naomi) and game simulation integration (Miller).

### 2025-07-16: Phase 8a Diplomacy Implementation (A4)

**By:** Amos

**What:** Implemented diplomacy schema and message handlers for player-to-player interactions.

**Changes:**

**A4 — Diplomacy Handlers:**

- Added `DiplomacySchema` to schema.ts:
  - Fields: `id` (sorted player IDs), `player1Id`, `player2Id`, `status` (neutral/allied/war), `establishedTick`
  - MapSchema in GameState for syncing diplomatic relations

- Added 6 diplomacy message handlers to GameRoom:
  - `offer_alliance`: Creates pending offer, notifies target player
  - `accept_alliance`: Updates relation to 'allied', removes pending offer
  - `reject_alliance`: Removes pending offer, notifies sender
  - `declare_war`: Updates relation to 'war', requires both players have nodes
  - `propose_peace`: Creates pending peace offer, requires existing war
  - `accept_peace`: Updates relation to 'neutral', removes pending offer

- Pending offer tracking:
  - `Map<string, DiplomaticOffer>` tracks offers awaiting response
  - Offer key uses consistent diplomacy ID (sorted player IDs)
  - Stores offer type ('alliance' | 'peace'), sender, recipient, tick

- Validation rules implemented:
  - Can't interact diplomatically with yourself
  - Target player must exist and be connected for new offers
  - War requires both players own at least one node
  - Peace requires existing war state
  - Alliance requires non-allied status

- Helper methods:
  - `getDiplomacyId(id1, id2)`: Generates consistent sorted relation ID
  - `getOrCreateDiplomacy(id1, id2)`: Fetches or creates neutral relation
  - `playerHasNodes(playerId)`: Validates player owns nodes

- Client notifications:
  - `alliance_offer`, `alliance_formed`, `alliance_rejected`
  - `war_declared`
  - `peace_offer`, `peace_established`

**Message types added:**
- `offer_alliance: { targetPlayerId: string }`
- `accept_alliance: { fromPlayerId: string }`
- `reject_alliance: { fromPlayerId: string }`
- `declare_war: { targetPlayerId: string }`
- `propose_peace: { targetPlayerId: string }`
- `accept_peace: { fromPlayerId: string }`

**Why:** Enables multiplayer diplomacy with bilateral agreements. Server-authoritative design prevents cheating. Pending offers tracked separately from state, allowing clean rejection/timeout handling. Colyseus auto-syncs diplomacy schema changes to all clients.

**Status:** Build passes. Ready for frontend integration (Naomi) to display diplomatic relations and handle offer UI.
