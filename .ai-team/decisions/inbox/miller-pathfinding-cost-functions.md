### 2025-07-14: A* pathfinding with pluggable cost functions

**By:** Miller

**What:** Implemented pathfinding in `src/game/systems/connectivity.ts` using A* algorithm with Manhattan distance heuristic. The `findPath()` function accepts an optional `CostFunction` parameter allowing callers to define custom cost calculations (time, resources, danger, etc.).

**Why:** A* is deterministic, efficient, and well-understood — critical for a separable simulation module. Pluggable cost functions let the same pathfinding logic serve multiple use cases (fastest path, cheapest path, safest path) without duplicating the algorithm. This keeps the simulation layer flexible without coupling it to specific game rules about what "cost" means.
