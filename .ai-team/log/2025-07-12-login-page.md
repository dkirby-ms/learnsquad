# Session: 2025-07-12 — Login Page Build

**Requested by:** dkirby-ms

## Team

- **Naomi** (frontend)
- **Amos** (backend)
- **Drummer** (tests)

## What They Did

Built login page with React frontend, Express auth API, and 55 test cases.

- Express backend with JWT authentication at `/api/auth/login` and `/api/auth/register`
- React login component with CSS modules for styling
- 55 comprehensive test cases covering API contracts, security, and component behavior

## Decisions Made

1. Server infrastructure in `server/` directory with in-memory user store
2. Test-first approach — tests written before implementation
3. CSS modules for component-scoped styling
