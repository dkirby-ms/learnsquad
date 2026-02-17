---
name: "ephemeral-broadcast-pattern"
description: "Pattern for real-time features that don't require state persistence"
domain: "architecture"
confidence: "low"
source: "earned"
---

## Context
When building real-time multiplayer features with Colyseus, not everything belongs in the synchronized GameState schema. Some features are ephemeral (chat, notifications, player actions) and benefit from a simpler broadcast-only pattern.

## Pattern

### When to Use
Use ephemeral broadcast when:
- Feature is real-time but not part of "game state" (chat, notifications, activity feeds)
- New clients don't need historical data (joining player doesn't need old chat)
- Data is high-frequency or large-volume (would bloat state synchronization)
- Feature has its own lifecycle independent of game state (disconnection clears it)

### When NOT to Use
Use Colyseus state schema when:
- Data must persist across disconnects/reconnects
- New clients need the data on join (game entities, scores, resources)
- Data is part of the game simulation (affects gameplay)
- Order of updates matters (Colyseus handles delta synchronization)

### Implementation Structure

**Server (Colyseus GameRoom):**
```typescript
// 1. Add message handler (no schema changes)
this.onMessage('feature_action', (client, payload) => {
  // 2. Validate (authorization, rate limiting, sanitization)
  const player = this.state.players.get(client.sessionId);
  if (!player || !player.isConnected) return;
  if (!this.checkRateLimit(client.sessionId)) return;
  
  // 3. Enrich with server-side data
  const enrichedPayload = {
    ...payload,
    playerId: player.id,
    playerName: player.name,
    timestamp: Date.now(),
    tick: this.state.currentTick,
  };
  
  // 4. Broadcast to all clients (or target specific clients)
  this.broadcast('feature_event', enrichedPayload);
});
```

**Client (gameStateStore):**
```typescript
// 1. Add client-side storage (outside Colyseus sync)
private featureData: FeatureItem[] = [];

// 2. Add methods
getFeatureData(): readonly FeatureItem[] { return this.featureData; }
addFeatureItem(item: FeatureItem): void {
  this.featureData = [item, ...this.featureData].slice(0, MAX_ITEMS);
  this.notify();
}
clearFeatureData(): void {
  this.featureData = [];
  this.notify();
}

// 3. Clear in disconnect handler
clear(): void {
  // ... other clearing
  this.clearFeatureData();
}
```

**Client (useGameSocket hook):**
```typescript
// 1. Add listener in setupRoomListeners
room.onMessage('feature_event', (item: FeatureItem) => {
  gameStateStore.addFeatureItem(item);
});

// 2. Add action method
const doFeatureAction = useCallback((payload: ActionPayload) => {
  roomRef.current?.send('feature_action', payload);
}, []);
```

### Key Characteristics

1. **No Schema**: Feature data not in GameState schema
2. **Server Authority**: Validation, enrichment, and rate limiting on server
3. **Broadcast**: Server broadcasts to all (or subset of) clients
4. **Client Storage**: Store locally in gameStateStore (not synced)
5. **Ephemeral**: Cleared on disconnect, not persisted
6. **Scoped Limit**: Cap stored items (e.g., 100 messages, 50 notifications)

## Examples

### Chat Messages (Real-Time Communication)
- Client sends `chat_message` → Server validates → Broadcasts `chat` event
- Store last 100 messages client-side
- Clear on disconnect (new players don't see old chat)
- Rate limit: 5 messages per 10 seconds

### Activity Feed (Player Actions)
- Client sends `player_activity` → Server enriches with player data → Broadcasts `activity` event
- Store last 20 activities client-side
- Show "Player X claimed Node Y" notifications
- Clear on disconnect

### Transient Animations (Visual Effects)
- Client sends `play_effect` → Server validates → Broadcasts `effect` event
- No storage needed (render and discard)
- Example: "Player joined", "Achievement unlocked" popups

## Trade-offs

### Benefits
- **Simpler**: No schema design, no delta synchronization complexity
- **Faster**: Direct broadcast, no state diffing overhead
- **Scalable**: High-frequency events don't bloat game state
- **Flexible**: Easy to add/remove without migration concerns

### Costs
- **No History**: New clients miss past events (acceptable for many features)
- **No Persistence**: Data lost on disconnect (must be acceptable)
- **Manual Management**: Must implement rate limiting, sanitization, validation
- **No Replay**: Can't replay/debug past events from state snapshots

## Anti-Patterns

- **Using schema for chat** — Bloats game state, slower synchronization
- **No rate limiting** — Opens spam/DOS attack vector
- **No client-side storage** — Component re-renders lose history
- **Storing in component state** — Lost on navigation/unmount
- **No validation** — Allows malicious/malformed data
- **Trusting client data** — Server must enrich with authoritative player info

## Decision Criteria

Ask these questions:
1. Do new clients need this data on join? **NO** → Ephemeral broadcast
2. Is this data part of game state? **NO** → Ephemeral broadcast
3. Does this data affect gameplay? **NO** → Ephemeral broadcast
4. Is this high-frequency data? **YES** → Ephemeral broadcast
5. Should this persist across disconnects? **NO** → Ephemeral broadcast

If you answered opposite to above, use Colyseus state schema instead.

## Related Patterns
- **Event Sourcing**: For features that need replay/audit (use schema + events array)
- **State Synchronization**: For core game state (use Colyseus schema)
- **Pub/Sub**: For decoupled systems (same broadcast concept, different transport)
