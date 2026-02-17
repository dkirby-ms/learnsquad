### 2026-02-17: Chat Integration Pattern

**By:** Naomi

**What:** Established pattern for integrating chat with game state store and Colyseus hooks. Chat messages flow: Colyseus backend → `room.onMessage('chat_message')` → `gameStateStore.addChatMessage()` → `useChatMessages()` hook → React components. Send flow: Component → `sendChatMessage()` from useGameSocket → `room.send('send_chat', { content })`.

**Why:** Chat needed integration with existing state management patterns. This approach:
- Reuses established store → hook → component pattern (same as events, players, diplomacy)
- Keeps Colyseus logic centralized in useGameSocket
- Limits message history (200 max) to prevent memory bloat
- Clears messages on disconnect for clean reconnection state
- Uses useSyncExternalStore for efficient React 18+ integration

**Key Implementation Details:**
- Store: `chatMessages: ChatMessage[]` with `addChatMessage()`, `clearChatMessages()`, `getChatMessages()`
- Hook: `useChatMessages()` in useGameState.ts (not separate file) for consistency
- Socket: `room.onMessage('chat_message')` listener, `sendChatMessage()` export
- Cleanup: `clearChatMessages()` called on disconnect alongside `clear()`
- Type: `ChatMessage` interface exported from gameState.ts for consistency

**Pattern Rationale:**
- Follows existing event history pattern (addEvents, getEventHistory, useEventHistory)
- Uses same subscriber notification pattern for React updates
- Maintains separation: networking (useGameSocket) ↔ state (gameStateStore) ↔ UI (hooks + components)
- RightNav prop-drills sendChatMessage to ChatPanel (alternative: context, rejected for simplicity)
