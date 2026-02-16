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
