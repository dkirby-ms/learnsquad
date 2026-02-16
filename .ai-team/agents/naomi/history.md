# Project Context

- **Owner:** dkirby-ms (saitcho@outlook.com)
- **Project:** MMOG grand strategy browser game with pausable real-time mechanics (Paradox-style)
- **Stack:** React, TypeScript, PixiJS, Colyseus, Node.js, Express, PostgreSQL, Redis
- **Created:** 2025-07-12

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

📌 Graphics: 2D with PixiJS for simpler visual style
📌 UI stack: React for UI chrome, PixiJS for game canvas
📌 State sync: Colyseus provides real-time state synchronization from server
📌 Build tooling: Vite for dev server and bundling with React plugin
📌 Component structure: src/components/{ComponentName}/{ComponentName}.tsx with CSS modules
📌 Login endpoint: POST /api/auth/login (Amos building backend)
📌 Styling approach: CSS modules for component isolation, dark theme (#0a0e17 bg, #141a26 cards)
