# History — holden

## Learnings

### PixiJS Canvas Architecture for Grand Strategy Game

**File Locations:**
- Game state store: `src/store/gameState.ts` - manages GameWorld, Player[], DiplomaticRelation[], ChatMessage[]
- Game types: `src/game/types.ts` - pure data structures for Node, Connection, GameWorld, GameEvent
- React hooks: `src/hooks/useGameState.ts` (state subscriptions), `src/hooks/useGameSocket.ts` (Colyseus connection)
- GameWorld component: `src/components/GameWorld/GameWorld.tsx` - orchestrates game UI
- Layer boundary skill: `.ai-team/skills/layer-boundary-preservation/SKILL.md` - architectural patterns for separation

**Architectural Patterns Established:**
- One-way data flow: Colyseus → gameStateStore → React hooks → Props → PixiJS renderer
- Layer separation: React UI (controls/overlays) | PixiJS Integration (lifecycle bridge) | PixiJS Renderer (imperative scene graph) | Game State (read-only subscriptions)
- Object pooling pattern: Reconcile state diffs instead of recreating PixiJS objects (critical for 500+ nodes)
- Interaction event flow: PixiJS click detection → callback → React handler → useGameSocket action → Colyseus message
- Camera management options: React-controlled (simpler, survives remount) vs. PixiJS-controlled (better performance, no React re-renders on pan/zoom)

**Performance Strategy:**
- pixi-viewport library for pan/zoom/culling instead of custom implementation
- Culling for off-screen objects (mandatory for 100+ nodes)
- Object pooling via Map<EntityId, Sprite> to avoid create/destroy overhead
- LOD (level of detail) based on zoom level - hide labels/resources when zoomed out
- RequestAnimationFrame throttling for state updates to avoid React churn

**Integration Decisions:**
- PixiCanvas as separate component (not inline in GameWorld) - isolates PixiJS lifecycle, makes rendering swappable
- PixiRenderer as class (not React component) - imperative rendering doesn't fit React's declarative model
- No direct PixiJS → gameStateStore subscription - preserves React's one-way data flow, improves debuggability
- Event callbacks flow UP (PixiJS → React → Colyseus), state flows DOWN (Colyseus → React → PixiJS)

**Forbidden Patterns (architectural boundaries):**
- PixiJS importing game simulation code (src/game/) - violates one-way dependency
- Game simulation importing PixiJS - rendering is UI layer concern
- PixiJS mutating game state - renderer is read-only observer
- PixiJS sending Colyseus messages - goes through React → useGameSocket hook

**Visual Design Specs:**
- Nodes: Circles (30px radius), player color tint, control point progress ring, resource icons at cardinal directions
- Connections: Lines with color by type (Direct=gray, Gateway=blue), animated particles for gateways
- Diplomacy indicators: Tint overlays (green for allies, red for enemies) at 30% strength to avoid clutter
- Selection/hover: Outer glow, scale increase, pulsing animation

**Dependencies:**
- PixiJS v8.0.0 (WebGPU support, future-proof)
- pixi-viewport v5.0.2 (battle-tested pan/zoom/culling)

**Key Trade-offs:**
- React-controlled camera (MVP): Simpler, survives remount, easier debugging | vs. PixiJS-controlled: Better performance, no re-renders on pan/zoom
- Object pooling: Complex reconciliation logic | vs. Recreating: Expensive GPU uploads at scale
- pixi-viewport: External dependency | vs. Custom: More code to maintain, edge cases

**Files to Create (implementation phase):**
- `src/components/PixiCanvas/PixiCanvas.tsx` - React integration layer
- `src/components/PixiCanvas/PixiRenderer.ts` - Core rendering class
- `src/components/PixiCanvas/sprites/NodeSprite.ts` - Node visual representation
- `src/components/PixiCanvas/sprites/ConnectionGraphic.ts` - Connection visual representation



📌 Team update (2026-02-17): PixiJS Canvas Architecture consolidated from individual designs. Naomi's React/PixiJS integration pattern selected as canonical reference. Team decisions recorded in decisions.md. — decided by Holden, Naomi, Amos, Miller
