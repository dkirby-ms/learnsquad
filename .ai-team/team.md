# Team Roster

> MMOG grand strategy browser game with pausable real-time mechanics

## Coordinator

| Name | Role | Notes |
|------|------|-------|
| Squad | Coordinator | Routes work, enforces handoffs and reviewer gates. Does not generate domain artifacts. |

## Members

| Name | Role | Charter | Status |
|------|------|---------|--------|
| Holden | Lead | `.ai-team/agents/holden/charter.md` | ✅ Active |
| Naomi | Frontend Dev | `.ai-team/agents/naomi/charter.md` | ✅ Active |
| Amos | Backend Dev | `.ai-team/agents/amos/charter.md` | ✅ Active |
| Miller | Game Systems | `.ai-team/agents/miller/charter.md` | ✅ Active |
| Drummer | Tester | `.ai-team/agents/drummer/charter.md` | ✅ Active |
| Scribe | Session Logger | `.ai-team/agents/scribe/charter.md` | 📋 Silent |
| Ralph | Work Monitor | — | 🔄 Monitor |

## Coding Agent

<!-- copilot-auto-assign: false -->

| Name | Role | Charter | Status |
|------|------|---------|--------|
| @copilot | Coding Agent | — | 🤖 Coding Agent |

### Capabilities

**🟢 Good fit — auto-route when enabled:**
- Bug fixes with clear reproduction steps
- Test coverage (adding missing tests, fixing flaky tests)
- Lint/format fixes and code style cleanup
- Dependency updates and version bumps
- Small isolated features with clear specs
- Boilerplate/scaffolding generation
- Documentation fixes and README updates

**🟡 Needs review — route to @copilot but flag for squad member PR review:**
- Medium features with clear specs and acceptance criteria
- Refactoring with existing test coverage
- API endpoint additions following established patterns
- Migration scripts with well-defined schemas

**🔴 Not suitable — route to squad member instead:**
- Architecture decisions and system design
- Multi-system integration requiring coordination
- Ambiguous requirements needing clarification
- Security-critical changes (auth, encryption, access control)
- Performance-critical paths requiring benchmarking
- Changes requiring cross-team discussion

## Project Context

- **Owner:** dkirby-ms (saitcho@outlook.com)
- **Stack:** React, TypeScript, PixiJS (2D), Colyseus, Node.js, Express, PostgreSQL, Redis
- **Description:** MMOG grand strategy browser game with pausable real-time mechanics (Paradox-style)
- **Created:** 2025-07-12

## Architecture Decisions

- **"The Twist":** Game simulation layer (tick processing, game rules) architected as a separable module — can be extracted to Rust/Go later if CPU bottlenecks occur
- **Graphics:** 2D with PixiJS for simpler visual style
- **Multiplayer:** Colyseus room-based architecture for real-time state sync
