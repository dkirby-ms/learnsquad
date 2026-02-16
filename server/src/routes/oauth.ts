import { Router, Request, Response } from 'express';
import { ConfidentialClientApplication, CryptoProvider } from '@azure/msal-node';
import jwt from 'jsonwebtoken';
import { msalConfig, SCOPES, ENTRA_CONFIG, isEntraConfigured, getCiamLogoutUrl } from '../config/entra';

const router = Router();
const cryptoProvider = new CryptoProvider();

// Lazy init MSAL client (only if configured)
let msalClient: ConfidentialClientApplication | null = null;

function getMsalClient(): ConfidentialClientApplication {
  if (!msalClient) {
    if (!isEntraConfigured()) {
      throw new Error('Entra ID not configured. Set AZURE_CLIENT_ID and AZURE_CLIENT_SECRET.');
    }
    msalClient = new ConfidentialClientApplication(msalConfig);
  }
  return msalClient;
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// In-memory PKCE state store (use Redis in production)
const stateStore: Map<string, { verifier: string; timestamp: number }> = new Map();

// Clean up old states every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of stateStore.entries()) {
    if (now - data.timestamp > 10 * 60 * 1000) { // 10 minute expiry
      stateStore.delete(state);
    }
  }
}, 5 * 60 * 1000);

function createToken(payload: object): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: 86400 });
}

// GET /api/auth/oauth/login — redirect to Entra ID
router.get('/login', async (_req: Request, res: Response) => {
  try {
    if (!isEntraConfigured()) {
      res.status(503).json({ error: 'OAuth not configured' });
      return;
    }

    const { verifier, challenge } = await cryptoProvider.generatePkceCodes();
    const state = cryptoProvider.createNewGuid();

    stateStore.set(state, { verifier, timestamp: Date.now() });

    const authUrl = await getMsalClient().getAuthCodeUrl({
      scopes: SCOPES,
      redirectUri: ENTRA_CONFIG.redirectUri,
      codeChallenge: challenge,
      codeChallengeMethod: 'S256',
      state,
    });

    res.redirect(authUrl);
  } catch (err) {
    console.error('OAuth login error:', err);
    res.status(500).json({ error: 'Failed to initiate OAuth' });
  }
});

// GET /api/auth/oauth/callback — handle OAuth callback
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      console.error('OAuth callback error:', error, error_description);
      res.redirect(`${ENTRA_CONFIG.postLogoutRedirectUri}?error=${encodeURIComponent(String(error))}`);
      return;
    }

    if (!code || !state) {
      res.status(400).json({ error: 'Missing code or state' });
      return;
    }

    const stateData = stateStore.get(String(state));
    if (!stateData) {
      res.status(400).json({ error: 'Invalid or expired state' });
      return;
    }

    stateStore.delete(String(state));

    const tokenResponse = await getMsalClient().acquireTokenByCode({
      code: String(code),
      scopes: SCOPES,
      redirectUri: ENTRA_CONFIG.redirectUri,
      codeVerifier: stateData.verifier,
    });

    if (!tokenResponse) {
      res.status(401).json({ error: 'Failed to acquire token' });
      return;
    }

    // Extract user info from ID token claims
    const account = tokenResponse.account;
    const userId = account?.localAccountId || account?.homeAccountId || `entra_${Date.now()}`;
    const email = account?.username || '';
    const name = account?.name || email;

    // Issue our own JWT for the game
    const gameToken = createToken({
      userId,
      email,
      name,
      provider: 'entra',
    });

    // Redirect to frontend with token
    res.redirect(`${ENTRA_CONFIG.postLogoutRedirectUri}?token=${gameToken}`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect(`${ENTRA_CONFIG.postLogoutRedirectUri}?error=auth_failed`);
  }
});

// GET /api/auth/oauth/logout — clear session, redirect to CIAM logout
router.get('/logout', (_req: Request, res: Response) => {
  res.redirect(getCiamLogoutUrl());
});

// GET /api/auth/oauth/me — return current user from token
router.get('/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
      name?: string;
      provider?: string;
    };

    res.json({
      id: decoded.userId,
      email: decoded.email,
      name: decoded.name || decoded.email,
      provider: decoded.provider || 'local',
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// GET /api/auth/oauth/status — check if OAuth (CIAM) is configured
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    configured: isEntraConfigured(),
    provider: 'entra-external-id', // CIAM, not regular Entra ID
  });
});

export default router;
