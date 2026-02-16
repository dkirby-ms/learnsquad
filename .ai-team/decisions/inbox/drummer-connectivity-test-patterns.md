### 2025-01-13: Connectivity test patterns established

**By:** Drummer

**What:** Phase 3 connectivity tests use `buildWorld()` helper for graph construction, determinism verification across 20 iterations for equal-cost paths, and performance baseline (100-node grid <100ms). Gateway tests verify state machine transitions with event emission at cooldown boundaries.

**Why:** Multiplayer sync requires deterministic pathfinding — if two clients calculate different paths for the same inputs, state diverges. The `buildWorld()` helper standardizes graph construction in tests, making edge cases (cycles, disconnected components, inactive edges) easy to express. Performance baseline prevents regression as game complexity grows.
