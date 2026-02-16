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
