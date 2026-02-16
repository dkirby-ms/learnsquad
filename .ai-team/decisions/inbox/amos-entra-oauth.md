### 2025-07-14: Microsoft Entra ID OAuth added alongside local auth

**By:** Amos

**What:** Added OAuth authentication via Microsoft Entra ID (Azure AD). OAuth routes live at `/api/auth/oauth/*` — separate from existing email/password auth at `/api/auth/*`. Uses PKCE flow with @azure/msal-node.

**Why:** Modern OAuth beats storing passwords. Entra ID integration is production-ready, handles enterprise SSO, and offloads credential management to Microsoft. Kept email/password as fallback for local dev when you don't want to mess with Azure app registrations.

**Routes:**
- `GET /api/auth/oauth/login` — redirects to Entra ID
- `GET /api/auth/oauth/callback` — exchanges code for tokens, issues game JWT
- `GET /api/auth/oauth/logout` — redirects to Entra logout
- `GET /api/auth/oauth/me` — returns current user from JWT
- `GET /api/auth/oauth/status` — returns whether OAuth is configured

**Config:** Set `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID` in `.env`. See `.env.example`.
