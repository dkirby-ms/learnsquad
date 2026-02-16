### 2025-07-14: Using Entra External ID (CIAM) instead of regular Entra ID

**By:** Amos

**What:** OAuth implementation now uses Microsoft Entra External ID (CIAM) instead of regular Entra ID. Authority URL changed from `login.microsoftonline.com` to `{tenant}.ciamlogin.com`. Config now uses `AZURE_TENANT_NAME` instead of `AZURE_TENANT_ID`.

**Why:** This is a consumer game, not an enterprise app. Regular Entra ID is for employees/organizational accounts. External Identities (formerly Azure AD B2C) is for customers — supports self-service signup, password reset, and social identity providers (Google, Facebook, etc.). Different beast entirely.

**Impact:**
- `server/src/config/entra.ts` — new authority URL format, knownAuthorities for CIAM
- `server/.env.example` — AZURE_TENANT_NAME replaces AZURE_TENANT_ID
- Scopes changed: removed `User.Read` (not available in CIAM by default), added `offline_access`
- Frontend devs: OAuth status endpoint now returns `provider: 'entra-external-id'`
