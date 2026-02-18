# Skill: Test Mock API Synchronization

**Confidence:** medium  
**Source:** earned  
**Earned from:** PR #11 review - PixiJS v8→v7 downgrade broke 61 tests  
**Date:** 2026-02-18

## Problem

When a library version changes (especially downgrades), test mocks that were written for the original API can become out of sync with the actual implementation, causing all tests to fail even though the implementation code is correct.

## Pattern

**Root cause:** Tests were written for library version A, then implementation was changed to use library version B, but test mocks weren't updated.

**Symptoms:**
- All tests for a feature fail after a dependency version change
- Test failures show API mismatch (e.g., `app.canvas` vs `app.view`)
- Implementation code works correctly (build passes, manual testing works)
- Mock functions return objects with wrong property names

## Solution

### Prevention (Best Practice)

1. **Run full test suite after ANY dependency version change**
   ```bash
   npm install library@new-version
   npm test  # MUST pass before committing
   ```

2. **Keep test mocks in sync with implementation API**
   - When implementation uses `app.view` (v7 API), mock must return `view` not `canvas`
   - When implementation calls `graphics.beginFill()`, mock must provide `beginFill()` not `fill()`

3. **Document API version in mock comments**
   ```typescript
   // Mock PixiJS v7 Application API
   jest.mock('pixi.js', () => ({
     Application: jest.fn(() => ({
       view: mockCanvas,  // v7 uses 'view', v8 uses 'canvas'
       // ...
     }))
   }));
   ```

### Detection (Code Review Checklist)

When reviewing PRs with dependency changes:

1. ✅ Check `package.json` diff for version changes
2. ✅ Verify tests still pass (`npm test` in review)
3. ✅ If tests fail after version change, check mock API synchronization
4. ✅ Verify PR description matches actual versions (not outdated)

### Recovery (When Found in Review)

1. **Identify the API change**
   - Compare old and new library documentation
   - Check implementation code for actual API usage
   - Compare with test mock API

2. **Update test mocks to match new API**
   ```typescript
   // Before (v8 API):
   const app = { canvas: mockCanvas, init: jest.fn() }
   
   // After (v7 API):
   const app = { view: mockCanvas }
   ```

3. **Run tests to verify fix**
   ```bash
   npm test -- --testPathPattern=AffectedComponent
   ```

## Example: PixiJS v8 → v7 Downgrade

**Context:** PR #11 downgraded from pixi.js v8 to v7 for compatibility with pixi-viewport.

**Problem:** 61 tests failed because:
- Tests mocked `app.canvas` and `app.init()` (v8 API)
- Implementation used `app.view` (v7 API)
- Test tried to verify `app.canvas` was appended, but code appended `app.view`

**Fix required:**
```typescript
// Test mock (before - v8 API):
jest.mock('pixi.js', () => ({
  Application: jest.fn(() => ({
    init: jest.fn().mockResolvedValue(undefined),
    canvas: mockCanvas,  // ❌ Wrong for v7
  }))
}));

// Test mock (after - v7 API):
jest.mock('pixi.js', () => ({
  Application: jest.fn(() => ({
    view: mockCanvas,  // ✅ Correct for v7
    // No init() method in v7
  }))
}));
```

## When to Apply

- ✅ After any library version upgrade or downgrade
- ✅ When test suite fails but build succeeds
- ✅ During code review of PRs with dependency changes
- ✅ When implementing code that uses a newly added library

## Related Skills

- **code-review-build-verification**: Always run both build AND tests during review
- **layer-boundary-preservation**: Keep test concerns separate from implementation

## Anti-Patterns to Avoid

❌ **Don't skip test run after dependency changes** - "It builds, so it's fine"
❌ **Don't assume tests are wrong** - Implementation might be using wrong API for the version
❌ **Don't merge with failing tests** - Even if "it works locally"
❌ **Don't update PR description without updating code/tests** - Creates misleading documentation

## Success Criteria

✅ All tests pass after dependency version change
✅ Test mocks use same API as implementation
✅ PR description accurately reflects actual versions used
✅ Code review catches API mismatches before merge
