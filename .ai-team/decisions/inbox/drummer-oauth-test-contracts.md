### 2025-07-14: OAuth/Entra ID test contracts established

**By:** Drummer

**What:** Created comprehensive test suites for OAuth/Entra ID integration:
- `src/__tests__/oauth.test.ts` — 51 backend tests covering login redirect, callback token exchange, /api/auth/me, logout, token validation, and security (PKCE, nonce, CSRF state)
- Extended `src/components/Login/Login.test.tsx` with 25+ OAuth UI tests for "Sign in with Microsoft" button, auth state management, logout flow

**Why:** Writing tests before implementation defines the contract for Amos and Naomi. The tests cover:
- **Happy path:** Full OAuth flow from login → redirect → callback → authenticated requests → logout
- **Security:** Token validation (tampered, expired), CSRF state parameter, PKCE (marked as todo for implementation decision)
- **Error handling:** Invalid/expired codes, missing sessions, configuration errors
- **Edge cases:** Concurrent sessions, session persistence, token refresh

Tests use mocks that mirror expected MSAL/Entra ID behavior. Amos and Naomi build to make these pass — the mocks get replaced with real implementations.

**Test counts:** 111 passing, 57 marked as todo for features pending team decisions (PKCE, nonce, token storage).
