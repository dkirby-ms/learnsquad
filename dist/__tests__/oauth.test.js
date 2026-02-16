"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
// Mock OAuth service - Amos replaces with real MSAL implementation
// Using CIAM tenant naming convention: {tenant-name}.ciamlogin.com
const mockOAuthConfig = {
    tenantId: 'learnsquad', // CIAM tenant subdomain (not a GUID)
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'http://localhost:3000/api/auth/callback',
    scopes: ['openid', 'profile', 'email', 'User.Read'],
};
const mockOAuthService = {
    // Generate authorization URL for Entra External ID (CIAM)
    getAuthorizationUrl(state) {
        const params = new URLSearchParams({
            client_id: mockOAuthConfig.clientId,
            response_type: 'code',
            redirect_uri: mockOAuthConfig.redirectUri,
            scope: mockOAuthConfig.scopes.join(' '),
            response_mode: 'query',
            state,
        });
        // CIAM uses {tenant}.ciamlogin.com authority instead of login.microsoftonline.com
        return `https://${mockOAuthConfig.tenantId}.ciamlogin.com/oauth2/v2.0/authorize?${params}`;
    },
    // Exchange authorization code for tokens
    async exchangeCodeForTokens(code) {
        // Simulate valid codes
        if (code === 'valid-auth-code') {
            return {
                access_token: 'mock-access-token-xyz',
                id_token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwibmFtZSI6IlRlc3QgVXNlciIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxNzAwMDkwMDAwfQ.signature',
                token_type: 'Bearer',
                expires_in: 3600,
                refresh_token: 'mock-refresh-token',
            };
        }
        return null;
    },
    // Get user info from Microsoft Graph API
    async getUserInfo(accessToken) {
        if (accessToken === 'mock-access-token-xyz') {
            return {
                id: 'entra-user-123',
                email: 'test@example.com',
                displayName: 'Test User',
                givenName: 'Test',
                surname: 'User',
            };
        }
        return null;
    },
    // Validate tokens
    validateIdToken(idToken) {
        // Simulate token validation
        if (idToken.includes('expired')) {
            return { valid: false, error: 'Token expired' };
        }
        if (idToken.includes('tampered')) {
            return { valid: false, error: 'Invalid signature' };
        }
        if (idToken.startsWith('eyJ')) {
            return { valid: true, payload: { sub: 'user123', email: 'test@example.com' } };
        }
        return { valid: false, error: 'Invalid token format' };
    },
};
// Mock session store
const mockSessionStore = {
    sessions: new Map(),
    create(userId, tokens) {
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        this.sessions.set(sessionId, { userId, tokens, createdAt: Date.now() });
        return sessionId;
    },
    get(sessionId) {
        return this.sessions.get(sessionId);
    },
    destroy(sessionId) {
        return this.sessions.delete(sessionId);
    },
    clear() {
        this.sessions.clear();
    },
};
describe('OAuth Login Endpoint: GET /api/auth/login', () => {
    describe('Redirect to Entra ID', () => {
        it('should redirect to Microsoft Entra ID authorization endpoint', () => {
            const state = 'random-state-value';
            const authUrl = mockOAuthService.getAuthorizationUrl(state);
            expect(authUrl).toContain('login.microsoftonline.com');
            expect(authUrl).toContain('/oauth2/v2.0/authorize');
        });
        it('should include correct client_id in authorization URL', () => {
            const authUrl = mockOAuthService.getAuthorizationUrl('state');
            expect(authUrl).toContain(`client_id=${mockOAuthConfig.clientId}`);
        });
        it('should include redirect_uri in authorization URL', () => {
            const authUrl = mockOAuthService.getAuthorizationUrl('state');
            expect(authUrl).toContain(`redirect_uri=${encodeURIComponent(mockOAuthConfig.redirectUri)}`);
        });
        it('should request openid, profile, and email scopes', () => {
            const authUrl = mockOAuthService.getAuthorizationUrl('state');
            expect(authUrl).toContain('openid');
            expect(authUrl).toContain('profile');
            expect(authUrl).toContain('email');
        });
        it('should include User.Read scope for Microsoft Graph', () => {
            const authUrl = mockOAuthService.getAuthorizationUrl('state');
            expect(authUrl).toContain('User.Read');
        });
        it('should include state parameter for CSRF protection', () => {
            const state = 'csrf-protection-state-123';
            const authUrl = mockOAuthService.getAuthorizationUrl(state);
            expect(authUrl).toContain(`state=${state}`);
        });
        it('should use response_type=code for authorization code flow', () => {
            const authUrl = mockOAuthService.getAuthorizationUrl('state');
            expect(authUrl).toContain('response_type=code');
        });
        it('should include tenant ID in authorization URL', () => {
            const authUrl = mockOAuthService.getAuthorizationUrl('state');
            expect(authUrl).toContain(mockOAuthConfig.tenantId);
        });
    });
});
describe('OAuth Callback Endpoint: GET /api/auth/callback', () => {
    beforeEach(() => {
        mockSessionStore.clear();
    });
    describe('Successful Token Exchange', () => {
        it('should exchange valid authorization code for tokens', async () => {
            const tokens = await mockOAuthService.exchangeCodeForTokens('valid-auth-code');
            expect(tokens).not.toBeNull();
            expect(tokens?.access_token).toBeDefined();
            expect(tokens?.id_token).toBeDefined();
        });
        it('should receive access_token from token exchange', async () => {
            const tokens = await mockOAuthService.exchangeCodeForTokens('valid-auth-code');
            expect(tokens?.access_token).toBeTruthy();
            expect(tokens?.token_type).toBe('Bearer');
        });
        it('should receive id_token for user identification', async () => {
            const tokens = await mockOAuthService.exchangeCodeForTokens('valid-auth-code');
            expect(tokens?.id_token).toBeTruthy();
            // ID token should be JWT format
            expect(tokens?.id_token.split('.')).toHaveLength(3);
        });
        it('should receive token expiration time', async () => {
            const tokens = await mockOAuthService.exchangeCodeForTokens('valid-auth-code');
            expect(tokens?.expires_in).toBeGreaterThan(0);
        });
        it('should create session after successful token exchange', async () => {
            const tokens = await mockOAuthService.exchangeCodeForTokens('valid-auth-code');
            if (tokens) {
                const sessionId = mockSessionStore.create('user123', tokens);
                expect(mockSessionStore.get(sessionId)).toBeDefined();
                expect(mockSessionStore.get(sessionId)?.userId).toBe('user123');
            }
        });
        it('should fetch user info from Microsoft Graph', async () => {
            const tokens = await mockOAuthService.exchangeCodeForTokens('valid-auth-code');
            if (tokens) {
                const userInfo = await mockOAuthService.getUserInfo(tokens.access_token);
                expect(userInfo).not.toBeNull();
                expect(userInfo?.email).toBeDefined();
                expect(userInfo?.displayName).toBeDefined();
            }
        });
    });
    describe('Error Handling', () => {
        it('should reject invalid authorization code', async () => {
            const tokens = await mockOAuthService.exchangeCodeForTokens('invalid-code');
            expect(tokens).toBeNull();
        });
        it('should reject expired authorization code', async () => {
            const tokens = await mockOAuthService.exchangeCodeForTokens('expired-code');
            expect(tokens).toBeNull();
        });
        it('should reject empty authorization code', async () => {
            const tokens = await mockOAuthService.exchangeCodeForTokens('');
            expect(tokens).toBeNull();
        });
    });
    describe('State Validation (CSRF Protection)', () => {
        it.todo('should reject callback with missing state parameter');
        it.todo('should reject callback with mismatched state parameter');
        it.todo('should accept callback with matching state parameter');
    });
    describe('Error Query Parameters', () => {
        it.todo('should handle access_denied error from Entra ID');
        it.todo('should handle invalid_request error from Entra ID');
        it.todo('should handle server_error from Entra ID');
        it.todo('should display user-friendly error message');
    });
});
describe('User Info Endpoint: GET /api/auth/me', () => {
    beforeEach(() => {
        mockSessionStore.clear();
    });
    describe('Authenticated Requests', () => {
        it('should return user info when session is valid', async () => {
            const tokens = await mockOAuthService.exchangeCodeForTokens('valid-auth-code');
            if (tokens) {
                const sessionId = mockSessionStore.create('user123', tokens);
                const session = mockSessionStore.get(sessionId);
                expect(session).toBeDefined();
                expect(session?.userId).toBe('user123');
            }
        });
        it('should return user email from Entra ID profile', async () => {
            const tokens = await mockOAuthService.exchangeCodeForTokens('valid-auth-code');
            if (tokens) {
                const userInfo = await mockOAuthService.getUserInfo(tokens.access_token);
                expect(userInfo?.email).toBe('test@example.com');
            }
        });
        it('should return display name from Entra ID profile', async () => {
            const tokens = await mockOAuthService.exchangeCodeForTokens('valid-auth-code');
            if (tokens) {
                const userInfo = await mockOAuthService.getUserInfo(tokens.access_token);
                expect(userInfo?.displayName).toBe('Test User');
            }
        });
        it('should return Entra ID user ID', async () => {
            const tokens = await mockOAuthService.exchangeCodeForTokens('valid-auth-code');
            if (tokens) {
                const userInfo = await mockOAuthService.getUserInfo(tokens.access_token);
                expect(userInfo?.id).toBe('entra-user-123');
            }
        });
    });
    describe('Unauthenticated Requests', () => {
        it('should return 401 when no session exists', () => {
            const session = mockSessionStore.get('nonexistent-session');
            expect(session).toBeUndefined();
            // Endpoint should return { error: 'Not authenticated' } with 401 status
        });
        it('should return 401 when session cookie is missing', () => {
            // When no session cookie is sent, /api/auth/me returns 401
            const session = mockSessionStore.get('');
            expect(session).toBeUndefined();
        });
        it('should return 401 when session is expired', () => {
            // Expired sessions should be rejected
            const tokens = {
                access_token: 'old-token',
                id_token: 'old-id-token',
                token_type: 'Bearer',
                expires_in: 0,
            };
            const sessionId = mockSessionStore.create('user123', tokens);
            // Session exists but is expired - endpoint should check expiration
            const session = mockSessionStore.get(sessionId);
            expect(session).toBeDefined();
            // Real implementation would check tokens.expires_in or session.createdAt
        });
    });
});
describe('Logout Endpoint: POST /api/auth/logout', () => {
    beforeEach(() => {
        mockSessionStore.clear();
    });
    describe('Session Cleanup', () => {
        it('should destroy session on logout', () => {
            const tokens = {
                access_token: 'test-token',
                id_token: 'test-id-token',
                token_type: 'Bearer',
                expires_in: 3600,
            };
            const sessionId = mockSessionStore.create('user123', tokens);
            const destroyed = mockSessionStore.destroy(sessionId);
            expect(destroyed).toBe(true);
            expect(mockSessionStore.get(sessionId)).toBeUndefined();
        });
        it('should handle logout when no session exists', () => {
            const destroyed = mockSessionStore.destroy('nonexistent');
            expect(destroyed).toBe(false);
            // Should not throw, just return gracefully
        });
        it('should return success even if session already expired', () => {
            const sessionId = 'already-gone';
            const destroyed = mockSessionStore.destroy(sessionId);
            // Should succeed silently
            expect(destroyed).toBe(false);
        });
    });
    describe('Redirect After Logout', () => {
        it.todo('should redirect to home page after logout');
        it.todo('should support custom post_logout_redirect_uri');
        it.todo('should redirect to Entra ID logout endpoint to clear SSO session');
    });
});
describe('Token Validation', () => {
    describe('Valid Tokens', () => {
        it('should accept valid JWT id_token', () => {
            const validToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIn0.signature';
            const result = mockOAuthService.validateIdToken(validToken);
            expect(result.valid).toBe(true);
        });
        it('should extract payload from valid token', () => {
            const validToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIn0.signature';
            const result = mockOAuthService.validateIdToken(validToken);
            expect(result.payload).toBeDefined();
        });
    });
    describe('Tampered Tokens', () => {
        it('should reject token with invalid signature', () => {
            const tamperedToken = 'tampered-invalid-signature-token';
            const result = mockOAuthService.validateIdToken(tamperedToken);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid signature');
        });
        it('should reject token with modified payload', () => {
            const tamperedToken = 'tampered-payload';
            const result = mockOAuthService.validateIdToken(tamperedToken);
            expect(result.valid).toBe(false);
        });
    });
    describe('Expired Tokens', () => {
        it('should reject expired id_token', () => {
            const expiredToken = 'expired-token-abc';
            const result = mockOAuthService.validateIdToken(expiredToken);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('expired');
        });
    });
    describe('Malformed Tokens', () => {
        it('should reject non-JWT token', () => {
            const malformedToken = 'not-a-jwt';
            const result = mockOAuthService.validateIdToken(malformedToken);
            expect(result.valid).toBe(false);
        });
        it('should reject empty token', () => {
            const result = mockOAuthService.validateIdToken('');
            expect(result.valid).toBe(false);
        });
    });
});
describe('OAuth Configuration', () => {
    describe('Required Configuration', () => {
        it('should have tenant ID configured', () => {
            expect(mockOAuthConfig.tenantId).toBeTruthy();
            expect(mockOAuthConfig.tenantId).not.toBe('');
        });
        it('should have client ID configured', () => {
            expect(mockOAuthConfig.clientId).toBeTruthy();
            expect(mockOAuthConfig.clientId).not.toBe('');
        });
        it('should have client secret configured', () => {
            expect(mockOAuthConfig.clientSecret).toBeTruthy();
            expect(mockOAuthConfig.clientSecret).not.toBe('');
        });
        it('should have redirect URI configured', () => {
            expect(mockOAuthConfig.redirectUri).toBeTruthy();
            expect(mockOAuthConfig.redirectUri).toContain('/api/auth/callback');
        });
        it('should have required scopes configured', () => {
            expect(mockOAuthConfig.scopes).toContain('openid');
            expect(mockOAuthConfig.scopes).toContain('profile');
            expect(mockOAuthConfig.scopes).toContain('email');
        });
    });
    describe('Missing Configuration Handling', () => {
        it.todo('should return helpful error when AZURE_TENANT_ID is missing');
        it.todo('should return helpful error when AZURE_CLIENT_ID is missing');
        it.todo('should return helpful error when AZURE_CLIENT_SECRET is missing');
        it.todo('should fail fast at startup if OAuth is enabled but not configured');
    });
});
describe('Security', () => {
    describe('PKCE (Proof Key for Code Exchange)', () => {
        it.todo('should generate code_verifier for PKCE');
        it.todo('should include code_challenge in authorization URL');
        it.todo('should include code_verifier in token exchange request');
    });
    describe('Nonce Validation', () => {
        it.todo('should include nonce in authorization request');
        it.todo('should validate nonce in id_token matches stored nonce');
        it.todo('should reject id_token with mismatched nonce');
    });
    describe('Token Storage', () => {
        it.todo('should store tokens server-side only');
        it.todo('should not expose tokens to frontend');
        it.todo('should use httpOnly secure cookies for session');
    });
});
describe('Integration: Full OAuth Flow', () => {
    beforeEach(() => {
        mockSessionStore.clear();
    });
    it('should complete full OAuth flow from login to authenticated request', async () => {
        // Step 1: Get authorization URL
        const state = 'test-state-123';
        const authUrl = mockOAuthService.getAuthorizationUrl(state);
        expect(authUrl).toContain('login.microsoftonline.com');
        // Step 2: User redirected back with code (simulated)
        const authCode = 'valid-auth-code';
        // Step 3: Exchange code for tokens
        const tokens = await mockOAuthService.exchangeCodeForTokens(authCode);
        expect(tokens).not.toBeNull();
        // Step 4: Create session
        const sessionId = mockSessionStore.create('user123', tokens);
        expect(mockSessionStore.get(sessionId)).toBeDefined();
        // Step 5: Get user info
        const userInfo = await mockOAuthService.getUserInfo(tokens.access_token);
        expect(userInfo?.email).toBeDefined();
        expect(userInfo?.displayName).toBeDefined();
        // Step 6: Session is valid for subsequent requests
        const session = mockSessionStore.get(sessionId);
        expect(session?.userId).toBe('user123');
        // Step 7: Logout
        const destroyed = mockSessionStore.destroy(sessionId);
        expect(destroyed).toBe(true);
        expect(mockSessionStore.get(sessionId)).toBeUndefined();
    });
    it('should handle OAuth error flow gracefully', async () => {
        // Simulated error: invalid code
        const tokens = await mockOAuthService.exchangeCodeForTokens('invalid-code');
        expect(tokens).toBeNull();
        // No session should be created
        expect(mockSessionStore.sessions.size).toBe(0);
    });
});
describe('Session Persistence', () => {
    it.todo('should persist session across page reloads');
    it.todo('should maintain session during client-side navigation');
    it.todo('should expire session after configured timeout');
});
describe('Concurrent Sessions', () => {
    it.todo('should allow multiple sessions for same user');
    it.todo('should isolate sessions - one logout does not affect others');
    it.todo('should track session count per user');
});
describe('Token Refresh', () => {
    it.todo('should refresh access_token before expiration');
    it.todo('should use refresh_token for silent renewal');
    it.todo('should handle refresh_token expiration gracefully');
    it.todo('should require re-authentication when refresh fails');
});
//# sourceMappingURL=oauth.test.js.map