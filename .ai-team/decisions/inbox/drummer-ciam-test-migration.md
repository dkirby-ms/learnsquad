### 2025-07-15: OAuth tests migrated from Entra ID to Entra External ID (CIAM)

**By:** Drummer

**What:** Updated `src/__tests__/oauth.test.ts` and `src/components/Login/Login.test.tsx` to use Entra External ID (CIAM) instead of regular Entra ID. Key test changes:

1. Authority URL tests now verify `{tenant}.ciamlogin.com` pattern instead of `login.microsoftonline.com`
2. Added CIAM-specific test suites:
   - Self-service signup flow (new user, existing user)
   - Social identity provider tests (Google/Facebook marked `skip` until configured)
   - Password reset flow (marked `todo`)
   - CIAM discovery endpoint validation
3. Updated mock config to use CIAM tenant subdomain naming convention
4. Frontend tests updated to reflect single button handles both signin/signup

**Why:** CIAM is designed for consumer-facing apps. It supports self-service signup (no pre-registration), social IdPs, and branded login experiences. The authority URL difference is the most critical change — tests will catch any code still pointing at the wrong endpoint. Social IdP tests are marked `skip` rather than deleted so we remember to enable them when Google/Facebook are configured.

**Test counts:** 88 passing, 69 todo, 8 skipped (social IdP placeholders)
