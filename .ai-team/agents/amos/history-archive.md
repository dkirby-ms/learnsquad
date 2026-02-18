# History Archive — Amos

Entries from before 2026-02-16 (moved to archive to keep main history.md concise).

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

