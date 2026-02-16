import { Configuration } from '@azure/msal-node';

/**
 * Microsoft Entra External ID (CIAM) configuration
 * 
 * This is External Identities (formerly Azure AD B2C), NOT regular Entra ID.
 * - Regular Entra ID: For employees/organizational accounts (login.microsoftonline.com)
 * - External Identities: For consumers/customers (ciamlogin.com)
 * 
 * Key differences:
 * - Authority URL: https://{tenant}.ciamlogin.com/{tenant}.onmicrosoft.com
 * - Supports self-service signup, password reset
 * - Can enable social identity providers (Google, Facebook, etc.)
 */
export const ENTRA_CONFIG = {
  clientId: process.env.AZURE_CLIENT_ID || '',
  clientSecret: process.env.AZURE_CLIENT_SECRET || '',
  // Tenant name (NOT tenant ID) - e.g., "mycompany" from mycompany.onmicrosoft.com
  tenantName: process.env.AZURE_TENANT_NAME || '',
  redirectUri: process.env.AZURE_REDIRECT_URI || 'http://localhost:3000/api/auth/oauth/callback',
  postLogoutRedirectUri: process.env.AZURE_POST_LOGOUT_URI || 'http://localhost:5173',
};

// CIAM authority URL format: https://{tenant}.ciamlogin.com/{tenant}.onmicrosoft.com
function getCiamAuthority(): string {
  const tenant = ENTRA_CONFIG.tenantName;
  if (!tenant) {
    return ''; // Will fail validation in isEntraConfigured()
  }
  return `https://${tenant}.ciamlogin.com/${tenant}.onmicrosoft.com`;
}

export const msalConfig: Configuration = {
  auth: {
    clientId: ENTRA_CONFIG.clientId,
    authority: getCiamAuthority(),
    clientSecret: ENTRA_CONFIG.clientSecret,
    // CIAM uses different OIDC discovery URL pattern
    knownAuthorities: ENTRA_CONFIG.tenantName 
      ? [`${ENTRA_CONFIG.tenantName}.ciamlogin.com`] 
      : [],
  },
};

// CIAM scopes - User.Read not available in External Identities by default
export const SCOPES = ['openid', 'profile', 'email', 'offline_access'];

export function isEntraConfigured(): boolean {
  return !!(ENTRA_CONFIG.clientId && ENTRA_CONFIG.clientSecret && ENTRA_CONFIG.tenantName);
}

// Get CIAM logout URL (different from regular Entra ID)
export function getCiamLogoutUrl(): string {
  const tenant = ENTRA_CONFIG.tenantName;
  return `https://${tenant}.ciamlogin.com/${tenant}.onmicrosoft.com/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(ENTRA_CONFIG.postLogoutRedirectUri)}`;
}
