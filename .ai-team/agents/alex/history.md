# Alex Kamal — History

## Project Learnings (from import)

**Owner:** dkirby-ms (saitcho@outlook.com)

**Project:** MMOG grand strategy browser game with pausable real-time mechanics (Paradox-style)

**Tech Stack:**
- Frontend: React, TypeScript, PixiJS (2D rendering)
- Backend: Node.js, Express, Colyseus (multiplayer)
- Database: PostgreSQL, Redis
- Architecture: "The Twist" — game simulation layer designed as separable module for future extraction to Rust/Go if CPU bottlenecks occur

**Key architectural constraint:** Game simulation layer must remain decoupled from the rest of the codebase.

**Current state:** Diplomacy system recently implemented with bilateral relations (neutral/allied/war), pending offers in memory, and Colyseus schema sync.

## Learnings

### 2025-01-20: Joined as Code Reviewer

**Role:** Dedicated code reviewer responsible for:
- Reviewing all PRs before merge to master
- Checking code quality, bugs, security issues
- Ensuring adherence to project conventions
- Providing constructive feedback
- Enforcing the new PR-based workflow (no direct commits to master)

**Review focus areas:**
- Code quality and maintainability
- Correctness and edge cases
- Security (XSS, injection, auth/authz)
- Test coverage and quality
- Architecture alignment (especially "The Twist" separation)
- Performance considerations

**Workflow:** All changes must go through feature branches → PRs → Alex's review → merge. No exceptions.

### 2025-01-20: PR #9 Review - Build Fixes Rejected

**PR:** #9 "fix: Add TypeScript type declarations and fix test imports" by dkirby-ms  
**Branch:** squad/build-fixes-and-types → master  
**Verdict:** REQUEST CHANGES - reassigned to Miller

**Issues Found:**
- CSS module type declarations added but not properly referenced in tsconfig
- Vite environment types declared but not applied correctly to import.meta
- Login test type fixes incomplete - still has TypeScript errors
- Connectivity test type fixes incomplete - tests pass but tsc fails
- GamePage changes introduce new errors (import path with .js extension)
- Build completely broken: 27 TypeScript errors

**Root Cause:** tsconfig.json uses `module: "NodeNext"` and `moduleResolution: "NodeNext"` which is for Node.js ESM, but this is a Vite browser project. The configuration mismatch causes module resolution issues.

**Key Files Reviewed:**
- src/css-modules.d.ts - CSS module type declarations
- src/vite-env.d.ts - Vite environment type declarations  
- src/components/Login/Login.test.tsx - Test type fixes (incomplete)
- src/game/__tests__/connectivity.test.ts - Resource type completeness (incomplete)
- src/pages/GamePage.tsx - Import and env access changes (problematic)

**Lesson:** Type declaration files are useless if tsconfig doesn't pick them up. Always run full build (`npm run build`) to verify TypeScript compilation, not just tests.

### 2026-02-18: PR #11 Re-Review - PixiJS Canvas Still Failing

**PR:** #11 "feat: Phase 1 PixiJS Game Canvas MVP"  
**Branch:** feature/pixi-canvas-phase1 → master  
**Verdict:** REQUEST CHANGES - Reassigned to Naomi

**Context:** User requested re-review after claiming fixes for:
- PixiJS v8 + pixi-viewport v6 (correct versions) ✅
- Race condition fix (useState for sceneManager) ✅
- Re-initialization loop fix (ref for callback) ✅
- Debug code removed ❌

**Issues Found:**

1. **All GameCanvas tests failing** (4 suites, 122 tests)
   - Root cause: console.log on SceneManager.ts:162 accesses `this.nodesLayer.children.length`
   - Test mocks use `_children` internally but don't expose `children` property
   - TypeError: Cannot read properties of undefined (reading 'length')

2. **Debug code NOT fully removed**
   - 10+ console.log statements remain in GameCanvas.tsx and SceneManager.ts
   - Lines: GameCanvas.tsx (58, 130-137, 144), SceneManager.ts (113-117, 139-141, 162, 173)
   - Commit b2c7b44 only removed test circle, not diagnostic logging

3. **PR claims inaccurate**
   - Claims "All existing tests passing (11 suites, 450 tests)"
   - Reality: 11 pre-existing pass, but 4 NEW suites ALL fail
   - This is misleading - new code must also pass tests

**Baseline Verification:**
- Master: 11 suites pass, 450 tests pass ✅
- Build: Passes ✅
- Dependencies: pixi.js@^8.16.0, pixi-viewport@^6.0.3 ✅

**Key Files:**
- src/components/GameCanvas/GameCanvas.tsx - React wrapper with lifecycle management
- src/components/GameCanvas/SceneManager.ts - PixiJS rendering logic with sprite registry
- src/components/GameCanvas/__tests__/*.test.tsx - Comprehensive test suites (all failing)

**Architecture Review:**
- Component separation good (React wrapper + pure PixiJS class)
- State management correct (useState for sceneManager, ref for callbacks)
- Performance patterns solid (sprite registry, incremental updates)
- **But:** Debug logging breaks tests and adds noise

**Lesson:** Console.log statements can break tests if they access properties not exposed by mocks. Always run full test suite, not just build. PR descriptions must accurately reflect ALL tests (including new ones), not just pre-existing tests.
