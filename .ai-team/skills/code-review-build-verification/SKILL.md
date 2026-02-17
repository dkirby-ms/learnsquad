---
name: "code-review-build-verification"
description: "Verify full build succeeds in code reviews, not just tests"
domain: "code-review"
confidence: "medium"
source: "earned"
---

## Context

When reviewing Pull Requests with TypeScript changes, passing tests alone do not guarantee the code will build successfully. TypeScript type errors can exist even when JavaScript tests pass at runtime because tests execute compiled JavaScript, while builds verify type correctness at compile-time.

This skill applies to:
- Any PR that modifies TypeScript files (.ts, .tsx)
- PRs that add or modify type declarations (.d.ts files)
- PRs that change TypeScript configuration (tsconfig.json)
- PRs claiming to "fix build errors" or "fix type issues"

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

- [ ] Run `npm test` - all tests pass
- [ ] Run `npm run build` - TypeScript compilation succeeds
- [ ] Check for `@ts-ignore` or `@ts-expect-error` - flag as code smells
- [ ] Verify type declarations are properly referenced in tsconfig
- [ ] Check that new type files are included in tsconfig paths/includes

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
