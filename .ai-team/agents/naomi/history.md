# Project Context

- **Owner:** dkirby-ms (saitcho@outlook.com)
- **Project:** MMOG grand strategy browser game with pausable real-time mechanics (Paradox-style)
- **Stack:** React, TypeScript, PixiJS, Colyseus, Node.js, Express, PostgreSQL, Redis
- **Created:** 2025-07-12

## Core Context

**UI Architecture:** React + CSS modules for components, PixiJS for game canvas. Uses Colyseus for real-time state sync. Auth via Microsoft Entra External ID (CIAM). Hash-based routing for MVP. Component structure: `src/components/{Name}/{Name}.tsx` with co-located CSS modules. Dark theme (#0a0e17 bg, #141a26 cards).

**Game State Management:** Custom pub/sub store in `src/store/gameState.ts` with hooks (useGameWorld, useEventHistory, usePlayers, useDiplomacy, etc.). Colyseus syncs schema via `room.onStateChange` and `room.onMessage`. Reconnection via `reconnectionToken` with fallback to fresh join.

**Player Presence & Territory:** PlayerList component shows online players with idle tracking (30-tick threshold). NodeView shows ownership with colored borders, claim/abandon buttons, progress bars (awaiting controlPoints). Player color via inline styles. Focus updates sent on click.

**Diplomacy System:** DiplomacyPanel shows all other players with status badges (Allied/War/Neutral). NodeView shows allied nodes with 🤝 (green glow) and enemy nodes with ⚔️ (red glow). Diplomatic relations stored with bidirectional key mapping. Toast notifications for actions. Backend handlers pending from Amos.

## Learnings

📌 Team update (2026-02-16): Colyseus frontend migration complete — aligned with backend message protocol — decided by Ralph
📌 Team update (2026-02-16): CIAM OAuth frontend architecture established — supports multi-provider extension — decided by Ralph
📌 Team update (2026-02-17): All changes must go through feature branches and PRs. Alex reviews all PRs before merge. No direct commits to master.

## Project Learnings (from import)

- Learnings older than 2 weeks (before ~2026-02-03) have been archived to `history-archive.md`
