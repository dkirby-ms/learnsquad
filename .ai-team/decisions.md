### 2025-07-12: Server infrastructure established in server/ directory

**By:** Amos

**What:** Created Node.js/Express/TypeScript backend in `server/` directory with JWT-based authentication. Auth routes at `/api/auth/login` and `/api/auth/register`. Using in-memory user store for now.

**Why:** Clean separation between client and server code. In-memory store keeps things simple for initial development — PostgreSQL integration will come when we have real persistence needs. Included register endpoint because login alone is useless without a way to create users.

### 2025-07-13: Test-first auth contracts established

**By:** Drummer

**What:** Created comprehensive test suites for login functionality before implementation. Backend tests define API contract (`POST /api/auth/login`), frontend tests define component behavior. Tests include security checks (SQL injection, rate limiting, user enumeration prevention).

**Why:** Writing tests first establishes the contract for Naomi and Amos. They build to make tests pass, not the other way around. This catches misunderstandings early and ensures security considerations aren't afterthoughts. The tests serve as executable documentation of expected behavior.

### 2025-07-14: CSS Modules for Component Styling

**By:** Naomi

**What:** Using CSS modules (*.module.css) for component-scoped styles rather than global CSS or CSS-in-JS.

**Why:** CSS modules give us scoped styles without runtime overhead. They work great with Vite's built-in support, avoid className collisions as the component library grows, and keep styling co-located with components. For a game UI, we want fast rendering without the overhead of CSS-in-JS solutions.
