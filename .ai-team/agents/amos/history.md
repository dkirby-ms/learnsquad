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
