---
name: "colyseus-state-optimization"
description: "Patterns for optimizing Colyseus state synchronization and minimizing bandwidth in real-time multiplayer games"
domain: "backend-multiplayer"
confidence: "medium"
source: "earned"
---

## Context
Colyseus provides automatic delta encoding for state synchronization, but developers still control what changes and when. Understanding how to minimize bandwidth and optimize state updates is critical for scaling multiplayer games to hundreds of entities and dozens of players.

## Key Principles

### 1. Delta Encoding is Automatic, But Changes Must Be Real
Colyseus detects property assignments as changes, even if the value is the same. Avoid unnecessary assignments.

```typescript
// ❌ Bad: Always triggers delta even if unchanged
node.controlPoints = node.controlPoints;

// ✅ Good: Only assign if value changed
if (node.controlPoints !== newControlPoints) {
  node.controlPoints = newControlPoints;
}
```

### 2. Static Data Pattern
Set static data once on creation, never change it. Zero sync cost after initial load.

```typescript
// ✅ Static data (set once, never change)
node.position.x = 100;
node.position.y = 200;
node.name = "Alpha Centauri";
connection.fromNodeId = "node-1";
connection.toNodeId = "node-2";
player.color = "#FF6B6B"; // Assigned on join

// ❌ Don't change static data
node.position.x += deltaX; // Position is not meant to change
```

**Why:** Colyseus only sends changed properties. If a property never changes, it's only sent on initial sync.

### 3. Batch Related Changes in Same Tick
Process all related updates together rather than spreading across multiple ticks.

```typescript
// ✅ Good: All claims processed in one tick
processClaims() {
  for (const [key, claim] of this.activeClaims) {
    const node = this.state.nodes.get(claim.nodeId);
    if (!node) continue;
    
    // Update multiple fields in same tick
    node.controlPoints += 10;
    if (node.controlPoints >= node.maxControlPoints) {
      node.ownerId = claim.playerId;
      node.status = 'claimed';
      node.controlPoints = node.maxControlPoints; // Cap it
    }
  }
}
```

### 4. Clear Ephemeral Collections
ArraySchema and MapSchema accumulate items unless explicitly cleared. Don't let them grow unbounded.

```typescript
// ✅ Good: Clear events each tick
onTick() {
  this.state.recentEvents.clear(); // Don't accumulate
  // Add only new events for this tick
  this.state.recentEvents.push(...newEvents);
}

// ❌ Bad: Never clearing
onTick() {
  // Keep appending — recentEvents grows forever
  this.state.recentEvents.push(...newEvents);
}
```

### 5. Use MapSchema Over ArraySchema for Entities
MapSchema provides efficient key-based access and delta encoding. ArraySchema is for sequential collections.

```typescript
// ✅ Good: Entities in MapSchema
@type({ map: NodeSchema }) nodes = new MapSchema<NodeSchema>();
this.state.nodes.set(nodeId, nodeSchema);

// ❌ Bad: Entities in ArraySchema (requires linear search)
@type([NodeSchema]) nodes = new ArraySchema<NodeSchema>();
const node = this.state.nodes.find(n => n.id === nodeId); // O(n)
```

### 6. Rate Limit Client Actions
Prevent clients from spamming updates that cause excessive state churn.

```typescript
// ✅ Good: Rate limit focus updates
this.onMessage('update_focus', (client, message: { nodeId: string }) => {
  const now = Date.now();
  const lastUpdate = this.lastFocusUpdate.get(client.sessionId) || 0;
  
  if (now - lastUpdate < 100) { // Max 10 updates/sec
    return; // Ignore spam
  }
  
  this.lastFocusUpdate.set(client.sessionId, now);
  const player = this.state.players.get(client.sessionId);
  player.focusedNodeId = message.nodeId;
});
```

## Bandwidth Math Example

**Scenario:** 500 nodes, 50 with active claims, 8 players, 1 tick/sec

**Estimated per-tick payload:**
- 50 nodes × (node ID + controlPoints) ≈ 50 × 20 bytes = 1KB
- 8 players × (focusedNodeId change) ≈ 8 × 20 bytes = 160 bytes
- currentTick + isPaused ≈ 16 bytes
- **Total: ~1.2KB/tick = 1.2KB/sec per client**

**Conclusion:** Colyseus delta encoding keeps bandwidth manageable even at scale.

## Room Architecture: When to Use Multiple Rooms

**Single room (recommended for most games):**
- One game session = one room
- All players in room see same state
- Scales to 50-100 players, 500+ entities

**Multiple rooms (spatial partitioning):**
- For true MMOs with persistent world
- Players in different regions don't need to sync

**Rule:** Use single room until you have proven need for spatial partitioning.

## Integration with PixiJS / Canvas

**Pattern: Colyseus state → rendering**

```typescript
useEffect(() => {
  gameRoom.state.nodes.onAdd((node, key) => {
    const sprite = createNodeSprite(node);
    pixiApp.stage.addChild(sprite);
  });

  gameRoom.state.nodes.onChange((node, key) => {
    updateNodeSprite(nodeSprites.get(key), node);
  });

  gameRoom.state.nodes.onRemove((node, key) => {
    removeNodeSprite(nodeSprites.get(key));
  });
}, [gameRoom]);
```

**Don't poll state in render loop** — use Colyseus callbacks (event-driven).

## Performance Bottleneck Order

For typical real-time strategy game:
1. **Rendering** — Drawing sprites (optimize with viewport culling)
2. **React re-renders** — Component updates (memoization)
3. **Colyseus sync** — Only bottlenecks at 1000+ entities

**Implication:** Focus on rendering optimization first, not network.

## Anti-Patterns

- **Always assigning** — Assigning same value triggers delta
- **Growing collections** — Never clearing ArraySchema/MapSchema
- **Polling state** — Checking state in render loop instead of callbacks
- **Premature multi-room** — Spatial partitioning before single room scales
- **No rate limiting** — Allowing clients to spam state changes

## Checklist for State Optimization

- [ ] Static data set once, never changed
- [ ] Conditional assignment (only if value differs)
- [ ] Ephemeral collections cleared each tick
- [ ] MapSchema for entities, ArraySchema for sequences
- [ ] Rate limiting on high-frequency client actions
- [ ] Colyseus callbacks (onAdd/onChange/onRemove) not polling
