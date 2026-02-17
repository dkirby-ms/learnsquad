---
name: "ui-component-design-exploration"
description: "Explore existing UI patterns before designing new components"
domain: "frontend-design"
confidence: "low"
source: "earned"
---

## Context

When designing new UI components or features for an existing application, it's critical to first explore the current implementation patterns to ensure consistency. This applies to:
- Adding new UI components to an existing React app
- Designing features that integrate with existing UI sections
- Creating components that should match existing styling and interaction patterns
- Extending or modifying existing UI structures

Jumping straight to design without understanding current patterns leads to inconsistent UX, duplicate code, and integration friction.

## Patterns

### 1. Systematic Codebase Exploration

Before designing, gather context on:

**Structure & Organization:**
- Component directory structure and naming conventions
- File co-location patterns (CSS modules, tests, index files)
- Component hierarchy (atoms, molecules, organisms)

**Styling Approach:**
- CSS solution (modules, styled-components, Tailwind, etc.)
- Theme system (colors, typography, spacing)
- Dark/light mode patterns if applicable

**State Management:**
- How components access global state (hooks, context, props)
- Where state lives (local, store, URL params)
- Patterns for syncing remote data (websockets, polling, etc.)

**Interaction Patterns:**
- Existing keyboard shortcuts and navigation
- Focus management and accessibility patterns
- Loading states, empty states, error states

### 2. Find Similar Components First

Identify components that are **functionally similar** to what you're designing:
- If adding a chat, look at event logs or notification panels
- If adding a tab system, search for existing tabbed interfaces
- If adding a form, examine existing forms for validation patterns

**Example exploration commands:**
```bash
# Find components with similar names
ls src/components/ | grep -i "log\|panel\|list"

# Find CSS module patterns
find src/components -name "*.module.css"

# Find state management hooks
grep -r "useState\|useContext\|useStore" src/hooks/

# Find message/event handling patterns
grep -r "onMessage\|room\.send" src/
```

### 3. Document Integration Points

Identify **exactly where** your component will integrate:

- Parent component that will render your new component
- Props that will be passed down
- State hooks or stores that provide data
- Event handlers or callbacks for actions
- CSS class names or themes to inherit

**Before designing**, answer:
- Where in the component tree does this live?
- What data does it display and where does that data come from?
- What actions can users take and how are they communicated?

### 4. Match Existing Visual Language

Extract the visual design system from existing components:

**Colors:** Background, text (primary/secondary/tertiary), borders, accents
**Typography:** Font sizes, weights, line heights for different text types
**Spacing:** Padding, margins, gaps used consistently
**Borders & Shadows:** Border radius, border widths, shadow depths
**Transitions:** Animation durations and easing functions

**Example from chat design:**
```css
/* Extracted from existing EventLog component */
Background: #141a26
Border: rgba(255, 255, 255, 0.05)
Text Primary: #e8eaed
Text Secondary: #9ca3af
Accent Blue: #3b82f6
```

### 5. Design Document Structure

A complete UI/UX design document should include:

1. **Component Structure** - Hierarchy, props, responsibilities
2. **Layout & Visual Design** - Wireframes, spacing, colors
3. **User Interactions** - Click, hover, keyboard, edge cases
4. **State Management** - Local vs synced, data flow
5. **UX Patterns** - Empty states, loading, errors, timestamps
6. **Styling Approach** - Match existing patterns
7. **Integration Points** - Exact files/hooks/props to connect
8. **Performance Considerations** - Scroll, render optimization
9. **Accessibility** - Keyboard nav, screen readers, focus

## Anti-Patterns

❌ **Don't:** Jump straight to designing without exploring existing code
✅ **Do:** Spend 20-30% of design time understanding current patterns

❌ **Don't:** Introduce a new styling approach (e.g., Tailwind in a CSS modules project)
✅ **Do:** Match the existing styling system exactly

❌ **Don't:** Create isolated design specs without integration details
✅ **Do:** Specify exact files, props, and hooks for integration

❌ **Don't:** Design in a vacuum without considering parent components
✅ **Do:** Show where in the existing component tree your component lives

## Examples

### Good: Chat Feature Design Process

1. ✅ Explored `GameWorld.tsx` to understand right sidebar structure
2. ✅ Examined `EventLog` component for similar message-list patterns
3. ✅ Reviewed `useGameSocket.ts` for Colyseus messaging patterns
4. ✅ Extracted color palette and typography from existing CSS
5. ✅ Documented exact integration points (files to create/modify)
6. ✅ Created wireframes matching existing EventLog visual style
7. ✅ Specified props/state that align with current architecture

**Result:** Design document that feels native to the app, with clear implementation path.

### Bad: Chat Feature Design (Hypothetical)

1. ❌ Designed chat UI based on generic best practices
2. ❌ Used Tailwind classes (project uses CSS modules)
3. ❌ Light theme colors (project is dark theme)
4. ❌ Standalone component with no parent context
5. ❌ Vague "integrate with backend" note
6. ❌ No consideration of existing event log patterns

**Result:** Design that clashes with existing UI, requires refactoring to implement.

## When This Skill Applies

Use this approach when:
- Designing new features for existing applications
- Extending or modifying existing UI sections
- Creating components that need to integrate with current architecture
- Working on a project you're not fully familiar with yet

Skip this approach when:
- Creating a brand new application from scratch
- Designing a prototype that won't match existing patterns
- Building a standalone tool or library

## Related Skills

- Component architecture patterns
- CSS organization strategies
- State management patterns
- Accessibility best practices
