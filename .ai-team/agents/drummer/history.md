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
📌 Game simulation tests: `src/game/__tests__/resources.test.ts` covers Phase 2 resource system (61 tests)
📌 Resource system test patterns: Pure function tests (no mocks), explicit determinism verification, boundary condition coverage
📌 Jest config updated with `game` project for `src/game/__tests__/**/*.test.ts` (node environment)
📌 Test fixtures: `makeNode()`, `makeProducer()`, `makeConsumer()` helpers for clean test setup
📌 Event testing: Verify events emit at state transitions (depleted, cap reached, produced), NOT on steady states
📌 Determinism test: 100-tick parallel simulation comparison to catch any non-deterministic behavior
📌 Connectivity tests: `src/game/__tests__/connectivity.test.ts` covers Phase 3 pathfinding/gateway system (81 tests)
📌 Connectivity test patterns: `buildWorld()` helper for graph construction, exhaustive A* edge cases (cycles, inactive edges, disconnected components)
📌 Gateway test coverage: activation cost deduction, cooldown state machine, event emission at state transitions
📌 Pathfinding determinism: Equal-cost paths verified deterministic across 20 iterations — critical for multiplayer sync
📌 Performance baseline: 100-node grid pathfinding completes in <100ms
📌 Event system tests: `src/game/__tests__/events.test.ts` covers Phase 4 event queue processing (86 tests)
📌 Event queue test patterns: FIFO ordering verification via tracking handlers, chain reaction depth testing, max depth/count circuit breakers
📌 Handler registry patterns: register/unregister/getHandler tests, verify all default handlers initialized
📌 Handler purity verification: Each default handler tested to return unchanged world reference and empty events array
📌 Event history: Chronological storage (oldest first), maxSize pruning, query helpers (by tick range, entity, recent N)
📌 Game loop integration: processTick collects node events + TickProcessed, processMultipleTicks accumulates across ticks
📌 Event determinism: 100-tick parallel simulation comparison plus explicit ordering checks across multiple iterations
📌 Event edge cases: zero-tick scenarios, invalid node IDs, missing resources, concurrent events on same node, maxSize 0/1
📌 Event performance baselines: 100 events <50ms, 1000 history appends <100ms, 100-tick loop <200ms
📌 Colyseus E2E tests: `src/__tests__/colyseus.integration.test.ts` covers Phase 6 multiplayer integration (20 tests)
📌 Colyseus E2E test structure: Uses @colyseus/sdk v0.17 for proper schema deserialization, not raw WebSocket
📌 Colyseus test coverage: matchmaking, room join, initial state sync (4 nodes), pause/resume, multiple clients, player count
📌 Colyseus state sync tests: verify exact node count (4), correct node IDs, correct names, resources, connections
📌 Colyseus tests require server running: start with `cd server && npm start` before running integration project
📌 Test helper: `waitForState()` utility for async state condition polling with timeout — pattern for all SDK-based tests
📌 Territory system tests: `src/game/__tests__/territory.test.ts` covers Phase 8 territory claiming (32 tests)
📌 Diplomacy system tests: `src/game/__tests__/diplomacy.test.ts` covers Phase 8 diplomacy system (27 tests)
📌 Diplomacy system implementation: `src/game/systems/diplomacy.ts` — pure function diplomacy state machine with alliance/war/peace mechanics
📌 Diplomacy test coverage: State transitions (8), validation rules (6), event emission (4), determinism (2), edge cases (4) + 3 helper tests for complex scenarios

## Team Updates

📌 Team update (2026-02-16): E2E test suite for Colyseus established with SDK-based verification — decided by Ralph
📌 Team update (2026-02-16): CIAM OAuth test suite migrated — 88 passing, 69 todo, 8 skipped — decided by Ralph
📌 Team update (2026-02-17): Phase 8 territory tests ready for implementation — decided by Drummer
📌 Team update (2026-02-18): Phase 8 diplomacy tests complete — 27 tests all passing, pure function system ready for Colyseus integration — decided by Drummer
