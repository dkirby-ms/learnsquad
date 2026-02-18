---
name: "code-review-build-verification"
description: "Verify full build succeeds in code reviews, not just tests"
domain: "code-review"
confidence: "high"
source: "earned"
---

## Context

When reviewing Pull Requests, **both tests AND build must pass**. Passing tests alone do not guarantee code quality:

- **TypeScript PRs:** Tests execute compiled JavaScript at runtime, while builds verify type correctness at compile-time
- **New test suites:** Tests for new features must also pass, not just pre-existing tests
- **Debug code:** Console.log statements can break tests when accessing mocked object properties

This skill applies to:
- Any PR that modifies TypeScript files (.ts, .tsx)
- PRs that add or modify type declarations (.d.ts files)
- PRs that change TypeScript configuration (tsconfig.json)
- PRs claiming to "fix build errors" or "fix type issues"
- PRs that add new test suites alongside new features
- PRs with third-party library integration (PixiJS, THREE.js, D3.js, etc.)

## Patterns

### 1. Two-Phase Verification

Always verify BOTH phases of correctness:

```bash
# Phase 1: Runtime correctness
npm test

# Phase 2: Compile-time correctness  
npm run build
# OR
npx tsc --noEmit
```

**Both must pass** for a PR to be approved.

### 2. Identify False Positives

Tests passing but build failing indicates:
- Type definitions are incorrect or incomplete
- Tests use `any` types or `@ts-ignore` to bypass type checking
- Tests import types differently than production code
- Configuration mismatch (e.g., tests use different tsconfig)

### 3. Review Checklist for TypeScript PRs

- [ ] Run `npm test` - **ALL tests pass** (including new test suites)
- [ ] Verify baseline - Check master branch test count vs PR test count
- [ ] Run `npm run build` - TypeScript compilation succeeds
- [ ] Check for `@ts-ignore` or `@ts-expect-error` - flag as code smells
- [ ] Verify type declarations are properly referenced in tsconfig
- [ ] Check that new type files are included in tsconfig paths/includes
- [ ] Look for debug console.log statements - should be removed before merge

### 4. Baseline Comparison

Always establish baseline before reviewing:

```bash
# Checkout master
git checkout master
npm test  # Record: X suites pass, Y tests pass

# Checkout PR branch
git checkout feature/my-feature
npm test  # Compare: Should have ≥X suites pass, ≥Y tests pass
```

**Red flag:** PR claims "all tests passing" but new test suites fail completely. This indicates the author only verified pre-existing tests, not the new ones.

## Examples

### Good: Complete Fix

```typescript
// PR adds type declarations
// src/css-modules.d.ts
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// AND updates tsconfig.json to reference it
{
  "include": ["src/**/*", "src/**/*.d.ts"]
}

// Verification:
// ✅ npm test passes
// ✅ npm run build succeeds
```

### Bad: Incomplete Fix (from PR #9)

```typescript
// PR adds type declarations but doesn't configure TypeScript to find them
// src/css-modules.d.ts exists BUT:
// ❌ npm run build fails with "Cannot find module '*.module.css'"
// ✅ npm test passes (because tests don't type-check CSS imports)

// The fix is incomplete - types exist but aren't applied
```

### Bad: Workaround Instead of Fix

```typescript
// Using @ts-ignore to bypass type errors
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000'; // Error
// "Fixed" with:
// @ts-ignore
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';

// This masks the problem instead of fixing it
// ❌ npm run build still has warnings
// ✅ npm test passes (doesn't type-check)
```

## Anti-Patterns

### ❌ Trusting Test Success Alone

```bash
# Anti-pattern: Only running tests
npm test # Passes ✅
# Approve PR ← WRONG
```

**Why wrong:** Tests execute compiled JavaScript. Type errors only appear at compile-time.

### ❌ Using @ts-ignore as a Fix

```typescript
// Anti-pattern: Suppressing errors instead of fixing them
// @ts-ignore - "fix" for import.meta type error  
return import.meta.env.VITE_WS_URL || 'ws://localhost:3000';
```

**Why wrong:** This hides the real problem. The type declarations or configuration should be fixed properly.

### ❌ Partial Type Fixes

```typescript
// Anti-pattern: Adding type declarations without configuration
// Created: src/vite-env.d.ts
// But NOT added to tsconfig.json includes
// Result: Types exist but aren't applied
```

**Why wrong:** TypeScript needs to know where to find declaration files. They must be referenced in tsconfig or placed in standard locations.

## Recovery Actions

When a PR has passing tests but failing build:

1. **Request Changes** - The PR is not ready to merge
2. **Document the gap** - Show tests pass but build fails
3. **Identify root cause** - Is it config, missing types, or workarounds?
4. **Reassign if needed** - Route to appropriate agent (e.g., TypeScript expert)
5. **Verify fix** - Next submission must show both tests AND build succeeding

## Real Examples from This Project

### PR #9 - TypeScript Build Failures (2025-01-20)

**Issue:** Tests passed but build had 27 TypeScript errors  
**Root cause:** Type declaration files added but not referenced in tsconfig.json  
**Lesson:** Always run `npm run build` in addition to `npm test`

### PR #11 - New Test Suites Failing (2026-02-18)

**Issue:** 
- Master: 11 test suites pass, 450 tests pass
- PR branch: 11 pre-existing suites pass, but 4 NEW suites ALL fail (122 tests)
- PR description claimed "All existing tests passing" - technically true but misleading

**Root cause:** 
- Console.log statements accessing `this.nodesLayer.children.length`
- Test mocks didn't expose `.children` property (only `._children` internally)
- Debug code should have been removed before merge

**Lesson:** 
- "All tests passing" must include NEW tests, not just pre-existing
- Always verify baseline test count vs PR test count
- Debug console.log can break tests when accessing mocked objects
- See skill: `debug-code-test-compatibility`

## Related Skills

- `debug-code-test-compatibility`: How debug logging can break test mocks
- `react-pixi-integration`: Testing patterns for PixiJS + React code
