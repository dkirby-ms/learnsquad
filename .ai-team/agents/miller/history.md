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
