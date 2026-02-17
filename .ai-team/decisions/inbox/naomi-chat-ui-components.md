# Chat UI Component Architecture

**Decided by:** Naomi  
**Date:** 2026-02-17  
**Status:** Implemented

## Decision

Built the chat UI as a four-component system with clear separation of concerns:

1. **RightNav** - Tab container managing Events/Chat switching with unread badges
2. **ChatPanel** - State manager coordinating MessageList and ChatInput
3. **MessageList** - Display layer with auto-scroll intelligence and memo optimization
4. **ChatInput** - Input handling with auto-grow, character limits, and keyboard shortcuts

## Rationale

**Component Boundaries:** Followed the EventLog pattern (container → list → items) but added an extra layer (RightNav) to handle tab switching. This keeps EventLog unchanged and provides a clean migration path.

**State Management:** ChatPanel owns local UI state (input value, scroll position, last read ID) while RightNav manages tab state. This matches React best practices - state lives at the lowest common ancestor.

**Auto-scroll Behavior:** Implemented "smart" auto-scroll that only activates when user is at bottom (within 50px threshold). Prevents jarring scroll interruptions when user is reading older messages. Used debounced scroll handler (100ms) for performance.

**Styling Patterns:** CSS Modules with component-scoped classes. Followed EventLog conventions: `container`, `header`, `content` pattern. Dark theme colors consistent with existing components. Custom scrollbar styling matches EventLog.

**Accessibility:** Tab switching uses proper ARIA (role="tablist", aria-selected). Message list uses role="log" with aria-live="polite" for screen reader announcements. Keyboard nav fully supported (Enter/Shift+Enter/Escape).

**Performance:** MessageItem wrapped in React.memo to prevent unnecessary re-renders. Timestamp formatting is pure function. Scroll handler debounced. Ready for virtual scrolling if needed (>100 messages).

## Integration Points

- ChatPanel uses placeholder data - ready to connect to `useChatMessages()` hook
- `onSend` handler ready for `room.send('send_chat', { content })` call
- ChatMessage interface matches design spec (id, playerId, playerName, playerColor, content, timestamp)
- RightNav imports EventLog - no changes needed to existing component

## Future Considerations

- Virtual scrolling (react-window) if >100 messages causes performance issues
- "New messages" indicator when scrolled up (button to jump to bottom)
- Input focus management (auto-focus on tab switch vs accessibility concerns)
- Timestamp updates (currently static - may want interval refresh for "Just now" → "1m ago")
