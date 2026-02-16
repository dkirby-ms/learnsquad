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
