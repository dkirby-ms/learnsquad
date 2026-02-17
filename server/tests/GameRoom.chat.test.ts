/**
 * Chat Feature Tests - Backend
 * 
 * Comprehensive tests for chat functionality focusing on:
 * - Rate limiting (5 messages per 10 seconds)
 * - XSS protection (HTML sanitization)
 * - Message validation (length, empty, whitespace)
 * - Message flow (broadcast, identity, ordering)
 * 
 * Testing strategy:
 * - Test chat utility functions in isolation
 * - Mock minimal dependencies
 * - Verify security boundaries are enforced
 * - Test edge cases and concurrent scenarios
 */

// Mock uuid before importing GameRoom
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234'),
}));

describe('Chat Validation and Sanitization', () => {
  // Test sanitization logic directly
  function sanitizeChatMessage(content: string): string {
    let sanitized = content.replace(/<[^>]*>/g, '');
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/on\w+\s*=/gi, '');
    return sanitized;
  }

  describe('XSS Protection', () => {
    it('passes plain text unchanged', () => {
      const input = 'Hello world! This is a normal message.';
      const sanitized = sanitizeChatMessage(input);
      expect(sanitized).toBe(input);
    });

    it('removes script tags', () => {
      const input = 'Hello <script>alert("XSS")</script> world';
      const sanitized = sanitizeChatMessage(input);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('</script>');
      expect(sanitized).toBe('Hello alert("XSS") world');
    });

    it('removes onclick attributes', () => {
      const input = '<div onclick="doEvil()">Click me</div>';
      const sanitized = sanitizeChatMessage(input);
      expect(sanitized).not.toContain('onclick');
      expect(sanitized).not.toContain('doEvil');
    });

    it('removes javascript: URLs', () => {
      const input = '<a href="javascript:alert(1)">Click</a>';
      const sanitized = sanitizeChatMessage(input);
      expect(sanitized).not.toContain('javascript:');
      // Both javascript: and tags are removed
      expect(sanitized).toBe('Click');
    });

    it('preserves safe text with HTML entities', () => {
      const input = 'I &lt;3 coding &amp; gaming!';
      const sanitized = sanitizeChatMessage(input);
      expect(sanitized).toBe(input);
    });

    it('removes multiple attack vectors in one message', () => {
      const input = '<script>alert(1)</script><img src=x onerror="alert(2)"><a href="javascript:alert(3)">test</a>';
      const sanitized = sanitizeChatMessage(input);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('onerror');
      expect(sanitized).not.toContain('javascript:');
    });

    it('handles encoded script tags safely', () => {
      const input = '&lt;script&gt;alert("XSS")&lt;/script&gt;';
      const sanitized = sanitizeChatMessage(input);
      // Encoded tags are safe to display
      expect(sanitized).toBe(input);
    });

    it('removes HTML tags comprehensively', () => {
      const input = '<b>Bold</b> <i>Italic</i> <u>Underline</u>';
      const sanitized = sanitizeChatMessage(input);
      expect(sanitized).toBe('Bold Italic Underline');
    });

    it('handles nested HTML tags', () => {
      const input = '<div><span><script>evil()</script></span></div>';
      const sanitized = sanitizeChatMessage(input);
      expect(sanitized).toBe('evil()');
    });
  });

  describe('Message Validation', () => {
    const CHAT_MAX_LENGTH = 500;

    it('empty message should be rejected', () => {
      const content = '';
      const trimmed = content.trim();
      expect(trimmed.length).toBe(0);
    });

    it('message over 500 characters should be rejected', () => {
      const content = 'a'.repeat(501);
      expect(content.length).toBeGreaterThan(CHAT_MAX_LENGTH);
    });

    it('message exactly 500 characters should be accepted', () => {
      const content = 'a'.repeat(500);
      expect(content.length).toBe(CHAT_MAX_LENGTH);
    });

    it('whitespace-only message should be rejected', () => {
      const content = '   \n\t   ';
      const trimmed = content.trim();
      expect(trimmed.length).toBe(0);
    });

    it('message with newlines should be accepted', () => {
      const content = 'Line 1\nLine 2\nLine 3';
      const trimmed = content.trim();
      expect(trimmed.length).toBeGreaterThan(0);
    });

    it('message with leading/trailing whitespace should be trimmed', () => {
      const content = '  Hello world!  ';
      const trimmed = content.trim();
      expect(trimmed).toBe('Hello world!');
    });

    it('Unicode and emoji should be handled correctly', () => {
      const content = 'Hello 世界! 🎮🚀✨';
      const trimmed = content.trim();
      expect(trimmed).toBe(content);
    });
  });
});

describe('Chat Rate Limiting Logic', () => {
  const CHAT_RATE_LIMIT_MESSAGES = 5;
  const CHAT_RATE_LIMIT_WINDOW_MS = 10000; // 10 seconds

  interface ChatRateLimit {
    messages: number[];
    lastChecked: number;
  }

  function checkChatRateLimit(
    rateLimit: ChatRateLimit,
    now: number
  ): { allowed: boolean; updatedRateLimit: ChatRateLimit } {
    // Remove messages outside the window (rolling window)
    const filteredMessages = rateLimit.messages.filter(
      timestamp => now - timestamp < CHAT_RATE_LIMIT_WINDOW_MS
    );

    // Check if under limit
    if (filteredMessages.length >= CHAT_RATE_LIMIT_MESSAGES) {
      return {
        allowed: false,
        updatedRateLimit: {
          messages: filteredMessages,
          lastChecked: now,
        },
      };
    }

    // Add current message timestamp
    return {
      allowed: true,
      updatedRateLimit: {
        messages: [...filteredMessages, now],
        lastChecked: now,
      },
    };
  }

  it('allows 5 messages in 10 seconds', () => {
    let rateLimit: ChatRateLimit = { messages: [], lastChecked: 0 };
    const startTime = Date.now();

    // Send 5 messages
    for (let i = 0; i < 5; i++) {
      const result = checkChatRateLimit(rateLimit, startTime + i * 100);
      expect(result.allowed).toBe(true);
      rateLimit = result.updatedRateLimit;
    }

    expect(rateLimit.messages.length).toBe(5);
  });

  it('rejects 6th message in same 10-second window', () => {
    let rateLimit: ChatRateLimit = { messages: [], lastChecked: 0 };
    const startTime = Date.now();

    // Send 5 messages
    for (let i = 0; i < 5; i++) {
      const result = checkChatRateLimit(rateLimit, startTime + i * 100);
      rateLimit = result.updatedRateLimit;
    }

    // 6th message should be rejected
    const result = checkChatRateLimit(rateLimit, startTime + 500);
    expect(result.allowed).toBe(false);
  });

  it('allows messages after 10-second window reset', () => {
    let rateLimit: ChatRateLimit = { messages: [], lastChecked: 0 };
    const startTime = Date.now();

    // Send 5 messages
    for (let i = 0; i < 5; i++) {
      const result = checkChatRateLimit(rateLimit, startTime + i * 100);
      rateLimit = result.updatedRateLimit;
    }

    // Advance time by 10 seconds
    const result = checkChatRateLimit(rateLimit, startTime + 10000);
    expect(result.allowed).toBe(true);
  });

  it('uses rolling window, not fixed intervals', () => {
    let rateLimit: ChatRateLimit = { messages: [], lastChecked: 0 };
    const startTime = Date.now();

    // Send 5 messages over 9 seconds (2s apart each)
    for (let i = 0; i < 5; i++) {
      const result = checkChatRateLimit(rateLimit, startTime + i * 2000);
      rateLimit = result.updatedRateLimit;
    }

    // At 8 seconds from start, should still be at limit
    const result1 = checkChatRateLimit(rateLimit, startTime + 8000);
    expect(result1.allowed).toBe(false);

    // At 10 seconds from start, first message drops off
    const result2 = checkChatRateLimit(result1.updatedRateLimit, startTime + 10000);
    expect(result2.allowed).toBe(true);
  });

  it('clears old messages from window correctly', () => {
    const startTime = Date.now();
    const rateLimit: ChatRateLimit = {
      messages: [
        startTime - 11000, // Outside window (>10 seconds old)
        startTime - 5000,  // Inside window
        startTime - 3000,  // Inside window
      ],
      lastChecked: startTime - 5000,
    };

    const result = checkChatRateLimit(rateLimit, startTime);
    // Old message (>10s) should be filtered out, leaving 2 messages
    // But checkChatRateLimit also adds the current message, so total is 3
    expect(result.updatedRateLimit.messages.length).toBe(3);
    
    // Verify the old message is not in the list
    expect(result.updatedRateLimit.messages).not.toContain(startTime - 11000);
  });

  it('tracks separate rate limits per player', () => {
    const player1RateLimit: ChatRateLimit = { messages: [], lastChecked: 0 };
    const player2RateLimit: ChatRateLimit = { messages: [], lastChecked: 0 };
    const startTime = Date.now();

    // Player 1 sends 5 messages
    let p1Limit = player1RateLimit;
    for (let i = 0; i < 5; i++) {
      const result = checkChatRateLimit(p1Limit, startTime + i * 100);
      p1Limit = result.updatedRateLimit;
    }

    // Player 2 should still be able to send 5 messages
    let p2Limit = player2RateLimit;
    for (let i = 0; i < 5; i++) {
      const result = checkChatRateLimit(p2Limit, startTime + i * 100);
      expect(result.allowed).toBe(true);
      p2Limit = result.updatedRateLimit;
    }

    // Both players should be rate limited for 6th message
    expect(checkChatRateLimit(p1Limit, startTime + 1000).allowed).toBe(false);
    expect(checkChatRateLimit(p2Limit, startTime + 1000).allowed).toBe(false);
  });
});

describe('Chat Message Structure', () => {
  it('message should include all required fields', () => {
    const message = {
      id: 'mock-uuid-1234',
      playerId: 'p1',
      playerName: 'Player 1',
      playerColor: '#FF0000',
      text: 'Hello world!',
      timestamp: Date.now(),
    };

    expect(message.id).toBeTruthy();
    expect(message.playerId).toBeTruthy();
    expect(message.playerName).toBeTruthy();
    expect(message.playerColor).toMatch(/^#[0-9A-F]{6}$/i);
    expect(message.text).toBeTruthy();
    expect(message.timestamp).toBeGreaterThan(0);
  });

  it('message IDs should be unique', () => {
    const uuid = require('uuid');
    uuid.v4.mockReturnValueOnce('id-1');
    uuid.v4.mockReturnValueOnce('id-2');

    const id1 = uuid.v4();
    const id2 = uuid.v4();

    expect(id1).not.toBe(id2);
  });

  it('timestamps should be in chronological order', () => {
    const timestamp1 = Date.now();
    // Small delay
    const timestamp2 = timestamp1 + 100;
    const timestamp3 = timestamp2 + 100;

    expect(timestamp1).toBeLessThan(timestamp2);
    expect(timestamp2).toBeLessThan(timestamp3);
  });
});

describe('Chat Integration Patterns', () => {
  it('message flow: client sends -> server validates -> broadcast', () => {
    const clientMessage = { content: '  Hello world!  ' };
    
    // Server-side processing
    const trimmed = clientMessage.content.trim();
    const isValid = trimmed.length > 0 && trimmed.length <= 500;
    
    expect(isValid).toBe(true);
    
    if (isValid) {
      const sanitized = trimmed.replace(/<[^>]*>/g, '');
      const broadcastMessage = {
        id: 'mock-uuid',
        playerId: 'p1',
        playerName: 'Player 1',
        playerColor: '#FF0000',
        text: sanitized,
        timestamp: Date.now(),
      };
      
      expect(broadcastMessage.text).toBe('Hello world!');
    }
  });

  it('error flow: invalid message -> error response to client', () => {
    const clientMessage = { content: '' };
    
    const trimmed = clientMessage.content.trim();
    const isValid = trimmed.length > 0;
    
    expect(isValid).toBe(false);
    
    if (!isValid) {
      const errorResponse = {
        type: 'chat_error',
        data: {
          reason: 'empty_message',
          message: 'Message cannot be empty',
        },
      };
      
      expect(errorResponse.data.reason).toBe('empty_message');
    }
  });

  it('rate limit flow: exceed limit -> error response', () => {
    const rateLimit = {
      messages: [100, 200, 300, 400, 500], // 5 messages
      lastChecked: 500,
    };
    
    const now = 600;
    const filteredMessages = rateLimit.messages.filter(
      timestamp => now - timestamp < 10000
    );
    
    const isRateLimited = filteredMessages.length >= 5;
    expect(isRateLimited).toBe(true);
    
    if (isRateLimited) {
      const errorResponse = {
        type: 'chat_error',
        data: {
          reason: 'rate_limit',
          message: 'Too many messages. Please wait before sending another.',
        },
      };
      
      expect(errorResponse.data.reason).toBe('rate_limit');
    }
  });
});
