# Chat Backend Implementation

**Date:** 2025-07-16  
**Decided by:** Amos  
**Status:** Implemented

## Decision

Implemented chat message handling in GameRoom using:
- **XSS library:** `xss` npm package for sanitization (robust, maintained, sensible defaults)
- **Rate limiting:** Rolling window algorithm (5 messages per 10 seconds per player)
- **Message IDs:** `crypto.randomUUID()` for unique message identification
- **Error feedback:** Structured `chat_error` messages sent to sender on validation failures

## Rationale

**XSS Package Choice:**
- Mature library with 2.9M weekly downloads
- Handles HTML tags, JavaScript protocols, and event handlers
- More comprehensive than regex-based approaches
- Battle-tested in production environments

**Rolling Window Rate Limiting:**
- Filters timestamps older than 10 seconds on each check
- Simpler than token bucket algorithms
- Fairer than cooldown-based approaches (no punishment for single burst)
- Memory-efficient: only stores timestamps, auto-cleans on disconnect

**Native crypto.randomUUID():**
- No external UUID dependencies needed
- Cryptographically secure
- Standard in Node.js 14.17+
- Enables client-side deduplication and message tracking

**Server-Authoritative Design:**
- Player identity from sessionId mapping (can't be spoofed)
- All validation happens server-side
- Sanitization protects all clients, not just sender
- Rate limiting prevents server resource exhaustion

## Broadcast Message Schema

```typescript
{
  id: string,          // crypto.randomUUID()
  playerId: string,    // Player's persistent ID
  playerName: string,  // Display name
  content: string,     // Sanitized content
  timestamp: number    // Unix timestamp (ms)
}
```

## Error Message Schema

```typescript
{
  error: string  // Human-readable error message
}
```

## Impact

- Frontend (Naomi): Listen for `chat_message` broadcasts, send `send_chat` messages
- Frontend (Naomi): Handle `chat_error` messages for user feedback
- No impact on game simulation (Miller): Chat is pure networking layer
- No impact on diplomacy/territory systems: Independent feature

## Future Considerations

- Message persistence (PostgreSQL) if chat history is needed
- Alliance/faction/proximity chat via filtering logic
- Profanity filter integration if required
- Message edit/delete functionality
- Typing indicators (separate feature)
