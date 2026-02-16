### 2025-07-14: Resource system test patterns established

**By:** Drummer

**What:** Created comprehensive test suite for Phase 2 resource system at `src/game/__tests__/resources.test.ts`. 61 tests covering: regeneration, depletion, production/consumption, capacity limits, event generation, and determinism verification. Updated Jest config with new `game` project.

**Why:** Pure functions demand pure tests — no mocks, no fakes, just inputs and outputs. The resource system is the foundation of game economy; if it's non-deterministic or has boundary bugs, everything built on top crumbles. The 100-tick determinism stress test catches subtle floating-point or state mutation issues that single-tick tests miss. Event tests verify state *transitions* not just final states — critical for UI sync.
