# Chat Feature - UI/UX Design Document
**Designer:** Naomi (Frontend Dev)  
**Date:** 2026-02-17  
**Status:** Design Proposal (No Implementation Yet)

---

## Overview

A real-time chat interface for players in the same game room, implemented as a tab on the right navigation sidebar alongside the existing Event Log.

---

## 1. Component Structure

### Component Hierarchy

```
RightNav (NEW)
├── TabBar
│   ├── Tab: "Events" (with unread count badge)
│   └── Tab: "Chat" (with unread count badge)
└── TabContent
    ├── EventLog (existing, wrapped)
    └── ChatPanel (NEW)
        ├── MessageList
        │   └── MessageItem[] (player name, timestamp, content)
        └── ChatInput
            ├── Textarea (auto-growing)
            ├── CharacterCount
            └── SendButton
```

### Component Specifications

#### **RightNav Component**
```typescript
interface RightNavProps {
  // No props needed - manages its own tab state
}

interface RightNavState {
  activeTab: 'events' | 'chat';
  unreadChatCount: number;
  unreadEventCount: number;
}
```

**Responsibilities:**
- Manage active tab state
- Track unread counts for both tabs
- Render tab bar and active tab content
- Mark messages/events as read when tab is viewed

---

#### **ChatPanel Component**
```typescript
interface ChatPanelProps {
  isVisible: boolean; // Whether this tab is active
  onUnreadChange?: (count: number) => void; // Report unread count to parent
}

interface ChatPanelState {
  inputValue: string;
  isAtBottom: boolean; // Scroll position tracking
  lastReadMessageId: string | null;
}
```

**Responsibilities:**
- Display scrollable message list
- Handle message input and submission
- Auto-scroll to new messages (when at bottom)
- Track unread messages
- Manage input focus and keyboard shortcuts

---

#### **MessageItem Component**
```typescript
interface MessageItemProps {
  message: ChatMessage;
  isCurrentPlayer: boolean;
  playerColor?: string; // From player data
}

interface ChatMessage {
  id: string; // Unique message ID
  playerId: string;
  playerName: string;
  content: string;
  timestamp: number; // Unix timestamp
}
```

**Visual Design:**
- Sender name with player color indicator
- Timestamp in relative format (e.g., "2m ago", "Just now")
- Message content with word wrapping
- Current player messages slightly distinguished (opacity or alignment)

---

## 2. Layout & Visual Design

### Right Nav Layout (300px width)

```
┌─────────────────────────────────────┐
│  [Events]    [Chat (2)] ←tabs       │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Player1      2m ago         │   │
│  │ Hey everyone!               │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ You          Just now       │   │
│  │ Hello!                      │   │
│  └─────────────────────────────┘   │
│                                     │
│  [scrollable message area]          │
│                                     │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐   │
│  │ Type a message...           │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│  150/500             [Send] ←button │
└─────────────────────────────────────┘
```

### Tab Bar Design
- Two tabs: "Events" and "Chat"
- Active tab: Brighter background (`rgba(255, 255, 255, 0.08)`)
- Inactive tab: Dimmer (`rgba(255, 255, 255, 0.02)`)
- Unread badge: Small pill with count, positioned top-right of tab text
- Badge color: Blue (`#3b82f6`) for visibility
- Smooth hover transition
- Active tab indicator: Bottom border (2px, accent color)

### Message Item Design
- Container: `padding: 10px 12px`, subtle border-bottom
- Player name: Bold, 13px, with color dot (8px circle)
- Timestamp: 11px, gray (`#6b7280`), right-aligned
- Content: 13px, word-wrap, color `#e8eaed`
- Current player messages: Slightly lower opacity on name/timestamp
- Hover state: Subtle background highlight

### Input Area Design
- Textarea: Auto-growing (min 40px, max 120px)
- Background: `rgba(255, 255, 255, 0.05)`
- Border: `1px solid rgba(255, 255, 255, 0.1)`
- Rounded corners: `6px`
- Padding: `8px 12px`
- Placeholder: "Type a message..." in gray
- Character count: Small text, bottom-left, shows when typing
- Send button: Right-aligned, blue accent, disabled when empty/overlimit

---

## 3. User Interactions

### Typing & Sending
- **Enter**: Submit message (if not empty and within char limit)
- **Shift+Enter**: Insert newline
- **Escape**: Clear input focus (blur)
- **Character Limit**: 500 characters
  - Show count when > 400 or overlimit
  - Prevent submission when overlimit
  - Count turns red when overlimit

### Scrolling Behavior
- **Auto-scroll**: When user is scrolled to bottom and new message arrives
- **Manual scroll**: If user scrolls up, disable auto-scroll
- **Re-enable auto-scroll**: When user scrolls back to bottom (within 50px)
- **New message indicator**: Small "New messages ↓" button when scrolled up
  - Click to scroll to bottom and re-enable auto-scroll
  - Disappears when at bottom

### Tab Switching
- **Click tab**: Switch active content, smooth transition (200ms fade)
- **Mark as read**: When tab becomes active, reset unread count
- **Unread badge**: Shows count when tab is inactive
  - Events: Count of events since last view
  - Chat: Count of messages since last view

### Keyboard Shortcuts
- **Ctrl+/** (or Cmd+/): Focus chat input
- **Tab navigation**: Tab bar is keyboard navigable

---

## 4. State Management

### Local UI State (React Component State)
```typescript
// In ChatPanel
const [inputValue, setInputValue] = useState('');
const [isAtBottom, setIsAtBottom] = useState(true);
const [lastReadMessageId, setLastReadMessageId] = useState<string | null>(null);

// In RightNav
const [activeTab, setActiveTab] = useState<'events' | 'chat'>('events');
const [unreadChatCount, setUnreadChatCount] = useState(0);
```

**Why Local:**
- Input value doesn't need to be shared
- Scroll position is UI-specific
- Tab state is component-specific

### Synced State (Colyseus → Store)
```typescript
// In gameStateStore
interface GameState {
  // ... existing state
  chatMessages: ChatMessage[];
}

// New hook in useGameState.ts
export function useChatMessages(): ChatMessage[] {
  return useStore((state) => state.chatMessages);
}
```

**Colyseus Integration:**
```typescript
// In useGameSocket.ts - listener
room.onMessage('chat_message', (message: ChatMessage) => {
  gameStateStore.addChatMessage(message);
});

// In useGameSocket.ts - sender
const sendChatMessage = useCallback((content: string) => {
  roomRef.current?.send('send_chat', { content });
}, []);
```

**Store Actions:**
```typescript
// In gameStateStore.ts
addChatMessage(message: ChatMessage) {
  // Add to messages array
  // Keep last 200 messages for performance
  // Notify subscribers
}

clearChatMessages() {
  // Clear on disconnect
}
```

---

## 5. UX Patterns

### Message Display
- **Timestamp Format**:
  - "Just now" (< 10 seconds)
  - "2m ago" (< 60 minutes)
  - "3h ago" (< 24 hours)
  - "Feb 17" (older)
- **Player Color Dot**: 8px circle next to name, matches player color
- **Grouping**: No grouping (each message is individual item)
- **Date Separators**: Optional future enhancement ("Today", "Yesterday")

### Input Field Behavior
- **Auto-focus**: Focus input when tab opens (accessibility considered)
- **Preserve Input**: Keep typed text when switching tabs (don't clear)
- **Auto-grow**: Textarea expands as user types (up to max height)
- **Visual Feedback**:
  - Send button disabled when empty
  - Character count shows early warning (yellow at 450, red at 500)
  - Pressing Enter on overlimit message shows error shake animation

### Unread Indicators
- **Badge Position**: Small circle with number, top-right of tab text
- **Badge Visibility**: Only show when count > 0
- **Badge Animation**: Subtle fade-in when new message arrives
- **Clear Logic**: When tab becomes active AND user scrolls to bottom

### Empty States
- **No Messages Yet**:
  ```
  💬
  No messages yet
  Start a conversation!
  ```
- **Disconnected**: Show gray overlay with "Reconnecting..." message

---

## 6. Styling Approach

### CSS Modules Pattern (Existing Convention)
- Each component has co-located `.module.css` file
- Classes scoped to component
- Shared colors via CSS variables or inline from theme

### Color Palette (Existing Dark Theme)
- Background: `#0a0e17` (app)
- Card/Panel: `#141a26`
- Border: `rgba(255, 255, 255, 0.05)`
- Text Primary: `#e8eaed`
- Text Secondary: `#9ca3af`
- Text Tertiary: `#6b7280`
- Accent Blue: `#3b82f6`
- Accent Hover: `#2563eb`

### Typography
- Tab Label: 14px, 600 weight
- Player Name: 13px, 500 weight
- Message Content: 13px, 400 weight
- Timestamp: 11px, 400 weight
- Input Placeholder: 13px, 400 weight
- Character Count: 11px, 400 weight

### Transitions
- Tab switch: 200ms ease-in-out
- Hover states: 150ms ease
- Badge fade: 200ms ease

---

## 7. Integration Points

### With Existing Components

#### GameWorld Component
**Before:**
```tsx
<aside className={styles.rightSidebar}>
  <EventLog maxEvents={30} collapsed={...} onToggleCollapse={...} />
</aside>
```

**After:**
```tsx
<aside className={styles.rightSidebar}>
  <RightNav />
</aside>
```

#### Colyseus Hook (useGameSocket)
**New Return Value:**
```typescript
export interface GameSocketReturn {
  // ... existing
  sendChatMessage: (content: string) => void; // NEW
}
```

**New Listener:**
```typescript
// In setupRoomListeners
room.onMessage('chat_message', (message: ChatMessage) => {
  gameStateStore.addChatMessage(message);
});
```

### With Game State Store

**New State:**
```typescript
interface GameState {
  // ... existing
  chatMessages: ChatMessage[];
  maxChatMessages: number; // 200
}
```

**New Actions:**
```typescript
addChatMessage(message: ChatMessage): void
clearChatMessages(): void
```

**New Hook:**
```typescript
export function useChatMessages(): ChatMessage[] {
  return useStore((state) => state.chatMessages);
}
```

---

## 8. Performance Considerations

### Message List Optimization
- **Current Plan**: Simple scrollable div for MVP (up to 200 messages)
- **Future Enhancement**: Virtual scrolling (react-window) if 200+ messages
- **Memory**: Limit to last 200 messages in store
- **Rendering**: React.memo on MessageItem to prevent unnecessary re-renders

### Scroll Performance
- Use `requestAnimationFrame` for scroll position checks
- Debounce scroll event handler (100ms)
- Intersection Observer for "at bottom" detection

### Input Performance
- Debounce character count updates (50ms)
- No real-time typing indicators in MVP (can add later)

---

## 9. Accessibility

### Keyboard Navigation
- Tab bar: Arrow keys navigate between tabs
- Chat input: Standard textarea keyboard behavior
- Send button: Space/Enter to activate

### Screen Readers
- Tab labels with unread counts announced
- Message list has `role="log"` with `aria-live="polite"`
- Input has `aria-label="Chat message"`
- Send button has `aria-label="Send message"`

### Focus Management
- Tab switch maintains focus on tab bar or moves to content
- Escape key blurs input but keeps focus in chat area
- Focus visible styles for keyboard navigation

---

## 10. Future Enhancements (Out of Scope for MVP)

1. **Mentions**: @playername autocomplete
2. **Emoji Picker**: Button to insert emojis
3. **Typing Indicators**: "Player is typing..."
4. **Message Reactions**: Click to react with emoji
5. **Timestamps on Hover**: Show full date/time
6. **Message Edit/Delete**: Edit recent messages
7. **Chat Commands**: /help, /clear, etc.
8. **Private Messages**: DM another player (separate feature)
9. **Chat History Export**: Download chat log
10. **Rich Text**: Bold, italic, links (with sanitization)

---

## 11. Open Questions for Backend (Amos)

1. **Message Schema**: Confirm ChatMessage structure matches backend
2. **Rate Limiting**: Should frontend throttle sends (e.g., 1 msg/sec)?
3. **History**: How many messages does server send on join?
4. **Persistence**: Are messages persisted in database or session-only?
5. **Validation**: Server-side char limit enforcement?
6. **Player Identity**: Does server inject playerId/playerName or trust client?

---

## 12. Wireframe (ASCII Art)

### Full Right Nav - Events Tab Active
```
┌───────────────────────────────────────┐
│ [Events]     Chat (2)                 │ ← Tab Bar
├───────────────────────────────────────┤
│                                       │
│  ⚡ Resource Produced        T1234   │
│     resource: energy, amount: 10.50  │
│                                       │
│  🏴 Node Claimed              T1233   │
│     nodeId: node_1                   │
│                                       │
│  🔍 Node Discovered          T1232   │
│     nodeId: node_2                   │
│                                       │
│  [scrollable event list...]           │
│                                       │
└───────────────────────────────────────┘
```

### Full Right Nav - Chat Tab Active
```
┌───────────────────────────────────────┐
│  Events     [Chat]                    │ ← Tab Bar
├───────────────────────────────────────┤
│                                       │
│  ┌─────────────────────────────────┐ │
│  │ ● Player1        2m ago         │ │
│  │ Anyone want to ally?            │ │
│  └─────────────────────────────────┘ │
│                                       │
│  ┌─────────────────────────────────┐ │
│  │ ● Player2        1m ago         │ │
│  │ Sure, I'm in!                   │ │
│  └─────────────────────────────────┘ │
│                                       │
│  ┌─────────────────────────────────┐ │
│  │ ● You            Just now       │ │
│  │ Great! Let's coordinate...      │ │
│  └─────────────────────────────────┘ │
│                                       │
│  [scrollable message area...]         │
│                                       │
├───────────────────────────────────────┤
│  ┌─────────────────────────────────┐ │
│  │ Type a message...               │ │
│  │                                 │ │
│  └─────────────────────────────────┘ │
│  45/500                      [Send]   │
└───────────────────────────────────────┘
```

---

## Summary

This design integrates seamlessly with the existing EventLog by creating a tabbed container (RightNav) that houses both features. The chat UI follows established patterns:

- **CSS Modules** for styling (like EventLog)
- **Colyseus room.send/onMessage** for communication (like diplomacy actions)
- **Custom hooks** for state access (like useEventHistory)
- **Dark theme colors** and typography (consistent with app)
- **Collapsible sections** and **scrollable lists** (like EventLog)

The component structure is clean, the interactions are intuitive, and the integration points are minimal and well-defined. Ready for implementation once backend support is in place!
