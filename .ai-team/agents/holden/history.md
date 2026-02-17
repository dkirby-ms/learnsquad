# Project Context

- **Owner:** dkirby-ms (saitcho@outlook.com)
- **Project:** MMOG grand strategy browser game with pausable real-time mechanics (Paradox-style)
- **Stack:** React, TypeScript, PixiJS, Colyseus, Node.js, Express, PostgreSQL, Redis
- **Created:** 2025-07-12

## Learnings

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
