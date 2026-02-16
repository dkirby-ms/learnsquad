### 2025-07-14: HttpOnly cookies for auth tokens

**By:** Amos

**What:** Replaced localStorage-based token storage with HttpOnly cookies for OAuth authentication. The OAuth callback now sets an HttpOnly cookie instead of passing the token in the redirect URL, and the `/me` endpoint reads from `req.cookies` instead of the Authorization header.

**Why:** localStorage is vulnerable to XSS attacks — any malicious JavaScript on the page can read `localStorage.getItem('auth_token')` and exfiltrate it. HttpOnly cookies are inaccessible to JavaScript entirely (`document.cookie` won't show them), so even if XSS occurs, the attacker cannot steal the auth token. This is standard security practice for session management.

**Details:**
- Added `cookie-parser` middleware to Express
- Configured CORS with `credentials: true` for cross-origin cookie handling
- Cookie settings: `httpOnly: true`, `secure` in production, `sameSite: strict`, 24-hour expiry
- Frontend now uses `credentials: 'include'` on fetch calls — browser handles cookie automatically
- Frontend never touches the token directly (the whole point)
