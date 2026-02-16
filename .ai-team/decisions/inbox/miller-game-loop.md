### 2025-07-14: Game simulation engine established in simulation/ directory

**By:** Miller

**What:** Created a pure, deterministic game simulation engine in `simulation/` directory (outside `src/` for separability). The engine implements:

- **Type system** (`types.ts`): Node-based world topology with resources and connections (direct links + gateways), tick-based time with pause/speed control, event-driven state changes
- **World management** (`world.ts`): Pure functions for world state manipulation — all mutations return new state, no side effects
- **Game loop** (`gameLoop.ts`): Tick processor with clear phase separation (event processing → regeneration → state commit), seeded RNG for determinism (Mulberry32), both browser runner (requestAnimationFrame) and headless runner (for server/tests)

**Key design decisions:**

1. **Pure simulation layer**: All functions return new state rather than mutating. This enables deterministic replay, easy testing, and future extraction to Rust/Go.

2. **Seeded randomness**: Using Mulberry32 PRNG with explicit seed state. Any "random" behavior is reproducible given the same seed.

3. **Separable architecture**: The `simulation/` directory has no dependencies on DOM, network, or framework code. Its own `tsconfig.json` targets pure ES2022 without DOM libs.

4. **Dual runners**: `GameLoopRunner` for browser (uses requestAnimationFrame), `HeadlessRunner` for server/tests (caller controls tick timing).

5. **Event-driven state changes**: Events are queued and processed at specific ticks, allowing for scheduled actions and replay capability.

**File structure:**
```
simulation/
├── types.ts       # Core type definitions
├── gameLoop.ts    # Tick processing and runners
├── world.ts       # World state management
├── index.ts       # Public exports
└── tsconfig.json  # Separate compilation config
```

**Why:** Following "The Twist" architecture — the simulation layer is designed to be a separable module that could be extracted to Rust/Go later. Keeping it pure and deterministic means we can replay game states, run headless servers, and eventually port the hot path to a faster language without changing the architecture.
