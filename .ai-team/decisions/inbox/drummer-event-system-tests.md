### 2025-07-14: Event system test patterns established

**By:** Drummer

**What:** Created comprehensive test suite for Phase 4 event system covering queue processing, handler registry, event history, and game loop integration. 86 tests in `src/game/__tests__/events.test.ts`.

**Why:** Event system is the backbone of game mechanics — every state transition flows through it. Tests verify:
1. FIFO ordering is sacred (out-of-order events would desync multiplayer)
2. Chain reactions work but circuit breakers prevent infinite loops
3. Handlers are pure functions that don't mutate world state
4. History pruning keeps memory bounded without losing recent events
5. Determinism across 100 iterations — same inputs always produce same outputs

The depth limit and max-events-per-tick circuit breakers prevent runaway chain reactions from freezing the game. Tests verify these fail safely and continue processing unrelated events.
