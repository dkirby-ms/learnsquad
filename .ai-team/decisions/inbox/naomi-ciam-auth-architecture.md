### 2025-07-14: Frontend architected for CIAM multi-provider support

**By:** Naomi

**What:** Updated AuthContext and Login component to use Entra External Identities (CIAM) endpoints (`/api/auth/oauth/*`). Added `OAuthProvider` type supporting `'microsoft' | 'google' | 'facebook'` and parameterized the login function. Button still says "Sign in with Microsoft" but architecture supports adding social provider buttons without refactoring.

**Why:** CIAM is customer-facing auth that differs from regular Entra ID — it supports self-service signup, password reset, and social identity providers. The frontend now passes a `provider` query param to the backend, so when we enable Google or Facebook in the CIAM portal, we just add buttons that call `login('google')` or `login('facebook')`. No separate registration page needed since CIAM handles signup within the OAuth flow.

**Endpoints aligned with backend:**
- GET /api/auth/oauth/login?provider=microsoft
- GET /api/auth/oauth/me
- POST /api/auth/oauth/logout
