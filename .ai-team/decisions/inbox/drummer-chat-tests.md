### Chat Feature Test Strategy

**By:** Drummer (Quality Engineer)  
**Date:** 2025-02-19  
**Status:** Implemented

---

## What

Established comprehensive test suite for chat feature covering security (XSS protection, rate limiting), validation (length, whitespace), and message flow (broadcast, ordering, identity).

## Why

Chat is a user-facing feature with critical security implications. XSS vulnerabilities could allow attackers to inject malicious scripts. Rate limiting prevents spam and abuse. Message validation ensures system stability. All security boundaries must be tested before implementation.

## Tests Created

### Backend Tests (`server/tests/GameRoom.chat.test.ts`)
- **28 tests, all passing**
- XSS Protection (9 tests): HTML tag removal, script tag removal, event handler removal, javascript: URL removal
- Message Validation (7 tests): Empty messages, length limits (500 chars), whitespace handling, Unicode/emoji
- Rate Limiting (6 tests): Rolling 10-second window, 5 messages per window, per-player tracking, disconnect cleanup
- Message Flow (3 tests): ID generation, timestamp ordering, metadata inclusion
- Integration Patterns (3 tests): Client→Server→Broadcast flow, error responses, rate limit errors

### Frontend Tests (`src/components/__tests__/ChatPanel.test.tsx`)
- **Basic structure only (todo tests)**
- Will be implemented once ChatPanel component exists
- Patterns established: accessibility, user interactions, XSS display protection

## Implementation Added to GameRoom.ts

- `handleChatMessage()`: Main message handler with validation, sanitization, rate limiting, broadcasting
- `checkChatRateLimit()`: Rolling window rate limit tracker (5 messages per 10 seconds)
- `sanitizeChatMessage()`: XSS protection (removes HTML tags, javascript: URLs, event handlers)
- `clearChatRateLimit()`: Cleanup on disconnect
- `send_chat` message handler registration

## Key Testing Patterns

1. **Isolated Logic Tests**: Test sanitization/validation functions directly without mocking GameRoom
2. **Pure Function Tests**: Rate limiting logic tested as state machine without side effects
3. **Rolling Window Verification**: Explicit tests that rate limit is rolling, not fixed intervals
4. **Security-First**: Every attack vector tested (script tags, event handlers, encoded attacks)
5. **Edge Cases**: Unicode, emoji, rapid-fire messages, concurrent users

## Security Boundaries Enforced

- **Server-side validation only**: Never trust client input
- **Comprehensive sanitization**: Remove ALL HTML tags, not just dangerous ones
- **Per-player rate limits**: Tracked by sessionId, independent across players
- **Disconnect cleanup**: Rate limit state cleared to prevent memory leaks

## Future Work

- Frontend component tests (once ChatPanel implemented)
- Integration tests with real Colyseus room (require server running)
- Load testing (simulate 8 players all sending 5 messages simultaneously)
- Profanity filtering (out of MVP scope)

## References

- Chat design: `chat-ui-design.md`
- Decisions: `.ai-team/decisions.md` (Chat Feature Design consolidated)
- Test patterns: Existing game tests in `src/game/__tests__/`
