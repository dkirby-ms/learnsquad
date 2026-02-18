---
name: "deterministic-rendering-pattern"
description: "How to separate tick-synchronized game state from client-side visual interpolation"
domain: "game-systems"
confidence: "low"
source: "earned"
---

## Context

In real-time multiplayer games with deterministic simulation, the rendering layer must clearly distinguish between:
1. **Authoritative State** — tick-synchronized data that affects gameplay (must be consistent across all clients)
2. **Visual State** — client-side interpolation and effects (can vary per client for smoothness)

This pattern is critical for:
- Multiplayer consistency (all players see the same game state)
- Deterministic replay/recording
- Smooth client-side animation without network jitter
- Performance optimization (interpolate locally instead of broadcasting high-frequency updates)

## Patterns

### 1. State Classification

Before implementing any visual feature, classify what drives it:

**Tick-Synchronized (Authoritative)**
- Node ownership
- Resource amounts
- Control points (territory claiming progress)
- Connection active/inactive state
- Diplomatic relations
- Discovery state (fog of war)
- Unit positions **on nodes** (discrete location)

**Client-Side Interpolation (Non-Authoritative)**
- Smooth animations between ticks
- Particle effects (explosions, resource gathering)
- Camera position and zoom
- UI hover/selection highlights
- Loading/transition effects
- Unit positions **between nodes** (visual interpolation along path)

**Rule of Thumb:** If a visual state affects gameplay decisions, it MUST be authoritative. If it's purely aesthetic, it CAN be client-side.

### 2. Event-Driven Visual Updates

Never poll game state. Always react to events.

**Pattern:**
```typescript
// ❌ BAD: Polling game state every frame
function render() {
  const node = world.getNode('node_1');
  updateVisual(node.ownerId); // Re-renders even if nothing changed
}

// ✅ GOOD: Event-driven updates
gameLoop.subscribe('tick', (result: TickResult) => {
  result.events.forEach(event => {
    switch (event.type) {
      case 'node_claimed':
        updateNodeVisual(event.payload.nodeId);
        break;
      case 'resource_produced':
        playProductionEffect(event.payload.nodeId, event.payload.amount);
        break;
    }
  });
});
```

**Rationale:** Event-driven updates are efficient (only update what changed), predictable (deterministic event order), and testable (replay events for debugging).

### 3. Interpolation Between Ticks

For smooth animation, interpolate visual state between tick updates.

**Pattern:**
```typescript
// Track tick-synchronized positions
interface UnitState {
  currentNodeId: EntityId;    // ✅ Authoritative (from server)
  destinationNodeId?: EntityId; // ✅ Authoritative
  arrivalTick: Tick;           // ✅ Authoritative
}

// Track client-side visual state
interface UnitVisual {
  visualPosition: Vector2;     // ❌ Client-only (interpolated)
  
  update(deltaTime: number, currentTick: Tick, tickProgress: number) {
    // Interpolate between current and destination node
    const fromPos = getNodePosition(this.state.currentNodeId);
    const toPos = getNodePosition(this.state.destinationNodeId);
    this.visualPosition = lerp(fromPos, toPos, tickProgress);
  }
}
```

**Key Insight:** The simulation layer emits discrete tick updates (e.g., "unit moved from A to B at tick 100"). The rendering layer interpolates smoothly between those positions at 60fps.

### 4. Tick Progress Tracking

Expose tick progress for interpolation calculations.

**Pattern:**
```typescript
// In game state store or hook
export function useTickProgress(): number {
  const currentTick = useStore(state => state.time.currentTick);
  const lastTickTime = useStore(state => state.time.lastTickTime);
  const tickDuration = useStore(state => state.time.baseTickDuration / state.time.speed);
  
  // Calculate how far we are between ticks (0 = just ticked, 1 = about to tick)
  const elapsed = Date.now() - lastTickTime;
  return Math.min(elapsed / tickDuration, 1.0);
}

// In rendering loop
function renderLoop(deltaTime: number) {
  const tickProgress = getTickProgress();
  
  // Use tickProgress to interpolate visual state
  units.forEach(unit => {
    unit.updateVisualPosition(tickProgress);
  });
}
```

### 5. Visual State Hooks

Provide hooks for rendering layer to access authoritative state.

**Pattern:**
```typescript
// ✅ GOOD: Separate hooks for rendering layer
export function useNodesForVisualization() {
  return useStore(state => ({
    nodes: state.world.nodes,
    tick: state.time.currentTick, // Include tick for debugging/sync
  }));
}

export function useConnectionsForVisualization() {
  return useStore(state => ({
    connections: state.world.connections,
    tick: state.time.currentTick,
  }));
}

// ❌ BAD: Exposing entire game state
export function useGameState() {
  return useStore(state => state); // Too broad, unclear what's needed
}
```

**Rationale:** Specific hooks communicate intent, enable performance optimization (only re-render when relevant state changes), and document what data the rendering layer needs.

### 6. Level-of-Detail (LOD) System

Client-side rendering can adjust detail based on zoom/performance without affecting simulation.

**Pattern:**
```typescript
enum ZoomLevel {
  Strategic,   // Zoom out: Node colors only, no labels
  Operational, // Medium: Show resources, basic info
  Tactical,    // Zoom in: Full detail, animations
}

interface LODConfig {
  showNodeLabels: boolean;      // ❌ Client-only
  showResourceBars: boolean;    // ❌ Client-only
  enableParticleEffects: boolean; // ❌ Client-only
  maxVisibleNodes: number;      // ❌ Client-only (culling)
}

function updateLOD(zoomLevel: ZoomLevel) {
  // Adjust rendering detail without touching simulation
  switch (zoomLevel) {
    case ZoomLevel.Strategic:
      config.showNodeLabels = false;
      config.enableParticleEffects = false;
      break;
    case ZoomLevel.Tactical:
      config.showNodeLabels = true;
      config.enableParticleEffects = true;
      break;
  }
}
```

**Key Insight:** LOD is a rendering optimization, not a simulation concern. All clients see the same game state, but can render it differently based on zoom/device performance.

### 7. Discovery State (Fog of War)

Discovery state is authoritative, but rendering is client-side.

**Pattern:**
```typescript
// ✅ Authoritative (simulation layer)
interface DiscoveryState {
  discoveredNodes: Set<EntityId>;      // ✅ Server-synced
  discoveredConnections: Set<EntityId>; // ✅ Server-synced
  discoveryTick: Map<EntityId, Tick>;  // ✅ For replay
}

// ❌ Client-only (rendering layer)
function renderNodeWithFog(node: Node, discovery: DiscoveryState) {
  const isDiscovered = discovery.discoveredNodes.has(node.id);
  
  if (!isDiscovered) {
    node.visible = false; // Completely hidden
  } else {
    node.visible = true;
    node.alpha = 0.5; // Dimmed (last-known state)
    // Client decides opacity/animation, but visibility is authoritative
  }
}
```

**Rationale:** Whether a node is discovered is authoritative (affects gameplay). How it's rendered (opacity, animation) is client-side.

## Examples

### Complete Rendering Integration

```typescript
// Simulation layer emits events
function processTick(state: GameLoopState): TickResult {
  // ... process game logic
  return {
    tick: state.currentTick,
    events: [
      { type: 'node_claimed', payload: { nodeId: 'n1', ownerId: 'p1' } },
      { type: 'resource_produced', payload: { nodeId: 'n1', amount: 10 } },
    ],
  };
}

// Rendering layer subscribes to events
function setupRenderer(gameLoop: GameLoop, pixiApp: PIXI.Application) {
  // Listen for tick events
  gameLoop.subscribe('tick', (result: TickResult) => {
    // Batch visual updates
    const nodesToUpdate = new Set<EntityId>();
    
    result.events.forEach(event => {
      if (event.type === 'node_claimed') {
        nodesToUpdate.add(event.payload.nodeId);
      }
    });
    
    // Apply updates in one render pass
    updateNodeVisuals(Array.from(nodesToUpdate));
  });
}

// Visual update function
function updateNodeVisuals(nodeIds: EntityId[]) {
  nodeIds.forEach(nodeId => {
    const node = world.nodes.get(nodeId);
    const visual = nodeVisuals.get(nodeId);
    
    // Update authoritative visual state
    visual.fillColor = getPlayerColor(node.ownerId);
    visual.borderWidth = node.status === 'contested' ? 3 : 1;
    
    // Trigger client-side effects
    if (node.status === 'claimed') {
      playClaimEffect(visual.position); // Non-authoritative particle effect
    }
  });
}
```

### Resource Display with Interpolation

```typescript
// Authoritative state (simulation)
interface ResourceState {
  amount: number;      // ✅ Tick-synchronized
  regenRate: number;   // ✅ Tick-synchronized
  maxCapacity: number; // ✅ Tick-synchronized
}

// Client-side visual (rendering)
class ResourceDisplay {
  private state: ResourceState;
  private visualAmount: number; // ❌ Interpolated
  
  update(deltaTime: number) {
    // Smooth interpolation toward authoritative amount
    this.visualAmount = lerp(
      this.visualAmount,
      this.state.amount,
      deltaTime * 5.0 // Interpolation speed
    );
    
    // Render interpolated value
    this.barFillPercent = this.visualAmount / this.state.maxCapacity;
  }
  
  onResourceProduced(event: GameEvent) {
    // Update authoritative state
    this.state.amount = event.payload.newAmount;
    
    // Play client-side effect
    this.playProductionParticles(event.payload.delta);
  }
}
```

## Anti-Patterns

### 1. Polling Game State Every Frame

```typescript
// ❌ BAD: Checking state every frame
function render() {
  nodes.forEach(node => {
    const gameNode = world.getNode(node.id);
    if (node.visualOwnerId !== gameNode.ownerId) {
      node.visualOwnerId = gameNode.ownerId; // Inefficient, hard to debug
    }
  });
}

// ✅ GOOD: Event-driven updates
gameLoop.subscribe('tick', (result) => {
  result.events
    .filter(e => e.type === 'node_claimed')
    .forEach(e => updateNodeOwner(e.payload.nodeId));
});
```

### 2. Mixing Authoritative and Non-Authoritative State

```typescript
// ❌ BAD: Storing client-side state in game model
interface Node {
  id: EntityId;
  ownerId: EntityId;    // ✅ Authoritative
  isHovered: boolean;   // ❌ Non-authoritative, doesn't belong here
  zoomLevel: number;    // ❌ Non-authoritative, doesn't belong here
}

// ✅ GOOD: Separate visual state
interface NodeGameState {
  id: EntityId;
  ownerId: EntityId; // ✅ Only authoritative data
}

interface NodeVisualState {
  isHovered: boolean;  // ❌ Client-only
  zoomLevel: number;   // ❌ Client-only
}
```

### 3. Broadcasting High-Frequency Non-Deterministic State

```typescript
// ❌ BAD: Broadcasting camera position to server
function onCameraMoved(position: Vector2) {
  socket.send('camera_moved', position); // Wastes bandwidth, not needed
}

// ✅ GOOD: Keep camera state local
function onCameraMoved(position: Vector2) {
  localCameraState.position = position; // Client-only, no sync needed
}
```

### 4. Treating Visual Events as Game Events

```typescript
// ❌ BAD: Emitting hover as game event
enum GameEventType {
  NodeClaimed = 'node_claimed',     // ✅ Authoritative
  NodeHovered = 'node_hovered',     // ❌ Non-authoritative, doesn't belong
}

// ✅ GOOD: Separate event systems
enum GameEventType {
  NodeClaimed = 'node_claimed',     // ✅ Only simulation events
}

enum UIEventType {
  NodeHovered = 'node_hovered',     // ❌ UI-only events
  TooltipShown = 'tooltip_shown',   // ❌ UI-only events
}
```

## Related Skills

- **layer-boundary-preservation**: Ensures rendering doesn't leak into simulation layer
- **event-sourcing**: Event-driven updates enable replay and debugging
- **performance-optimization**: Separating authoritative from interpolated state enables efficient rendering

## When to Apply

- ✅ Real-time multiplayer games with tick-based simulation
- ✅ Deterministic simulations requiring replay/recording
- ✅ Games with smooth client-side animation between discrete state updates
- ✅ High-latency scenarios where visual interpolation hides network delay
- ❌ Single-player games with no replay requirements (simpler to couple rendering and logic)
- ❌ Turn-based games with no time interpolation (no need for this pattern)
