# Project Context

- **Owner:** dkirby-ms (saitcho@outlook.com)
- **Project:** MMOG grand strategy browser game with pausable real-time mechanics (Paradox-style)
- **Stack:** React, TypeScript, PixiJS, Colyseus, Node.js, Express, PostgreSQL, Redis
- **Created:** 2025-07-12

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

📌 Graphics: 2D with PixiJS for simpler visual style
📌 UI stack: React for UI chrome, PixiJS for game canvas
📌 State sync: Colyseus provides real-time state synchronization from server
📌 Build tooling: Vite for dev server and bundling with React plugin
📌 Component structure: src/components/{ComponentName}/{ComponentName}.tsx with CSS modules
📌 Login endpoint: POST /api/auth/login (Amos building backend)
📌 Styling approach: CSS modules for component isolation, dark theme (#0a0e17 bg, #141a26 cards)
📌 Auth pattern: AuthContext (src/contexts/AuthContext.tsx) manages OAuth flow via /api/auth/me endpoint
📌 OAuth flow: "Sign in with Microsoft" redirects to /api/auth/login, backend handles OAuth, returns to app
📌 Dev auth fallback: Email/password form available via "Use email instead" toggle, POSTs to /api/auth/login/dev
📌 Auth provider: Microsoft Entra External Identities (CIAM), not regular Entra ID
📌 OAuth endpoints: /api/auth/oauth/login, /api/auth/oauth/me, /api/auth/oauth/logout
📌 CIAM signup: No separate registration page — CIAM handles sign-up within the OAuth flow
📌 Social providers: OAuthProvider type supports 'microsoft' | 'google' | 'facebook' for future expansion
📌 WebSocket hook: src/hooks/useGameSocket.ts manages connection lifecycle, reconnection with exponential backoff
📌 Game state store: src/store/gameState.ts — simple pub/sub store using useSyncExternalStore for React integration
📌 Server message types: WorldSnapshot, WorldDelta, Events, TickProcessed, SpeedChanged, Error, Connected
📌 Client message types: JoinGame, Pause, Resume, SetSpeed, Ping
📌 WebSocket endpoint: /ws (proxied via Vite to localhost:3000) — gameId passed via join_room message, not URL
📌 Hash-based routing: Using window.location.hash for MVP routing (#/, #/game)
📌 Game components: GameWorld, GameControls, NodeView, ResourceBar, EventLog in src/components/
📌 Game page: src/pages/GamePage.tsx with lazy-loaded GameWorld for code splitting
📌 State hooks: useGameWorld, useEventHistory, useCurrentTick, useIsPaused, useGameSpeed, useGameStatus
📌 WS protocol: Client sends join_room/pause_game/resume_game/set_speed/ping; server sends room_joined/tick_complete/pause_state_changed/speed_changed/pong
📌 WS message format: Flat JSON with type discriminator, not nested payload objects (aligned with server/src/ws/types.ts)
📌 Colyseus client: Using colyseus.js for WebSocket connection — Client connects via `new Client(url)`, joins room via `client.joinOrCreate("game", options)`
📌 Colyseus room name: "game" — standard room name coordinated with Amos
📌 Colyseus messages: Client sends 'pause', 'resume', 'set_speed' via `room.send(type, payload)`; no custom serialization needed
📌 Colyseus state sync: `room.onStateChange` receives full state snapshots, converted to GameWorld in useGameSocket hook
📌 Colyseus events: Server broadcasts 'events' message for game events (not part of schema); handled via `room.onMessage('events', callback)`
📌 Colyseus reconnection: Uses `room.reconnectionToken` for seamless reconnect; falls back to fresh join if token invalid
📌 Colyseus lifecycle: `room.onLeave(code)` handles disconnect; code 1000 = clean, <1000 = abnormal (triggers reconnect)

## Team Updates

📌 Team update (2026-02-16): Colyseus frontend migration complete — aligned with backend message protocol — decided by Ralph
📌 Team update (2026-02-16): CIAM OAuth frontend architecture established — supports multi-provider extension — decided by Ralph

### 2025-07-16: Player Presence & Territory Control UI (Phase 8a)

**By:** Naomi

**What:** Implemented player presence and territory control features for multiplayer gameplay:

1. **Player Presence UI (N1)**:
   - Created `PlayerList` component (`src/components/PlayerList/`) showing online players with:
     - Name, color indicator, idle status (fades after 30 ticks of inactivity)
     - Currently focused node display
     - Connected/disconnected states
   - Extended `gameState` store with player data management:
     - Added `Player` interface with focus tracking and activity timestamps
     - Added `updatePlayers()` and `getPlayers()` methods
     - New hooks: `usePlayers()`, `usePlayer(id)`
   - Added focus tracking to `useGameSocket`:
     - `updateFocus(nodeId)` sends `update_focus` message on node click/hover
     - Focus updates synced via Colyseus schema

2. **Territory Control UI (N2)**:
   - Enhanced `NodeView` component with ownership visuals:
     - Colored left border matching owner's player color
     - Owner name display with color highlighting
     - Claim/Abandon buttons (shown when `showControls={true}`)
     - Claim progress bar for contested nodes (UI ready, server integration pending)
     - Status badges: "Neutral", "Claimed", "Contested"
   - Added territory message senders to `useGameSocket`:
     - `claimNode(nodeId)` sends `claim_node` message
     - `abandonNode(nodeId)` sends `abandon_node` message
   - Integrated into `GameWorld`:
     - PlayerList shown in left sidebar when connected
     - Node ownership resolved from player data
     - Controls passed to selected node detail view

**Why:** Phase 8a establishes the UI foundation for multiplayer interactions. Player presence creates awareness of who's online and where they're looking. Territory control UI gives players visual feedback on ownership and the tools to claim/abandon nodes. The implementation follows existing patterns (CSS modules, hooks, component structure) and is ready for backend integration when Miller and Amos implement the territory claiming system.

**Technical decisions:**
- Player color displayed via inline styles (dynamic per-player)
- Focus updates sent on both click and hover (hover removed from final impl to reduce message spam)
- Idle threshold set at 30 ticks (configurable constant)
- Progress bar implemented but hardcoded to 0% until backend provides `controlPoints` data
- Current player ID temporarily uses first player in list (needs auth integration)

**Files created:**
- `src/components/PlayerList/PlayerList.tsx` (player list UI)
- `src/components/PlayerList/PlayerList.module.css` (player list styles)
- `src/components/PlayerList/index.ts` (exports)

**Files modified:**
- `src/store/gameState.ts` — Added Player type, player management methods
- `src/hooks/useGameState.ts` — Added usePlayers, usePlayer hooks
- `src/hooks/useGameSocket.ts` — Added updateFocus, claimNode, abandonNode message senders, player sync
- `src/hooks/index.ts` — Exported new hooks and Player type
- `src/components/NodeView/NodeView.tsx` — Added ownership visuals, claim/abandon controls
- `src/components/NodeView/NodeView.module.css` — Added territory control styles
- `src/components/GameWorld/GameWorld.tsx` — Integrated PlayerList, added node owner resolution, focus tracking
- `src/components/GameWorld/GameWorld.module.css` — Added playerListContainer styles

**Awaiting from team:**
- Amos: Backend handlers for `update_focus`, `claim_node`, `abandon_node` messages
- Amos: PlayerSchema fields in Colyseus state (name, color, focusedNodeId, lastActivityTick)
- Amos: NodeSchema fields (controlPoints, maxControlPoints) for progress bar
- Miller: Territory claiming system integration with GameLoop

