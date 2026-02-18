---
name: "flex-container-height"
description: "Fix flex container height calculation issues with min-height: 0"
domain: "css, layout"
confidence: "low"
source: "earned"
---

## Context
Flex containers with `flex: 1` may not size properly if they have explicit `min-height` values. This is a common issue when nesting containers that need to fill available space.

## Patterns
**Flex container child sizing:**
- Use `min-height: 0` (or `min-width: 0`) on flex items to allow proper shrinking
- This overrides the default `min-height: auto` which can prevent flex items from shrinking below their content size
- Especially important when the flex item contains absolute-positioned children or canvas elements

**When to use:**
- Flex item has `flex: 1` and needs to fill available space
- Container contains elements that should respond to parent size (canvas, absolute positioned elements)
- Parent uses `display: flex` with `flex-direction: column`

## Examples
```css
/* ❌ Anti-pattern: explicit min-height breaks flex sizing */
.canvas {
  flex: 1;
  min-height: 300px; /* This can prevent proper flex calculation */
}

/* ✅ Correct: min-height: 0 allows proper flex sizing */
.canvas {
  flex: 1;
  min-height: 0; /* Allows container to shrink and grow with flex */
}
```

## Anti-Patterns
- Don't use explicit `min-height` values on flex items unless you specifically need a minimum size constraint
- Don't assume `flex: 1` alone is sufficient — the default `min-height: auto` can interfere
