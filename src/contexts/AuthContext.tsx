import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

/**
 * Auth context for Microsoft Entra External Identities (CIAM).
 * 
 * CIAM handles both sign-in and sign-up in a single OAuth flow — users without
 * accounts get a self-service registration form from Microsoft. This supports
 * social identity providers (Google, Facebook, etc.) alongside Microsoft accounts.
 */

export interface User {
  id: string;
  email: string;
  name?: string;
}

/**
 * Supported OAuth providers for Entra External Identities.
 * Currently only Microsoft is wired up, but CIAM supports adding social providers.
 */
export type OAuthProvider = 'microsoft' | 'google' | 'facebook';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Initiate OAuth login via the specified provider (defaults to Microsoft) */
  login: (provider?: OAuthProvider) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      // Token is now in HttpOnly cookie — browser sends it automatically
      const response = await fetch('/api/auth/oauth/me', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback((provider: OAuthProvider = 'microsoft') => {
    // Redirect to CIAM OAuth login endpoint
    // The backend handles provider-specific configuration via Entra External Identities
    // CIAM combines sign-in and sign-up — new users get a self-service registration form
    const params = new URLSearchParams({ provider });
    window.location.href = `/api/auth/oauth/login?${params}`;
  }, []);

  const logout = useCallback(async () => {
    try {
      // Server clears HttpOnly cookie and redirects to CIAM logout
      window.location.href = '/api/auth/oauth/logout';
    } finally {
      setUser(null);
    }
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
