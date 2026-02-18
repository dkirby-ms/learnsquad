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

**Right Nav Structure (2026-02-17):** Right sidebar in GameWorld (300px) currently houses EventLog directly. Uses CSS Grid layout (`grid-template-columns: 280px 1fr 300px`). EventLog has collapsible header with count badge, scrollable event list (max-height: 300px), custom scrollbar styling. Pattern: Container with header + content sections.

**Component Patterns:** Components follow `{Name}/{Name}.tsx` + `{Name}.module.css` structure. CSS modules for scoped styling. Dark theme colors: `#0a0e17` (bg), `#141a26` (cards), `#e8eaed` (text), `#6b7280` (secondary text), `#3b82f6` (accent). Hooks pattern: `useGameState()` hooks for store access, `useGameSocket()` for Colyseus actions.

**Colyseus Messaging Pattern:** Actions via `room.send(messageType, payload)` (e.g., `room.send('claim_node', { nodeId })`). Listeners via `room.onMessage(messageType, handler)`. State sync via `room.onStateChange()`. Store updates in listener callbacks. Pattern established in useGameSocket.ts (lines 306-310, 459-507).

**Interaction Patterns:** Collapsible sections use onClick + state toggle. Toast notifications for user actions (DiplomacyPanel pattern: message + auto-dismiss after 4s). Unread counts as badge pills (`padding: 2px 6px`, rounded, small font). Keyboard nav support with tabIndex and role attributes.

**Chat UI Components (2026-02-17):** Built four-component chat system following EventLog patterns. RightNav is tabbed wrapper with Events/Chat tabs, unread badge positioning (absolute, top-right), active tab styling (bottom border + brighter bg). ChatPanel manages state with placeholder data, hooks for scroll/visibility. MessageList uses memo optimization, auto-scroll when at bottom (checkIfAtBottom within 50px), debounced scroll handler (100ms), relative timestamps ("Just now", "2m ago", "3h ago"). ChatInput implements auto-growing textarea (min 40px, max 120px), Enter to send / Shift+Enter for newline, character count visibility (show >400 or overlimit), shake animation on overlimit attempt. All components use CSS modules with dark theme colors matching EventLog (#141a26 bg, #e8eaed text, #6b7280 secondary, #3b82f6 accent). Accessibility: role="tablist", aria-selected, role="log" with aria-live="polite", keyboard nav support. Ready for Colyseus integration.

**Chat Integration (2026-02-17):** Connected chat UI to Colyseus backend. Added `chatMessages: ChatMessage[]` to gameStateStore with `addChatMessage()` and `clearChatMessages()` actions (MAX_CHAT_HISTORY = 200). Added `room.onMessage('chat_message')` listener in useGameSocket, exports `sendChatMessage(content)` that calls `room.send('send_chat', { content })`. Chat messages cleared on disconnect. Created `useChatMessages()` hook in useGameState for component access (useSyncExternalStore pattern). ChatPanel now uses real data from store, connects send button to `sendChatMessage` from useGameSocket via RightNav prop drilling. GameWorld updated to use RightNav instead of EventLog directly. Pattern follows existing event history and player state management.

**Player Identity in Multiplayer (2026-02-17):** Fixed critical bug where `players[0]` was incorrectly assumed to be the current player — this breaks in multiplayer since join order doesn't match session ownership. Pattern: `room.sessionId` from Colyseus identifies the current connection, matches `player.id` in players array. Store now tracks `currentSessionId`, exposed via `useGameSocket` hook. Added `getCurrentPlayer()` to gameStateStore and `useCurrentPlayer()` hook for components. GameWorld and ChatPanel now use correct current player instead of first player. Key insight: In multiplayer, never assume array order — always match by explicit IDs from the server.

**PixiJS Canvas Architecture (2026-02-17):** Designed React/PixiJS integration for game canvas visualization. Pattern: GameCanvas component wraps PixiJS Application instance, SceneManager class encapsulates all rendering logic, sprite registry (Map<EntityId, Sprite>) for incremental updates instead of full redraws. Scene organization uses layered containers (background → connections → nodes → units → overlay) for z-order and independent updates. NodeSprite class encapsulates single-node rendering (circle + owner ring + diplomacy glow + resources + label). Uses pixi-viewport library for pan/zoom with drag/pinch/wheel support. State flow: Colyseus update → gameStateStore → React props → SceneManager.updateWorld() → sprite.update() → only changed sprites redraw. Interaction flow: PixiJS pointer events → SceneManager callbacks → GameCanvas setState → React overlay (tooltips/menus). Performance: Sprite reuse via registry, dirty tracking to skip unchanged redraws, Graphics for batch-rendered connection lines, optional culling for 100+ nodes. Canvas placeholder in GameWorld.tsx (line 170) ready for replacement. Dependencies: pixi.js, pixi-viewport. Files to create: src/components/GameCanvas/{GameCanvas.tsx, SceneManager.ts, NodeSprite.ts, ConnectionRenderer.ts}. Node positions from server schema (node.position.x/y), coordinate system TBD with backend.

## Project Learnings (from import)

- Learnings older than 2 weeks (before ~2026-02-03) have been archived to `history-archive.md`

📌 Team update (2025-01-22): Chat feature design consolidated across all layers (backend, frontend, systems integration, UI) — decided by Amos, Holden, Miller, Naomi

📌 Team update (2026-02-17): Chat UI component architecture (RightNav, ChatPanel, MessageList, ChatInput) with accessibility and performance optimization — decided by Naomi

📌 Team update (2026-02-17): PixiJS Canvas Integration Design consolidated from 4 separate design docs. Naomi's React/PixiJS integration pattern is the canonical reference. Also Chat feature consolidated with UI pattern finalized. — decided by Holden, Naomi, Amos, Miller
