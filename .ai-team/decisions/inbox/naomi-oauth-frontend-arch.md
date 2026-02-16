### Frontend OAuth Architecture

**By:** Naomi

**What:** Implemented Entra ID OAuth frontend with AuthContext pattern. Login component now shows "Sign in with Microsoft" as primary auth method. Email/password form is hidden behind "Use email instead" toggle for dev fallback.

**Key decisions:**
1. **AuthContext manages all auth state** — user info, loading, login/logout functions. All auth consumers use `useAuth()` hook.
2. **OAuth is a redirect flow** — `login()` does `window.location.href = '/api/auth/login'`. Backend handles OAuth dance, returns with cookie session.
3. **Auth check on load** — App calls `/api/auth/me` on mount to restore session state.
4. **Dev endpoint is separate** — Email/password POSTs to `/api/auth/login/dev` to distinguish from OAuth redirect on `/api/auth/login`.

**Backend contract (for Amos):**
- `GET /api/auth/login` — Initiates Entra ID OAuth, redirects to Microsoft
- `GET /api/auth/me` — Returns `{ user: { id, email, name? } }` or 401 if not authenticated
- `POST /api/auth/logout` — Clears session, returns 200
- `POST /api/auth/login/dev` — Email/password login (dev only), expects `{ email, password }`

**Why:** OAuth redirect is the standard pattern for enterprise auth. Keeping email/password as dev fallback means local development doesn't require Entra ID setup. Separate endpoints prevent confusion between redirect and JSON API.
