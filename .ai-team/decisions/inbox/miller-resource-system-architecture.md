### 2025-07-14: Resource system architecture in src/game/systems/

**By:** Miller

**What:** Created `src/game/systems/` directory for game mechanics. The resource system (`resources.ts`) implements production/consumption/regeneration as pure functions. Producer and Consumer types are defined there. The `tickNode()` function in `models/node.ts` now delegates to `processNodeResources()` from the systems module.

**Why:** Separating game mechanics into a `systems/` folder keeps simulation logic organized as complexity grows. Producer/Consumer types are kept external to Node to avoid bloating the core types — buildings or units that produce/consume resources can be stored separately and passed to `tickNode()` at processing time. This also makes the simulation easier to extract to Rust/Go later.
