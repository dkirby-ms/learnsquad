"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthProvider = AuthProvider;
exports.useAuth = useAuth;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const AuthContext = (0, react_1.createContext)(null);
function AuthProvider({ children }) {
    const [user, setUser] = (0, react_1.useState)(null);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const checkAuth = (0, react_1.useCallback)(async () => {
        try {
            // Get user info from CIAM session
            const response = await fetch('/api/auth/oauth/me', {
                credentials: 'include',
            });
            if (response.ok) {
                const data = await response.json();
                setUser(data.user);
            }
            else {
                setUser(null);
            }
        }
        catch {
            setUser(null);
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    (0, react_1.useEffect)(() => {
        checkAuth();
    }, [checkAuth]);
    const login = (0, react_1.useCallback)((provider = 'microsoft') => {
        // Redirect to CIAM OAuth login endpoint
        // The backend handles provider-specific configuration via Entra External Identities
        // CIAM combines sign-in and sign-up — new users get a self-service registration form
        const params = new URLSearchParams({ provider });
        window.location.href = `/api/auth/oauth/login?${params}`;
    }, []);
    const logout = (0, react_1.useCallback)(async () => {
        try {
            // CIAM logout endpoint clears session and optionally signs out of Microsoft
            await fetch('/api/auth/oauth/logout', {
                method: 'POST',
                credentials: 'include',
            });
        }
        finally {
            setUser(null);
        }
    }, []);
    const value = {
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        checkAuth,
    };
    return (0, jsx_runtime_1.jsx)(AuthContext.Provider, { value: value, children: children });
}
function useAuth() {
    const context = (0, react_1.useContext)(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
//# sourceMappingURL=AuthContext.js.map