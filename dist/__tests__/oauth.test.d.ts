/**
 * Backend OAuth/Entra External ID (CIAM) Tests
 *
 * Contract tests for OAuth endpoints with Microsoft Entra External ID.
 * Using CIAM (Customer Identity Access Management) for consumer-facing auth.
 *
 * Key differences from regular Entra ID:
 * - Authority: https://{tenant}.ciamlogin.com (not login.microsoftonline.com)
 * - Self-service signup: Users can sign up directly, no pre-registration needed
 * - Social identity providers: Google, Facebook, etc. (future)
 *
 * Written before implementation — Amos builds to make these pass.
 *
 * OAuth flow:
 * 1. GET /api/auth/login -> redirects to Entra External ID (CIAM)
 * 2. GET /api/auth/callback -> exchanges code for tokens, creates session
 * 3. GET /api/auth/me -> returns current user (if authenticated)
 * 4. POST /api/auth/logout -> clears session
 */
export {};
//# sourceMappingURL=oauth.test.d.ts.map