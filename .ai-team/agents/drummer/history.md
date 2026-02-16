# Project Context

- **Owner:** dkirby-ms (saitcho@outlook.com)
- **Project:** MMOG grand strategy browser game with pausable real-time mechanics (Paradox-style)
- **Stack:** React, TypeScript, PixiJS, Colyseus, Node.js, Express, PostgreSQL, Redis
- **Created:** 2025-07-12

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

📌 Testing priorities: Simulation determinism, multiplayer state sync, pausable real-time edge cases
📌 Stack: Jest for unit/integration, likely Playwright for E2E, k6 or Artillery for load
📌 Auth test contracts established: `src/__tests__/auth.test.ts` (backend), `src/components/Login/Login.test.tsx` (frontend)
📌 Test structure: Jest with ts-jest, separate projects for backend (node env) and frontend (jsdom env)
📌 Security tests included: SQL injection payloads, rate limiting, user enumeration prevention
📌 Frontend tests use @testing-library/react with user-event for realistic interaction simulation
📌 Edge cases covered: Unicode in credentials, very long inputs, whitespace handling
📌 OAuth test contracts established: `src/__tests__/oauth.test.ts` for Entra ID backend, OAuth UI tests added to `Login.test.tsx`
📌 OAuth tests cover: authorization URL generation, token exchange, session management, token validation, CSRF state, and full flow integration
📌 Frontend OAuth tests cover: "Sign in with Microsoft" button, authenticated/unauthenticated states, logout flow, loading states
📌 CIAM Migration: Tests updated for Entra External ID. Authority URL now `{tenant}.ciamlogin.com` not `login.microsoftonline.com`
📌 CIAM test patterns: New user signup flow, existing user signin, social IdPs (Google/Facebook marked as skip), discovery endpoint validation
📌 CIAM UI implication: Single "Sign in with Microsoft" button handles both signup and signin — no separate registration flow needed
