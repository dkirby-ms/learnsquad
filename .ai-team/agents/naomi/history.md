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
📌 WebSocket endpoint: /ws/game with gameId query param (proxied via Vite to localhost:3000)
📌 Hash-based routing: Using window.location.hash for MVP routing (#/, #/game)
📌 Game components: GameWorld, GameControls, NodeView, ResourceBar, EventLog in src/components/
📌 Game page: src/pages/GamePage.tsx with lazy-loaded GameWorld for code splitting
📌 State hooks: useGameWorld, useEventHistory, useCurrentTick, useIsPaused, useGameSpeed, useGameStatus
