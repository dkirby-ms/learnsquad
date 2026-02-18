# Project Context

- **Owner:** dkirby-ms (saitcho@outlook.com)
- **Project:** MMOG grand strategy browser game with pausable real-time mechanics (Paradox-style)
- **Stack:** React, TypeScript, PixiJS, Colyseus, Node.js, Express, PostgreSQL, Redis
- **Created:** 2025-07-12

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

📌 "The Twist": Simulation layer architected as separable module for potential Rust/Go extraction
📌 Real-time: Pausable like Paradox games — game time can be paused/unpaused by players
📌 My domain: Tick processing, game rules, simulation — Amos handles network infrastructure

📌 Game simulation module lives in `src/game/`
📌 Core types: `GameWorld`, `Node`, `Resource`, `Connection` in `src/game/types.ts`
📌 All model functions are pure — take state, return new state, no mutations
📌 `processTick()` is the atomic simulation step — deterministic, side-effect-free
📌 `GameLoop` class wraps pure functions for stateful tick scheduling
📌 Time is measured in ticks, never wall-clock — base rate configurable in GameLoop constructor
📌 Events emitted via `TickResult.events` — listeners subscribe via `GameLoop.subscribe()`
📌 Naming: world functions use `addWorldConnection` to avoid collision with `addConnection` for nodes

📌 Resource system lives in `src/game/systems/resources.ts` — the "systems" folder is for game mechanics
📌 Producer/Consumer types define production and consumption rates; stored separately from Node
📌 `processNodeResources()` is the main entry point for resource tick processing
📌 Resource events: `ResourceDepleted`, `ResourceCapReached`, `ResourceProduced`
📌 `tickNode()` now accepts optional producers/consumers arrays — backward-compatible signature

📌 Connectivity system lives in `src/game/systems/connectivity.ts` — handles traversal, pathfinding, discovery
📌 `canTraverse()` and `getTraversalCost()` are pure functions for evaluating connection traversability
📌 Gateway type extends Connection with activation cost, cooldown mechanics, and activation time
📌 `activateGateway()` deducts resources from node and marks gateway as cooling down
📌 `findPath()` uses A* algorithm with Manhattan distance heuristic — returns Path or null
📌 CostFunction type allows custom pathfinding cost calculations (distance, resources, time)
📌 `getNeighbors()` returns directly connected nodes; `getReachableNodes()` uses Dijkstra for cost-limited graph traversal
📌 TraversalContext carries traverser ID, current tick, and available resources for permission/cost checks
📌 Gateway events: `GatewayActivated`, `GatewayReady` (cooldown complete)

📌 Event system lives in `src/game/systems/events.ts` — queue processing and history management
📌 Handler registry lives in `src/game/systems/handlers.ts` — extensible pattern for event handling
📌 `processEventQueue()` processes events FIFO with depth tracking to prevent infinite loops
📌 Event handlers are pure functions: `(world, event) => { world, events[] }` — chain reactions supported
📌 `EventHistory` tracks recent events for replay/debugging; configurable depth (default 100)
📌 Event types organized by category: Resource, Node, Connection, Gateway, System
📌 New event types added: `NodeDiscovered`, `ConnectionEstablished`, `ConnectionSevered`, `GatewayCooldownExpired`
📌 `DEFAULT_EVENT_CONFIG`: maxEventDepth=10, maxEventsPerTick=1000 (circuit breakers)
📌 `processTick()` now integrates event queue processing — handlers run after tick calculations
📌 GameLoop constructor accepts optional EventConfig for customizing event processing limits

## Team Updates

📌 Team update (2026-02-16): Event system architecture with handler registry completed — decided by Ralph
📌 Team update (2026-02-16): Game simulation engine established — pure, deterministic, separable — decided by Ralph

📌 Territory claiming system lives in `src/game/systems/territory.ts` — handles node ownership mechanics
📌 `processTerritoryClaims()` is the main entry point for territory processing during tick
📌 Claim mechanics: +10 control points/tick for neutral, -5 control points/tick for contested
📌 Territory events: `NodeClaimed`, `NodeContested`, `NodeLost` — emitted at state transitions
📌 `controlPoints` and `maxControlPoints` added to Node interface (optional for backwards compatibility)
📌 Game loop integration: `processTick()` now accepts optional `activeClaims` parameter
📌 Territory system is pure and deterministic — same claims + world = same outcome
📌 ClaimAction type defines player claims: playerId, nodeId, tick
📌 Helper functions: `canClaim()` for validation, `getClaimProgress()` for UI, `abandonNode()` for reset

## Team Updates

📌 Team update (2026-02-16): Territory claiming system implemented per Phase 8 architecture — M1 and M3 complete

📌 Diplomacy system lives in `src/game/systems/diplomacy.ts` — handles player relationships
📌 `applyDiplomaticAction()` is the main entry point for processing diplomatic actions
📌 `getDiplomaticStatus()` looks up relationship status between two players
📌 DiplomaticStatus enum: `Neutral`, `Allied`, `War` — three possible states
📌 DiplomaticAction enum: `OfferAlliance`, `AcceptAlliance`, `RejectAlliance`, `DeclareWar`, `ProposePeace`, `AcceptPeace`
📌 Alliance offers require acceptance — stored in pendingOffers until accepted/rejected
📌 War declarations are unilateral — immediate effect without acceptance
📌 Peace proposals require acceptance — same pattern as alliance offers
📌 Validation rules: Can't act on yourself, war requires both players to have claimed nodes, peace requires war state
📌 Diplomacy events: `AllianceOffered`, `AllianceFormed`, `AllianceRejected`, `WarDeclared`, `PeaceProposed`, `PeaceMade`
📌 Helper functions: `areAllied()`, `areAtWar()`, `getAllDiplomaticRelations()`, `getPendingOffersFor()`
📌 Diplomatic relations stored in Map with consistent key ordering: alphabetically sorted player IDs
📌 System is pure and deterministic — same actions + world = same outcome

## Team Updates

📌 Team update (2026-02-17): Diplomacy system implemented per Phase 8 architecture — M2 complete
📌 Team update (2026-02-17): All changes must go through feature branches and PRs. Alex reviews all PRs before merge. No direct commits to master.

📌 Player identity: `player.id` (persistent) vs `sessionId` (ephemeral, Colyseus routing only)
📌 Node ownership references use `player.id`, not `sessionId` — survives reconnects
📌 PlayerSchema in `server/src/colyseus/schema.ts` — includes id, sessionId, name, color, connection status
📌 DiplomaticRelation uses `player.id` pairs for relationship tracking
📌 Event Log at `src/components/EventLog/EventLog.tsx` — displays simulation events from `GameWorld.eventQueue`
📌 Event icons and labels defined in EventLog component — sourced from deterministic game events
📌 Chat is NOT a simulation concern — belongs in networking (GameRoom) and UI (React components) layers
📌 Chat should use `player.id` for sender identity, query game state (diplomacy, ownership) read-only
📌 Future chat features (alliance chat, faction chat, proximity chat) can filter on game state without modifying it
📌 Event-to-chat announcements possible (one-way: events → chat), but never inject chat into simulation events

📌 Team update (2025-01-22): Chat feature design consolidated across all layers (backend, frontend, systems integration, UI) — decided by Amos, Holden, Miller, Naomi

📌 PixiJS visualization system: Simulation layer defines visual state contract
📌 Tick-synchronized state: Node ownership, resources, control points, diplomatic relations, discovery state
📌 Client-side interpolation: Smooth animations, particle effects, camera movement, UI interactions
📌 Visual state events: All GameEventType events trigger visual updates in rendering layer
📌 Discovery system: Deterministic fog of war — discoveredNodes and discoveryTick tracked per player
📌 LOD strategy: Strategic/Operational/Tactical zoom levels with culling and geometry simplification
📌 Node visual properties: fillColor (owner), controlRing (claim progress), resourceBars (capacity)
📌 Connection visual properties: lineColor (diplomacy), lineStyle (active/inactive), gatewayIcon (cooldown)
📌 Diplomacy affects visuals: Allied nodes highlighted, enemy nodes show warning indicators
📌 Event-driven rendering: PixiJS subscribes to tick events, updates triggered by events not polling
📌 Visual state hooks: useNodesForVisualization(), useConnectionsForVisualization(), useTickProgress()
📌 Separation principle: Simulation is authoritative, rendering is presentational — never poll, always react to events

📌 Team update (2026-02-17): PixiJS Visualization System design consolidated into decisions.md. Tick-synchronized state requirements and game state model finalized. — decided by Holden, Naomi, Amos, Miller
