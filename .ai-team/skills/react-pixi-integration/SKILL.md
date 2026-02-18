---
name: "react-pixi-integration"
description: "Integrate PixiJS canvas rendering with React state management"
domain: "frontend-architecture"
confidence: "high"
source: "earned"
---

## Context

When building games or data visualizations in React that require high-performance 2D rendering, PixiJS (WebGL-accelerated canvas library) is often the right choice. However, integrating PixiJS with React's declarative paradigm requires careful architecture to avoid:
- Re-creating the entire scene on every state change (expensive)
- Memory leaks from improper cleanup
- Flickering or jank from uncoordinated updates
- Mixing rendering logic with component lifecycle

This pattern establishes a clean separation: React owns state and lifecycle, PixiJS owns rendering.

## Patterns

### 1. Component Structure: React Wrapper + Manager Class

**Anti-Pattern:** Put all PixiJS code directly in React component
```typescript
// ❌ BAD: Mixes concerns, hard to test, memory leaks likely
function GameCanvas() {
  const [app, setApp] = useState<PIXI.Application>();
  
  useEffect(() => {
    const a = new PIXI.Application();
    // 50 lines of sprite creation here...
    setApp(a);
  }, []);
  
  useEffect(() => {
    // Another 50 lines updating sprites...
  }, [world]);
  
  // Cleanup easy to forget
}
```

**Good Pattern:** Separate React wrapper from rendering manager
```typescript
// ✅ GOOD: Clean separation, testable, clear ownership
function GameCanvas(props: GameCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const pixiAppRef = useRef<PIXI.Application | null>(null);
  const sceneManagerRef = useRef<SceneManager | null>(null);

  // Initialize once
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const app = new PIXI.Application({ ... });
    canvasRef.current.appendChild(app.view);
    pixiAppRef.current = app;
    sceneManagerRef.current = new SceneManager(app.stage);
    
    return () => app.destroy(true, { children: true, texture: true });
  }, []);

  // Update on state changes
  useEffect(() => {
    sceneManagerRef.current?.updateWorld(props.world);
  }, [props.world]);

  return <div ref={canvasRef} />;
}

// SceneManager class handles all PixiJS logic
class SceneManager {
  constructor(stage: PIXI.Container) { ... }
  updateWorld(world: GameWorld) { ... }
}
```

**Why:** React component manages lifecycle and props, SceneManager manages sprites. Each has one responsibility. SceneManager can be unit tested without React.

---

### 2. Incremental Updates via Sprite Registry

**Anti-Pattern:** Recreate all sprites on every update
```typescript
// ❌ BAD: Destroys and recreates everything = slow, flickers
updateWorld(world: GameWorld) {
  this.container.removeChildren(); // Destroy all sprites
  
  for (const node of world.nodes) {
    const sprite = new NodeSprite(node); // Create new sprite
    this.container.addChild(sprite);
  }
}
```

**Good Pattern:** Maintain a registry and update existing sprites
```typescript
// ✅ GOOD: Reuses sprites, only updates changed properties
class SceneManager {
  private spriteRegistry: Map<EntityId, NodeSprite> = new Map();
  
  updateWorld(world: GameWorld) {
    const nodeIds = Object.keys(world.nodes);
    
    // Update or create sprites
    for (const nodeId of nodeIds) {
      const node = world.nodes[nodeId];
      const existing = this.spriteRegistry.get(nodeId);
      
      if (existing) {
        existing.update(node); // Just update properties
      } else {
        const sprite = new NodeSprite(node);
        this.spriteRegistry.set(nodeId, sprite);
        this.container.addChild(sprite);
      }
    }
    
    // Remove deleted entities
    for (const [nodeId, sprite] of this.spriteRegistry) {
      if (!world.nodes[nodeId]) {
        this.container.removeChild(sprite);
        sprite.destroy();
        this.spriteRegistry.delete(nodeId);
      }
    }
  }
}
```

**Why:** PixiJS sprites are stateful objects. Reusing them is 10-100x faster than recreating. Only changed sprites get updated.

---

### 3. Layered Container Hierarchy

**Anti-Pattern:** Flat scene graph, manual z-order management
```typescript
// ❌ BAD: Hard to control z-order, can't toggle layer visibility
stage.addChild(background);
stage.addChild(node1);
stage.addChild(connection1);
stage.addChild(node2); // Oops, connection should be behind all nodes
```

**Good Pattern:** Separate containers for each logical layer
```typescript
// ✅ GOOD: Predictable z-order, easy to toggle/update layers
class SceneManager {
  private backgroundLayer: PIXI.Container;
  private connectionsLayer: PIXI.Container;
  private nodesLayer: PIXI.Container;
  private overlayLayer: PIXI.Container;
  
  constructor(stage: PIXI.Container) {
    this.backgroundLayer = new PIXI.Container();
    this.connectionsLayer = new PIXI.Container();
    this.nodesLayer = new PIXI.Container();
    this.overlayLayer = new PIXI.Container();
    
    // Add in z-order (bottom to top)
    stage.addChild(this.backgroundLayer);
    stage.addChild(this.connectionsLayer);
    stage.addChild(this.nodesLayer);
    stage.addChild(this.overlayLayer);
  }
  
  updateNodes(nodes) {
    // All nodes added to nodesLayer, guaranteed to be above connections
    this.nodesLayer.addChild(nodeSprite);
  }
  
  toggleConnections(visible: boolean) {
    this.connectionsLayer.visible = visible; // Toggle entire layer
  }
}
```

**Why:** Layers provide z-order guarantees, enable bulk operations (hide all connections), and improve culling performance.

---

### 4. Event Flow: PixiJS → React Callbacks

**Anti-Pattern:** Store UI state in PixiJS, try to sync back to React
```typescript
// ❌ BAD: PixiJS now has state, React doesn't know about it
class NodeSprite {
  private isSelected = false;
  
  onClick() {
    this.isSelected = !this.isSelected;
    this.updateVisuals(); // React doesn't know selection changed!
  }
}
```

**Good Pattern:** PixiJS fires events, React handles state, props flow back down
```typescript
// ✅ GOOD: React is source of truth for all state
class NodeSprite {
  constructor(node: Node, onClickCallback: (id: EntityId) => void) {
    this.sprite.interactive = true;
    this.sprite.on('pointerdown', () => onClickCallback(node.id));
  }
  
  // Receives selection state from React
  setSelected(selected: boolean) {
    this.sprite.alpha = selected ? 1.0 : 0.7;
  }
}

// React component
function GameCanvas({ selectedNodeId, onNodeClick }) {
  useEffect(() => {
    sceneManager.setOnNodeClick((nodeId) => onNodeClick(nodeId));
  }, [onNodeClick]);
  
  useEffect(() => {
    sceneManager.updateSelection(selectedNodeId);
  }, [selectedNodeId]);
}
```

**Flow:**
1. User clicks sprite → PixiJS pointer event fires
2. SceneManager calls React callback: `onNodeClick(nodeId)`
3. React updates state: `setSelectedNodeId(nodeId)`
4. React re-renders, passes new prop: `selectedNodeId={nodeId}`
5. useEffect triggers: `sceneManager.updateSelection(nodeId)`
6. SceneManager updates sprite visuals

**Why:** React remains single source of truth. PixiJS is a view layer that responds to state changes, just like any other React child.

---

### 5. Cleanup and Memory Management

**Anti-Pattern:** Forget to destroy PixiJS resources
```typescript
// ❌ BAD: Memory leak, canvas stays in DOM
useEffect(() => {
  const app = new PIXI.Application();
  canvasRef.current.appendChild(app.view);
  // No cleanup!
}, []);
```

**Good Pattern:** Comprehensive cleanup in useEffect return
```typescript
// ✅ GOOD: Cleans up all PixiJS resources
useEffect(() => {
  if (!canvasRef.current) return;
  
  const app = new PIXI.Application({ ... });
  canvasRef.current.appendChild(app.view);
  const sceneManager = new SceneManager(app.stage);
  
  return () => {
    // Cleanup in correct order
    sceneManager.destroy(); // Destroy sprites first
    app.destroy(true, {
      children: true,    // Destroy all children
      texture: true,     // Destroy textures
      baseTexture: true, // Destroy base textures
    });
  };
}, []);
```

**Also destroy sprites when entities are removed:**
```typescript
removeNode(nodeId: EntityId) {
  const sprite = this.spriteRegistry.get(nodeId);
  if (sprite) {
    this.container.removeChild(sprite);
    sprite.destroy({ children: true }); // Free GPU memory
    this.spriteRegistry.delete(nodeId);
  }
}
```

**Why:** PixiJS manages WebGL resources (textures, buffers). Forgetting cleanup causes memory leaks and poor performance over time.

---

### 6. Pan/Zoom with pixi-viewport

**Anti-Pattern:** Implement pan/zoom manually with mouse events
```typescript
// ❌ BAD: Hundreds of lines of complex transform math, touch edge cases
let isDragging = false;
let dragStart = { x: 0, y: 0 };
stage.on('mousedown', (e) => { /* manual drag logic */ });
stage.on('mousemove', (e) => { /* manual transform */ });
stage.on('wheel', (e) => { /* manual zoom */ });
// + pinch zoom, momentum, boundaries, etc...
```

**Good Pattern:** Use pixi-viewport library
```typescript
// ✅ GOOD: Battle-tested library, 10 lines instead of 500
import { Viewport } from 'pixi-viewport';

const viewport = new Viewport({
  screenWidth: window.innerWidth,
  screenHeight: window.innerHeight,
  worldWidth: 5000,
  worldHeight: 5000,
  interaction: app.renderer.plugins.interaction,
});

viewport
  .drag()           // Mouse drag to pan
  .pinch()          // Touch pinch to zoom
  .wheel()          // Mouse wheel to zoom
  .decelerate()     // Momentum after drag
  .clamp({ direction: 'all' }); // Prevent panning outside world

stage.addChild(viewport);
viewport.addChild(gameLayer); // Add game content to viewport
```

**Why:** Pan/zoom is complex (touch gestures, momentum, boundaries, performance). pixi-viewport handles all edge cases and is well-maintained.

---

## Anti-Patterns Summary

❌ **Don't:** Mix PixiJS rendering code into React components
✅ **Do:** Separate into React wrapper + Manager class

❌ **Don't:** Recreate all sprites on every update
✅ **Do:** Maintain sprite registry and update incrementally

❌ **Don't:** Use flat scene graph with manual z-order
✅ **Do:** Use layered containers

❌ **Don't:** Store state in PixiJS, sync back to React
✅ **Do:** React owns state, PixiJS receives updates via props

❌ **Don't:** Forget to destroy PixiJS resources
✅ **Do:** Clean up in useEffect return function

❌ **Don't:** Implement pan/zoom from scratch
✅ **Do:** Use pixi-viewport library

---

## Example File Structure

```
src/components/GameCanvas/
├── GameCanvas.tsx              # React wrapper component
├── GameCanvas.module.css       # Styling
├── SceneManager.ts             # PixiJS rendering manager
├── sprites/
│   ├── NodeSprite.ts           # Individual entity sprite class
│   └── ConnectionRenderer.ts   # Connection line rendering
└── __tests__/
    ├── GameCanvas.test.tsx     # React integration tests
    └── SceneManager.test.ts    # SceneManager unit tests
```

---

## When This Skill Applies

Use this pattern when:
- Building games or data visualizations with React
- Need high-performance 2D rendering (100+ interactive elements)
- Canvas elements need to respond to React state changes
- Integrating PixiJS, Phaser, Three.js, or similar rendering libraries

Skip this pattern when:
- Simple charts/graphs (use SVG or chart library)
- Few elements (<20) that don't update frequently (React can handle it)
- Building a standalone game without React

---

## Additional Patterns from Grand Strategy Canvas Architecture

### 7. RequestAnimationFrame Throttling for State Updates

**Problem:** Game state may update multiple times per second (every game tick), but React re-renders + PixiJS updates should align with browser refresh rate (60fps).

**Pattern:**
```typescript
// ✅ GOOD: RAF throttling prevents wasted PixiJS work
function PixiCanvas(props: PixiCanvasProps) {
  const rafRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    
    rafRef.current = requestAnimationFrame(() => {
      rendererRef.current?.update(props);
    });
    
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [props]);
}
```

**Why:** Batches multiple state updates into a single render frame. Prevents wasted GPU work when state updates faster than 60fps.

---

### 8. Camera State Management Options

**Option A: React-Controlled Camera (Simpler, survives remount)**
```typescript
// Camera state lives in React
const [cameraPos, setCameraPos] = useState({ x: 0, y: 0 });
const [cameraZoom, setCameraZoom] = useState(1.0);

<PixiCanvas
  cameraPosition={cameraPos}
  cameraZoom={cameraZoom}
  onCameraChange={(pos, zoom) => {
    setCameraPos(pos);
    setCameraZoom(zoom);
  }}
/>

// PixiJS syncs camera from props
class PixiRenderer {
  update(state: RenderState) {
    if (state.cameraPosition) {
      this.viewport.moveCenter(state.cameraPosition.x, state.cameraPosition.y);
    }
    if (state.cameraZoom) {
      this.viewport.setZoom(state.cameraZoom);
    }
  }
}
```

**Option B: PixiJS-Controlled Camera (Better performance, no React re-renders on pan/zoom)**
```typescript
// Camera state lives entirely in PixiJS
// React calls imperative API when needed
const canvasRef = useRef<PixiCanvasHandle>(null);

const handleNodeSelected = (nodeId: string) => {
  setSelectedNodeId(nodeId);
  canvasRef.current?.focusOnNode(nodeId); // Imperative call
};

// PixiJS imperative API
useImperativeHandle(ref, () => ({
  focusOnNode: (nodeId) => rendererRef.current?.focusOnNode(nodeId),
  panTo: (x, y) => rendererRef.current?.panTo(x, y),
}));
```

**Trade-off:**
- Option A: Simpler, camera state survives PixiJS remount, easier debugging
- Option B: Better performance (no React re-renders on every pan/zoom), smoother UX

**Recommendation:** Start with Option A, migrate to Option B if profiling shows performance issues.

---

### 9. Performance Optimization Strategies

**Culling for Large Scenes (100+ objects):**
```typescript
// Built-in with pixi-viewport
const viewport = new Viewport({ ... });
viewport.cull(); // Automatically skip rendering off-screen objects

// Or manual culling
update(state: RenderState) {
  const viewBounds = this.viewport.getVisibleBounds();
  
  for (const [nodeId, sprite] of this.nodeSprites) {
    sprite.visible = viewBounds.contains(sprite.x, sprite.y);
  }
}
```

**LOD (Level of Detail) by Zoom Level:**
```typescript
const zoom = this.viewport.scaled;

if (zoom < 0.5) {
  // Far zoom: Hide labels, simplify visuals
  this.labelsLayer.visible = false;
  this.connectionsLayer.alpha = 0.3;
} else if (zoom < 1.0) {
  // Medium zoom: Show labels, normal connections
  this.labelsLayer.visible = true;
  this.connectionsLayer.alpha = 0.7;
} else {
  // Close zoom: Full detail
  this.labelsLayer.visible = true;
  this.connectionsLayer.alpha = 1.0;
}
```

**Texture Atlases for Many Similar Objects:**
```typescript
// Pack icons/sprites into single texture
const atlas = await PIXI.Assets.load('sprites/atlas.json');

// Use sprites from atlas (batched draw calls)
const sprite = new PIXI.Sprite(atlas.textures['node-icon']);
```

**Why:** At scale (500+ nodes), culling, LOD, and atlases are essential. Without them, FPS drops below 30.

---

### 10. Diplomatic Visual Indicators Pattern

**Problem:** Need to show alliance/enemy status on nodes without visual clutter.

**Pattern:**
```typescript
class NodeSprite {
  updateDiplomaticStatus(
    nodeOwnerId: string | null,
    currentPlayerId: string | null,
    relations: DiplomaticRelation[]
  ): void {
    if (!nodeOwnerId || !currentPlayerId) {
      this.sprite.tint = 0xffffff; // No tint
      return;
    }
    
    const relation = relations.find(
      r => (r.player1Id === currentPlayerId && r.player2Id === nodeOwnerId) ||
           (r.player2Id === currentPlayerId && r.player1Id === nodeOwnerId)
    );
    
    if (!relation) {
      this.sprite.tint = 0xffffff; // Neutral
    } else if (relation.status === 'allied') {
      this.sprite.tint = 0x88ff88; // Green tint (30% strength)
    } else if (relation.status === 'war') {
      this.sprite.tint = 0xff8888; // Red tint (30% strength)
    }
  }
}
```

**Why:** Subtle tints (30% strength) provide visual feedback without overwhelming the base colors. Can be toggled off via UI for players who find it distracting.

---

## Related Skills

- Component lifecycle management
- WebGL performance optimization
- Canvas accessibility patterns
- State management with external libraries
- **layer-boundary-preservation**: Architectural separation between rendering and game logic
- **colyseus-state-optimization**: Efficient state sync patterns for multiplayer

---

## Implementation Notes

### PixiJS v8 + pixi-viewport v5 Type Compatibility

**Issue:** pixi-viewport v5 types are not fully compatible with pixi.js v8 due to API changes in PixiJS between v7 and v8.

**Symptoms:**
```typescript
// TypeScript error with pixi-viewport v5 + pixi.js v8
const viewport = new Viewport({
  events: app.renderer.events, // ❌ Property 'events' does not exist
});

app.stage.addChild(viewport); // ❌ Type 'Viewport' is not assignable
viewport.addChild(container); // ❌ Type 'Container' is not assignable
```

**Solution:** Use type assertions for Viewport integration
```typescript
// ✅ Works correctly at runtime, types will align in next pixi-viewport release
const viewport = new Viewport({
  screenWidth: app.screen.width,
  screenHeight: app.screen.height,
  worldWidth: 2000,
  worldHeight: 2000,
} as any); // Type compatibility workaround

app.stage.addChild(viewport as any);
viewport.addChild(container as any);
```

**Why this is safe:**
- pixi-viewport v5 functionally works with pixi.js v8 (tested in production)
- Type mismatches are due to TypeScript definitions lagging behind implementation
- Next pixi-viewport release will update types for v8 compatibility
- Runtime behavior is correct, only types are misaligned

**When to revisit:** Check pixi-viewport releases for v8 type support, then remove `as any` assertions.

---

### React useEffect Dependencies for PixiJS Integration

**Pattern:** Separate initialization from state sync
```typescript
// ✅ GOOD: Clear separation of concerns
function GameCanvas({ world, players, selectedNodeId, onNodeClick }) {
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize once (no dependencies except mount)
  useEffect(() => {
    if (!canvasRef.current || appRef.current) return;
    
    const app = new PIXI.Application();
    // ... setup code ...
    setIsInitialized(true);
    
    return () => cleanup();
  }, []); // Empty deps = run once on mount

  // Sync world state (only after initialization)
  useEffect(() => {
    if (!sceneManagerRef.current || !isInitialized) return;
    sceneManagerRef.current.updateWorld(world, players);
  }, [world, players, isInitialized]);

  // Sync selection (only after initialization)
  useEffect(() => {
    if (!sceneManagerRef.current || !isInitialized) return;
    sceneManagerRef.current.setSelectedNode(selectedNodeId);
  }, [selectedNodeId, isInitialized]);
}
```

**Why:**
- Initialization useEffect has empty deps to run once
- State sync useEffects wait for `isInitialized` flag
- Prevents trying to update PixiJS before Application is ready
- Guards prevent null reference errors during mount/unmount

---

### Async PixiJS Application Initialization

**Issue:** PixiJS v8 changed Application constructor to async (returns Promise)

**Old Pattern (v7):**
```typescript
// ❌ Doesn't work in PixiJS v8
const app = new PIXI.Application({ width: 800, height: 600 });
canvasRef.current.appendChild(app.view);
```

**New Pattern (v8):**
```typescript
// ✅ Required in PixiJS v8
const app = new PIXI.Application();
await app.init({
  width: 800,
  height: 600,
  backgroundColor: 0x0a0e17,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
});
canvasRef.current.appendChild(app.canvas); // Note: 'canvas' not 'view'
```

**In React useEffect:**
```typescript
useEffect(() => {
  if (!canvasRef.current || appRef.current) return;

  const initPixi = async () => {
    const app = new PIXI.Application();
    await app.init({ ... }); // Await initialization
    
    canvasRef.current!.appendChild(app.canvas); // v8: app.canvas, not app.view
    appRef.current = app;
    
    const sceneManager = new SceneManager(app);
    sceneManagerRef.current = sceneManager;
    setIsInitialized(true);
  };

  initPixi();

  return () => {
    // Cleanup
  };
}, []);
```

**Key Changes:**
- Application construction is now async (must `await app.init()`)
- Canvas element accessed via `app.canvas` instead of `app.view`
- Use async IIFE inside useEffect to handle Promise
- Set initialized flag after await completes

---

## Confidence Update

**Previous:** medium (design patterns documented)
**Current:** high (production implementation validated, edge cases documented)

Updated based on successful Phase 1 implementation with pixi.js v8, all tests passing, build successful.
