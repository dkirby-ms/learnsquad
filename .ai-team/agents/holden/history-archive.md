# History Archive — holden

## Archived Entries (older than 2 weeks)

<!-- Append new learnings below. Each entry is something lasting about the project. -->

📌 Initial architecture: Game simulation layer designed as separable module for potential Rust/Go extraction
📌 Graphics: 2D with PixiJS for simpler visual style
📌 Real-time: Colyseus room-based multiplayer with pausable game time

### 2025-07-16: Phase 8 Multi-Player Features Architecture

**By:** Holden

**Key architectural decisions:**

1. **Player Presence System**
   - Track focused node + last activity tick via PlayerSchema
   - Lightweight presence indication (which node they're viewing, not full viewport)
   - Idle detection: fade players inactive >30 seconds
   - Privacy-preserving: location visible, actions are not

2. **Territory Control**
   - Time-gated claiming via `controlPoints` increment per tick (10 points/tick, 100 max)
   - Contested state: multiple players claiming = decrement opposing player's points (5/tick)
   - Server-authoritative: clients request claims, server processes during tick
   - Abandoned nodes return to neutral, disconnected player nodes become more vulnerable (2x contest rate)

3. **Diplomacy System**
   - Simple 3-state model: Neutral, Allied, War
   - Asymmetric mechanics: alliances require acceptance, wars are unilateral
   - Pending offers tracked server-side, applied during tick for determinism
   - 2-player relationships only (no coalitions in MVP)

4. **System Interactions**
   - Allied players cannot contest each other's nodes (validation in territory system)
   - Allied players see extended info (resource counts) on partner nodes
   - War state enables fast contesting of enemy territory

**Patterns established:**

- **Incremental ownership changes**: Prefer time-gated state transitions over instant effects
- **Server-authoritative multiplayer**: All ownership/diplomacy changes via tick processing
- **Colyseus schema leveraging**: Add fields to existing schemas rather than parallel state
- **Validation layering**: Server validates actions, client disables invalid UI options

**Work distribution:**
- Miller: Territory + diplomacy game systems (pure functions in `src/game/systems/`)
- Amos: Schema updates, message handlers, GameRoom integration
- Naomi: UI for presence, ownership visualization, diplomacy panel

**Rationale for key choices:**

| Choice | Why |
|--------|-----|
| controlPoints over instant claims | Creates tension, allows reaction time |
| Unilateral war declarations | Simpler than mutual war, more realistic |
| Focus tracking via nodeId | Lower bandwidth than viewport coords |
| 2-player diplomacy only | Avoids coalition complexity in MVP |

This architecture enables meaningful multiplayer interaction (presence, ownership, cooperation) without overbuilding. Extensions like resource costs for claims, multi-party alliances, and espionage deferred to post-MVP.
📌 Team update (2026-02-17): All changes must go through feature branches and PRs. Alex reviews all PRs before merge. No direct commits to master.

### 2025-02-17: Chat Feature Architecture

**Key architectural decisions:**

1. **Message Transport Pattern**
   - Chat messages NOT in Colyseus GameState schema (ephemeral broadcast-only)
   - Server receives `chat_message` from client → validates → broadcasts to all
   - Client-side storage (100 message history) in gameStateStore, cleared on disconnect
   - No persistence/database (MVP scope: real-time only)

2. **UI Integration**
   - Right sidebar becomes tabbed interface: "Events" | "Chat"
   - ChatPanel component mirrors EventLog structure
   - Tab state managed in GameWorld component
   - Unread count badge when chat tab inactive

3. **Security & Rate Limiting**
   - Server-side rate limit: 5 messages per 10 seconds per player (sliding window)
   - Input sanitization: strip HTML, trim, max 500 chars, reject empty
   - Authorization: validate sessionId → player mapping server-side
   - Display safety: use textContent, CSS word-break/white-space controls

4. **Data Flow**
   - Client: `sendChatMessage(text)` → `room.send('chat_message', {text})`
   - Server: validate → sanitize → `broadcast('chat', {id, playerId, playerName, text, tick, timestamp})`
   - Client: `room.onMessage('chat')` → `gameStateStore.addChatMessage()` → React re-render

**Integration points:**
- `server/src/colyseus/GameRoom.ts` - Add chat_message handler, rate limiting
- `src/store/gameStateStore.ts` - Add chatMessages array, getChatMessages(), addChatMessage()
- `src/hooks/useGameSocket.ts` - Add sendChatMessage callback, onMessage('chat') listener
- `src/components/ChatPanel/` - New component (mirror EventLog structure)
- `src/components/GameWorld/GameWorld.tsx` - Add tab navigation to right sidebar

**Rationale for key choices:**

| Choice | Why |
|--------|-----|
| Broadcast-only (no schema) | Chat is ephemeral, not game state; reduces sync overhead |
| Client-side storage (100 msg limit) | Provides scroll-back without server persistence |
| No private messages | Simplest implementation; matches "team communication" |
| Server-side rate limiting | Prevents spam; can't be bypassed client-side |
| No persistence | MVP scope; faster implementation; add later if needed |

**Risk mitigation:**
- XSS: Strict sanitization + textContent rendering
- Spam: Rate limiting + client feedback
- Performance: Virtual scrolling, 100 msg cap, ~1KB/s peak bandwidth

This architecture enables real-time player communication without complicating game state synchronization or requiring database persistence.

📌 Team update (2025-01-22): Chat feature design consolidated across all layers (backend, frontend, systems integration, UI) — decided by Amos, Holden, Miller, Naomi

---

*Archived: 2026-02-17*
*Original entries moved here to keep active history.md lean (<3KB)*
