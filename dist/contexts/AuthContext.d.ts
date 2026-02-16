import { ReactNode } from 'react';
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
interface AuthProviderProps {
    children: ReactNode;
}
export declare function AuthProvider({ children }: AuthProviderProps): import("react/jsx-runtime").JSX.Element;
export declare function useAuth(): AuthContextType;
export {};
//# sourceMappingURL=AuthContext.d.ts.map