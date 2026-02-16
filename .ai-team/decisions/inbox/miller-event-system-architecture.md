### 2025-07-15: Event system architecture with handler registry and depth limits

**By:** Miller

**What:** Implemented event-driven game state change system in `src/game/systems/events.ts` and `src/game/systems/handlers.ts`. Events process FIFO per tick, with chain reaction support via handler-spawned events. Circuit breakers prevent infinite loops (maxEventDepth=10, maxEventsPerTick=1000).

**Why:** The event system needs to be deterministic and pure for potential Rust/Go extraction. Handler registry pattern allows adding new event behaviors without modifying core loop. Depth limits are essential — a buggy handler spawning events infinitely could freeze the simulation. Default limits are generous enough for real gameplay chains while protecting against runaway processing.
