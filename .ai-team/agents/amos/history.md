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
📌 WebSocket: Using `ws` library (not socket.io) — lighter, faster, no fallback overhead
📌 WS location: server/src/ws/ — server.ts (main), types.ts (messages), rooms.ts (room management), serialization.ts (state encoding)
📌 WS path: /ws endpoint attached to main HTTP server (not standalone)
📌 WS message format: JSON with type-discriminated unions — debugging > raw perf for now
📌 WS message types: ClientMessage (join_room, pause_game, etc.), ServerMessage (game_state_update, tick_complete, etc.)
📌 Tick broadcast: Delta encoding — only send changed nodes per tick, not full state
📌 Room architecture: Each room has own GameLoop, broadcasts tick results to connected clients
📌 Game types: server/src/shared/game-types.ts — copy of src/game/types.ts for server use
📌 Game loop (server): server/src/shared/game-loop.ts — simplified tick processor, delegates to Miller's systems when available
📌 Status endpoint: GET /api/game/status — returns client count, room list, total clients
