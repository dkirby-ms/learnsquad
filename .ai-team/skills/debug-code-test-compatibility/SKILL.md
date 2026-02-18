---
name: "debug-code-test-compatibility"
description: "Ensure debug logging doesn't break test mocks"
domain: "testing"
confidence: "low"
source: "earned"
---

## Context

Debug console.log statements in production code can break tests when they access properties that don't exist in test mocks. This commonly occurs when logging implementation details of third-party libraries (like PixiJS, THREE.js, D3.js) that use complex object structures.

This skill applies to:
- Code that uses third-party rendering/graphics libraries with test mocks
- Debug logging statements that access nested object properties
- Test suites that mock complex library objects
- Any code where tests use different object structures than production

## Pattern

### ❌ Bad: Logging Implementation Details

```typescript
// SceneManager.ts
private updateNodes(nodes: Record<EntityId, Node>) {
  for (const node of Object.values(nodes)) {
    const sprite = this.createNodeSprite(node);
    this.nodesLayer.addChild(sprite);
    
    // BAD: Accesses .children.length which may not exist in mocks
    console.log('Added sprite, total:', this.nodesLayer.children.length);
  }
}
```

**Test Mock:**
```typescript
const MockContainer = jest.fn().mockImplementation(function() {
  const children: any[] = [];
  return {
    addChild: jest.fn((child) => children.push(child)),
    _children: children,  // Internal only - not exposed!
  };
});
```

**Result:** `TypeError: Cannot read properties of undefined (reading 'length')`

### ✅ Good: Remove Debug Logging Before Merge

```typescript
private updateNodes(nodes: Record<EntityId, Node>) {
  for (const node of Object.values(nodes)) {
    const sprite = this.createNodeSprite(node);
    this.nodesLayer.addChild(sprite);
    // Debug logging removed
  }
}
```

### ⚠️ Alternative: Mock-Safe Logging

If logging is truly needed (e.g., for production diagnostics):

```typescript
private updateNodes(nodes: Record<EntityId, Node>) {
  for (const node of Object.values(nodes)) {
    const sprite = this.createNodeSprite(node);
    this.nodesLayer.addChild(sprite);
    
    // SAFE: Only logs own state, not library internals
    console.log('Added sprite for node:', node.id);
  }
}
```

## Why This Matters

1. **Test Reliability:** Tests should fail for real bugs, not mock incompatibilities
2. **Clean Logs:** Production code shouldn't contain debug logging anyway
3. **Mock Simplicity:** Mocks should model behavior, not implementation details
4. **Maintenance:** Less coupling between test mocks and library internals

## Code Review Checklist

When reviewing PRs with third-party library usage and test coverage:

- [ ] Are there console.log statements accessing library object properties?
- [ ] Do tests mock those library objects?
- [ ] Do the mocks expose all properties accessed in logging?
- [ ] Is the logging even necessary for production?
- [ ] If logging is needed, does it only reference application state?

**Best Practice:** Remove all debug console.log statements before merge. Use a proper logging library with log levels if production logging is needed.

## Real Example

**PR #11 - PixiJS Canvas Implementation**

**Issue:** SceneManager.ts:162 had:
```typescript
console.log('Added sprite for node:', node.id, 
  'to nodesLayer. Layer children count:', this.nodesLayer.children.length);
```

PixiJS Container has a `children` property, but the test mock didn't expose it (only `_children` internally). This caused 122 test failures.

**Solution:** Remove the console.log statement entirely (or at minimum, remove the `.children.length` access).

## Related Skills

- `code-review-build-verification`: Always run full test suite during reviews
- `react-pixi-integration`: Patterns for testing PixiJS + React code

## Tags

#testing #mocking #debug-logging #code-review #third-party-libraries #pixi #graphics
