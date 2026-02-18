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


## Core Context

**Amos owns the backend/networking infrastructure:**
- Colyseus server architecture (server/src/colyseus/)
- State synchronization patterns (MapSchema, delta encoding)
- Auth infrastructure (OAuth CIAM, JWT, HttpOnly cookies)
- Game types and type bridges (server/src/shared/)
- Chat backend messaging (rate limiting, sanitization)
- Networking optimizations (bandwidth, culling strategies)

**Key Patterns:**
- Colyseus Room<{ state: GameState }> generic pattern (0.17+)
- Use converters to bridge GameWorld (client types) ↔ GameState (Colyseus schema)
- Only assign to Colyseus state if value differs (delta encoding perf)
- Player identity: Use sessionId for routing, map to player.id for auth
- Rate limiting: Rolling window algorithm (5 msgs/10s model)
- XSS protection: Sanitize all user input (xss npm package)
- Chat ephemeral: No persistence, broadcast to room, clear on disconnect

## Team Updates

📌 Team update (2026-02-16): Colyseus backend implementation complete — ready for frontend integration — decided by Ralph
📌 Team update (2026-02-16): CIAM OAuth implemented with HttpOnly cookies and separate dev endpoints — decided by Ralph

📌 Team update (2026-02-17): All changes must go through feature branches and PRs. Alex reviews all PRs before merge. No direct commits to master.

### Chat Feature Backend Design (2025-07-16)

📌 Chat architecture: Ephemeral message broadcasting, no state storage, no persistence (MVP decision)
📌 Chat message types: `send_chat` (client->server), `chat_message` (server->all clients), `chat_error` (validation feedback)
📌 Chat validation: 500 char max, 5 messages per 10 seconds rate limit, trim whitespace, reject empty
📌 Chat security: Server-authoritative, player identity from session, rate limiting prevents spam
📌 Chat pattern: room.send('send_chat', {text}), room.onMessage('chat_message', callback), broadcast to all clients
📌 Chat rate limiting: Map<sessionId, timestamps[]>, rolling 10-second window, cleanup on disconnect
📌 Chat message ID: `${timestamp}-${sessionId.slice(0,8)}` for client dedup
📌 Chat broadcast includes: playerId, playerName, playerColor (from PlayerSchema), text, timestamp, messageId
📌 Chat handler location: GameRoom.registerMessageHandlers(), private handleChatMessage() method
📌 Chat no persistence: New joiners see empty history (acceptable MVP), future: PostgreSQL chat_messages table
📌 Chat no profanity filter: Out of scope for MVP, can add later if needed
📌 Chat pattern matches: Follows existing diplomacy/territory control handler patterns for consistency

📌 Team update (2025-01-22): Chat feature design consolidated across all layers (backend, frontend, systems integration, UI) — decided by Amos, Holden, Miller, Naomi

### 2025-07-16: Chat Message Handler Implementation

**By:** Amos

**What:** Implemented real-time chat message handling in GameRoom with rate limiting and XSS protection.

**Changes:**

**Message Handler:**
- Added `send_chat` message handler to accept client messages with `{ content: string }`
- Handler validates, sanitizes, rate-limits, and broadcasts messages
- Returns error feedback to client on validation failures via `chat_error` message

**Rate Limiting:**
- Implemented rolling window rate limiter: 5 messages per 10 seconds per player
- Uses `Map<sessionId, ChatRateLimit>` tracking message timestamps
- Rejects excess messages with clear error feedback to client
- Automatically cleans up rate limit data on player disconnect

**Validation:**
- Checks message content is non-empty (after trim)
- Enforces 500 character maximum length
- Returns specific error messages for each validation failure

**XSS Sanitization:**
- Uses `xss` npm package (v1.0.15) for content sanitization
- Strips HTML tags, JavaScript protocols, and event handlers
- Applied before broadcasting to prevent script injection attacks

**Message Broadcasting:**
- Broadcasts `chat_message` to all clients with structure:
  - `id`: Unique message ID (crypto.randomUUID())
  - `playerId`: Player's persistent ID
  - `playerName`: Display name
  - `content`: Sanitized message text
  - `timestamp`: Unix timestamp (milliseconds)

**Error Handling:**
- `chat_error` messages sent to sender on:
  - Empty message
  - Message too long
  - Rate limit exceeded
  - Invalid format

**Why:** 
- Rate limiting prevents spam and DoS attacks at the server level
- XSS sanitization protects all clients from malicious script injection
- Rolling window rate limiter is memory-efficient and fair (no cooldown lockout)
- Server-authoritative design ensures player identity can't be spoofed
- `randomUUID()` from crypto module provides secure unique IDs without dependencies

**Status:** Build passes. Ready for frontend integration by Naomi.

**Learnings:**
- XSS package provides robust sanitization with sensible defaults
- Rolling window rate limiting (filtering old timestamps) is simpler than bucket algorithms
- crypto.randomUUID() is native Node.js (v14.17+), no external UUID lib needed
- Message IDs enable client-side deduplication and message tracking
- Cleanup of rate limit Map on disconnect prevents memory leaks in long-running rooms

### 2025-07-16: PixiJS Canvas Colyseus State Sync Architecture

📌 **State sync design:** Colyseus MapSchema provides automatic delta encoding — only changed fields sent over wire
📌 **Bandwidth math:** 500 nodes, 8 players, 1 tick/sec = ~2KB/sec per client (negligible with binary protocol)
📌 **Room architecture:** Single room per game session (not spatial partitioning) — scales to 100+ players, 500+ nodes
📌 **Client authority:** Players trigger actions (claim_node, update_focus), server validates and updates state
📌 **Optimistic updates:** Visual feedback only (highlight, indicators), never mutate Colyseus state client-side
📌 **Schema already sufficient:** NodeSchema (position, ownership, controlPoints, resources) covers PixiJS needs
📌 **PixiJS integration:** Use Colyseus callbacks (onAdd/onChange/onRemove) to update sprites, don't poll state
📌 **Tick rate 1 sec:** Correct for strategy games — PixiJS interpolates smooth visuals between discrete ticks
📌 **Performance order:** PixiJS rendering bottlenecks first, then React re-renders, Colyseus sync scales well
📌 **Minimize changes:** Only assign if value differs — Colyseus detects assignment as change even if same value
📌 **Static data pattern:** Set once (node.position, connections, player.color), never change = zero sync cost
📌 **Rate limiting extends:** Chat (5/10s) is model — can add to focus updates if spam becomes issue
📌 **Scaling strategy:** Horizontal (Redis Presence, multiple Node processes) ready when needed, vertical first
📌 **Fog of war future:** Add PlayerSchema.visibleNodeIds if needed, current schema doesn't block it
📌 **Interest management:** Advanced optimization — only sync nodes near player focus (defer until proven needed)


📌 Team update (2026-02-17): PixiJS Colyseus State Sync design consolidated into canonical decisions.md. Current schema and single-room architecture approved for MVP. Chat backend design finalized. — decided by Holden, Naomi, Amos, Miller
