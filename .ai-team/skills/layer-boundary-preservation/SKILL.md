---
name: "layer-boundary-preservation"
description: "How to maintain clean separation between simulation, networking, and UI layers"
domain: "architecture"
confidence: "medium"
source: "earned"
---

## Context

When integrating new features (like chat, notifications, or social systems) into a multi-layered application, it's critical to respect architectural boundaries. This skill applies to projects with:
- A pure simulation/game logic layer (deterministic, side-effect-free)
- A networking/server layer (handles I/O, state synchronization)
- A UI/presentation layer (renders state, handles user input)

Violating these boundaries leads to tight coupling, non-determinism leaking into pure logic, and difficulty testing or extracting components.

## Patterns

### 1. Identity Mapping Across Layers

When entities exist in multiple layers, use stable identifiers:
- **Stable ID**: Persistent entity identifier that survives reconnects/restarts (e.g., `userId`, `playerId`)
- **Ephemeral ID**: Session-specific identifier for routing (e.g., `sessionId`, `connectionId`)

**Pattern:**
```typescript
// Server layer
interface Player {
  id: string;           // ✅ Stable — used in game logic
  sessionId: string;    // ✅ Ephemeral — used for routing only
  name: string;
  color: string;
}

// Game logic references
node.ownerId = player.id;         // ✅ Stable reference
relation.player1Id = player.id;   // ✅ Stable reference

// Networking uses ephemeral ID for routing
room.clients.get(player.sessionId).send(...);  // ✅ Routing only
```

**Rationale:** Stable IDs ensure game state consistency across disconnects. Ephemeral IDs enable efficient message routing without polluting game logic.

### 2. Feature Categorization

Before implementing a feature, categorize it:
- **Pure Logic**: Deterministic computation (belongs in simulation layer)
- **I/O-Dependent**: Requires networking, file I/O, or external services (belongs in server/networking layer)
- **Presentation**: Visual rendering, user interaction (belongs in UI layer)

**Example: Chat Feature**
- Chat messages are **I/O-dependent** (player input, network broadcast)
- Therefore: Implement in networking layer, NOT simulation layer
- Chat may **read** game state (diplomacy, alliances) but NEVER modifies it

**Example: Resource Regeneration**
- Resource regen is **pure logic** (deterministic tick-by-tick calculation)
- Therefore: Implement in simulation layer
- UI displays the result, networking syncs it, but logic stays pure

### 3. One-Way Dependencies

Layers should depend in one direction only:
```
UI → Networking → Simulation
```

**Allowed:**
- UI queries networking state ✅
- Networking invokes simulation functions ✅
- UI observes simulation outputs via networking ✅

**Forbidden:**
- Simulation imports networking code ❌
- Simulation depends on I/O or external state ❌
- Networking modifies simulation internals directly ❌

**Implementation:**
```typescript
// ✅ GOOD: Networking calls simulation function
const result = processTick(world, activeClaims);
syncWorldToState(result.world, this.state);

// ❌ BAD: Simulation imports networking
import { GameRoom } from '../colyseus/GameRoom'; // in simulation file
```

### 4. Read-Only Queries Across Boundaries

Features in upper layers can **query** lower layer state but never modify it directly:

```typescript
// ✅ GOOD: Chat reads diplomacy state
if (relation.status === 'allied') {
  // Filter chat recipients to allies
}

// ❌ BAD: Chat modifies diplomacy state
relation.status = 'allied'; // in chat handler
```

**Pattern:** Use getter functions, not direct mutation:
```typescript
// Simulation layer provides read-only accessors
function getDiplomaticStatus(world: GameWorld, p1: string, p2: string): Status {
  // Pure query, no side effects
}

// Networking layer uses accessors for filtering
const isAllied = getDiplomaticStatus(world, senderId, recipientId) === 'allied';
```

### 5. Event Flow Direction

Events should flow **outward** from simulation, never inward:

```
Simulation → Events → Networking → UI
         ↓
      Pure Logic
```

**Allowed:**
- Simulation emits events as outputs ✅
- Networking broadcasts events to clients ✅
- UI displays events ✅
- Networking posts system announcements to chat based on events ✅

**Forbidden:**
- Chat messages become simulation events ❌
- UI actions directly trigger simulation events ❌
- Mixing non-deterministic inputs (chat) with deterministic outputs (game events) ❌

**Example:**
```typescript
// ✅ GOOD: Event announces in chat
onTick(result: TickResult) {
  result.events.forEach(event => {
    if (event.type === 'war_declared') {
      this.broadcast('chat_message', {
        senderId: 'system',
        text: `War declared between ${p1} and ${p2}`,
        isSystem: true,
      });
    }
  });
}

// ❌ BAD: Chat generates simulation event
onMessage('chat_message', (client, msg) => {
  const event = { type: 'chat_sent', data: msg };
  this.gameLoop.injectEvent(event); // NO!
});
```

## Examples

### Clean Chat Integration

```typescript
// server/src/colyseus/GameRoom.ts (Networking Layer)
onMessage('chat_message', (client, message: { text: string, channel?: string }) => {
  const player = this.state.players.get(client.sessionId);
  if (!player) return;
  
  // Read game state for filtering (read-only)
  const recipients = this.filterRecipients(player.id, message.channel);
  
  // Broadcast to filtered recipients
  recipients.forEach(recipientId => {
    const recipient = this.getPlayerByUserId(recipientId);
    if (recipient) {
      const recipientClient = this.clients.find(c => c.sessionId === recipient.sessionId);
      recipientClient?.send('chat_message', {
        senderId: player.id,    // ✅ Stable ID
        senderName: player.name,
        text: message.text,
        timestamp: Date.now(),
      });
    }
  });
});

// ✅ Query game state (read-only)
private filterRecipients(senderId: string, channel?: string): string[] {
  if (channel === 'alliance') {
    // Read diplomacy state, don't modify
    return this.getAlliedPlayers(senderId);
  }
  // Default: all players
  return Array.from(this.state.players.values()).map(p => p.id);
}
```

### Simulation Layer Stays Pure

```typescript
// src/game/systems/diplomacy.ts (Simulation Layer)
// ✅ Pure function, no I/O, no side effects
export function applyDiplomaticAction(
  world: GameWorld,
  request: DiplomaticRequest,
  offers: DiplomaticOffer[]
): { world: GameWorld; events: GameEvent[]; offers: DiplomaticOffer[] } {
  // Deterministic logic only
  // No networking, no chat, no I/O
}

// ❌ NEVER do this in simulation layer
import { broadcast } from '../networking/chat'; // NO!
broadcast('Alliance formed!'); // NO!
```

## Anti-Patterns

### 1. Identity Confusion
```typescript
// ❌ BAD: Using ephemeral ID in game logic
node.ownerId = client.sessionId; // Changes on reconnect!

// ✅ GOOD: Using stable ID
node.ownerId = player.id;
```

### 2. Feature Misplacement
```typescript
// ❌ BAD: I/O-dependent feature in simulation layer
// src/game/systems/chat.ts
export function sendChatMessage(world: GameWorld, msg: string) {
  fetch('/api/chat', { body: msg }); // NO! I/O in simulation!
}

// ✅ GOOD: I/O-dependent feature in networking layer
// server/src/colyseus/GameRoom.ts
onMessage('chat_message', (client, msg) => {
  this.broadcast('chat_message', msg);
});
```

### 3. Two-Way Dependencies
```typescript
// ❌ BAD: Simulation depends on networking
// src/game/world.ts
import { sendToClients } from '../server/networking'; // NO!

// ✅ GOOD: Networking depends on simulation
// server/src/colyseus/GameRoom.ts
import { processTick } from '../../game/world'; // YES!
```

### 4. Event Type Pollution
```typescript
// ❌ BAD: Non-deterministic events in simulation enum
export enum GameEventType {
  ResourceDepleted = 'resource_depleted',  // ✅ Deterministic
  ChatMessageSent = 'chat_message_sent',   // ❌ Non-deterministic
}

// ✅ GOOD: Keep event types pure
export enum GameEventType {
  ResourceDepleted = 'resource_depleted',  // Pure logic only
  NodeClaimed = 'node_claimed',            // Pure logic only
}
// Chat messages are separate networking messages, not simulation events
```

### 5. Direct State Mutation Across Layers
```typescript
// ❌ BAD: UI directly mutates simulation state
// src/components/Chat.tsx
world.diplomacy.set(key, { status: 'allied' }); // NO!

// ✅ GOOD: UI sends action, networking updates via simulation
// src/components/Chat.tsx
sendMessage('offer_alliance', { targetPlayerId });
// GameRoom receives message, calls applyDiplomaticAction(), syncs result
```

## Related Skills

- **Testing Pure Functions**: Simulation layer purity enables deterministic testing
- **Event Sourcing**: Events as outputs enable replay and debugging
- **API Design**: Clear layer boundaries define clean API contracts
