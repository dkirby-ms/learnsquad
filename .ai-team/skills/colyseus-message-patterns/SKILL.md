---
name: "colyseus-message-patterns"
description: "Patterns for implementing Colyseus message handlers in multiplayer games"
domain: "backend-multiplayer"
confidence: "medium"
source: "earned"
---

## Context
Colyseus provides a message-based communication layer for multiplayer games. Understanding the standard patterns for implementing message handlers ensures consistency, security, and reliability across features.

## Patterns

### Message Handler Registration
All message handlers are registered in a single method (`registerMessageHandlers()`) during room initialization. This centralizes message routing and makes the API surface visible.

```typescript
private registerMessageHandlers(): void {
  this.onMessage('pause_game', (client) => {
    this.pauseGame();
  });

  this.onMessage('send_chat', (client, message: { text: string }) => {
    this.handleChatMessage(client, message.text);
  });
}
```

### Server-Authoritative Validation
Never trust client input. Always validate on the server before processing or broadcasting. Check:
1. Player exists and is connected
2. Input format and type
3. Input constraints (length, range, etc.)
4. Business rules (permissions, cooldowns, etc.)

```typescript
private handleChatMessage(client: Client, text: string): void {
  const player = this.state.players.get(client.sessionId);
  
  if (!player || !player.isConnected) {
    return; // Ignore invalid requests
  }

  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 500) {
    client.send('chat_error', { error: 'Invalid message length' });
    return;
  }

  // Process valid message...
}
```

### Rate Limiting with Rolling Windows
Use a Map to track recent actions per session. Clean up stale timestamps before checking limits. This prevents spam without complex external dependencies.

```typescript
private chatRateLimits: Map<string, number[]> = new Map();
private readonly RATE_LIMIT = 5;
private readonly RATE_WINDOW = 10000; // 10 seconds

private checkRateLimit(sessionId: string): boolean {
  const now = Date.now();
  const timestamps = this.chatRateLimits.get(sessionId) || [];
  
  const recent = timestamps.filter(ts => now - ts < this.RATE_WINDOW);
  
  if (recent.length >= this.RATE_LIMIT) {
    return false; // Rate limit exceeded
  }

  recent.push(now);
  this.chatRateLimits.set(sessionId, recent);
  return true;
}
```

### Broadcast Pattern
Use `this.broadcast()` to send messages to all clients in the room. Include enough context for clients to render properly (player name, color, etc.).

```typescript
this.broadcast('chat_message', {
  playerId: player.id,
  playerName: player.name,
  playerColor: player.color,
  text: trimmed,
  timestamp: Date.now(),
  messageId: `${Date.now()}-${client.sessionId.slice(0, 8)}`,
});
```

### Error Feedback
Send error messages back to the specific client, not broadcast. This prevents leaking validation errors to other players.

```typescript
if (trimmed.length > MAX_LENGTH) {
  client.send('chat_error', { error: 'Message too long (max 500 characters)' });
  return;
}
```

### State vs Broadcast
**Use state schema when:**
- Data must persist across disconnects/reconnects
- New joiners need the data
- Data changes frequently and needs delta encoding
- Example: player positions, territory ownership

**Use broadcasts when:**
- Data is transient/ephemeral
- History is not critical
- New joiners don't need backfill
- Example: chat messages, notifications, events

### Cleanup on Disconnect
Always clean up session-specific data when a player leaves. This prevents memory leaks and stale data.

```typescript
async onLeave(client: Client, code?: number): Promise<void> {
  // Remove rate limit tracking
  this.chatRateLimits.delete(client.sessionId);
  
  // Remove pending actions
  this.activeClaims.delete(client.sessionId);
  
  // Update state...
}
```

### Player Activity Tracking
Update `player.lastActivityTick` on any meaningful action. This helps detect inactive/AFK players.

```typescript
private handleChatMessage(client: Client, text: string): void {
  // ... validation ...
  
  const player = this.state.players.get(client.sessionId);
  player.lastActivityTick = this.state.currentTick;
  
  // ... broadcast ...
}
```

## Examples

### Simple Command (No Payload)
```typescript
this.onMessage('pause_game', (client) => {
  this.pauseGame();
});
```

### Command with Payload
```typescript
this.onMessage('claim_node', (client, message: { nodeId: string }) => {
  this.claimNode(client, message.nodeId);
});
```

### Request-Response Pattern
```typescript
this.onMessage('ping', (client, message: { clientTime: number }) => {
  client.send('pong', {
    clientTime: message.clientTime,
    serverTime: Date.now(),
  });
});
```

### Offer-Accept Pattern (Diplomacy)
```typescript
// Player A sends offer
this.onMessage('offer_alliance', (client, message: { targetPlayerId: string }) => {
  // Store pending offer
  this.pendingOffers.set(offerId, { from, to, type: 'alliance', tick });
  
  // Notify target player
  targetClient.send('alliance_offer', { fromPlayerId, fromPlayerName });
});

// Player B accepts offer
this.onMessage('accept_alliance', (client, message: { fromPlayerId: string }) => {
  const offer = this.pendingOffers.get(offerId);
  if (!offer) return;
  
  // Update state
  relation.status = 'allied';
  this.pendingOffers.delete(offerId);
  
  // Notify both players
  this.broadcast('alliance_formed', { player1Id, player2Id });
});
```

## Anti-Patterns
- **Trusting client data** — Always validate. Clients can send anything.
- **Broadcasting errors** — Send errors to specific client only.
- **Storing ephemeral data in state** — Chat messages don't belong in GameState.
- **Forgetting cleanup** — Always clean up Maps/Sets in `onLeave()`.
- **Fixed-bucket rate limiting** — Use rolling windows for smoother UX.
- **No feedback** — Always acknowledge client actions (success or error).
