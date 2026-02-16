### 2025-07-14: Game simulation layer established in src/game/

**By:** Miller

**What:** Created the core game simulation module with pure, deterministic tick processing. Core types (`GameWorld`, `Node`, `Resource`, `Connection`) in `types.ts`. Model functions in `models/` directory. `GameLoop` class with `tick()` method for scheduled processing. All simulation logic is side-effect-free and returns new state.

**Why:** The simulation needs to be deterministic for replay, debugging, and potential extraction to Rust/Go. Pure functions make the code testable and predictable. Ticks are the atomic unit of game time — wall-clock time is only used for scheduling, never for game logic. This separation means the same simulation can run at different speeds or be stepped manually for debugging.
