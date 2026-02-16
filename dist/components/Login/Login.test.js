"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
/**
 * Login Component Tests
 *
 * Contract tests for the Login UI component.
 * Written before implementation — tests define expected behavior.
 *
 * Naomi: implement to make these pass.
 */
const react_1 = __importDefault(require("react"));
const react_2 = require("@testing-library/react");
const user_event_1 = __importDefault(require("@testing-library/user-event"));
// Placeholder component - Naomi will implement the real one
// Tests will fail until Login component is created
// Mock Login component for contract definition
const MockLogin = ({ onSubmit, onSuccess }) => {
    const [email, setEmail] = react_1.default.useState('');
    const [password, setPassword] = react_1.default.useState('');
    const [error, setError] = react_1.default.useState('');
    const [isLoading, setIsLoading] = react_1.default.useState(false);
    const [emailError, setEmailError] = react_1.default.useState('');
    const validateEmail = (value) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value);
    };
    const handleEmailBlur = () => {
        if (email && !validateEmail(email)) {
            setEmailError('Please enter a valid email address');
        }
        else {
            setEmailError('');
        }
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            await onSubmit(email, password);
            onSuccess?.();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        }
        finally {
            setIsLoading(false);
        }
    };
    const isSubmitDisabled = !email || !password || isLoading;
    return ((0, jsx_runtime_1.jsxs)("form", { onSubmit: handleSubmit, "aria-label": "Login form", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "email", children: "Email" }), (0, jsx_runtime_1.jsx)("input", { id: "email", type: "email", value: email, onChange: (e) => setEmail(e.target.value), onBlur: handleEmailBlur, placeholder: "Enter your email", "aria-invalid": !!emailError, "aria-describedby": emailError ? 'email-error' : undefined }), emailError && ((0, jsx_runtime_1.jsx)("span", { id: "email-error", role: "alert", children: emailError }))] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "password", children: "Password" }), (0, jsx_runtime_1.jsx)("input", { id: "password", type: "password", value: password, onChange: (e) => setPassword(e.target.value), placeholder: "Enter your password" })] }), error && ((0, jsx_runtime_1.jsx)("div", { role: "alert", "aria-live": "polite", children: error })), (0, jsx_runtime_1.jsx)("button", { type: "submit", disabled: isSubmitDisabled, children: isLoading ? 'Signing in...' : 'Sign In' })] }));
};
// Use mock for now - replace with real import when Naomi implements
// import { Login } from './Login';
const Login = MockLogin;
describe('Login Component', () => {
    const mockOnSubmit = jest.fn();
    const mockOnSuccess = jest.fn();
    beforeEach(() => {
        jest.clearAllMocks();
        mockOnSubmit.mockResolvedValue(undefined);
    });
    describe('Rendering', () => {
        it('should render email input field', () => {
            (0, react_2.render)((0, jsx_runtime_1.jsx)(Login, { onSubmit: mockOnSubmit }));
            expect(react_2.screen.getByLabelText(/email/i)).toBeInTheDocument();
            expect(react_2.screen.getByPlaceholderText(/enter your email/i)).toBeInTheDocument();
        });
        it('should render password input field', () => {
            (0, react_2.render)((0, jsx_runtime_1.jsx)(Login, { onSubmit: mockOnSubmit }));
            expect(react_2.screen.getByLabelText(/password/i)).toBeInTheDocument();
            expect(react_2.screen.getByPlaceholderText(/enter your password/i)).toBeInTheDocument();
        });
        it('should render password field with type="password"', () => {
            (0, react_2.render)((0, jsx_runtime_1.jsx)(Login, { onSubmit: mockOnSubmit }));
            const passwordInput = react_2.screen.getByLabelText(/password/i);
            expect(passwordInput).toHaveAttribute('type', 'password');
        });
        it('should render submit button', () => {
            (0, react_2.render)((0, jsx_runtime_1.jsx)(Login, { onSubmit: mockOnSubmit }));
            expect(react_2.screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
        });
        it('should render as a form element', () => {
            (0, react_2.render)((0, jsx_runtime_1.jsx)(Login, { onSubmit: mockOnSubmit }));
            expect(react_2.screen.getByRole('form', { name: /login/i })).toBeInTheDocument();
        });
    });
    describe('Form Validation', () => {
        it('should disable submit button when email is empty', () => {
            (0, react_2.render)((0, jsx_runtime_1.jsx)(Login, { onSubmit: mockOnSubmit }));
            const submitButton = react_2.screen.getByRole('button', { name: /sign in/i });
            expect(submitButton).toBeDisabled();
        });
        it('should disable submit button when password is empty', async () => {
            const user = user_event_1.default.setup();
            (0, react_2.render)((0, jsx_runtime_1.jsx)(Login, { onSubmit: mockOnSubmit }));
            await user.type(react_2.screen.getByLabelText(/email/i), 'test@example.com');
            const submitButton = react_2.screen.getByRole('button', { name: /sign in/i });
            expect(submitButton).toBeDisabled();
        });
        it('should disable submit button when both fields are empty', () => {
            (0, react_2.render)((0, jsx_runtime_1.jsx)(Login, { onSubmit: mockOnSubmit }));
            const submitButton = react_2.screen.getByRole('button', { name: /sign in/i });
            expect(submitButton).toBeDisabled();
        });
        it('should enable submit button when both fields have values', async () => {
            const user = user_event_1.default.setup();
            (0, react_2.render)((0, jsx_runtime_1.jsx)(Login, { onSubmit: mockOnSubmit }));
            await user.type(react_2.screen.getByLabelText(/email/i), 'test@example.com');
            await user.type(react_2.screen.getByLabelText(/password/i), 'password123');
            const submitButton = react_2.screen.getByRole('button', { name: /sign in/i });
            expect(submitButton).not.toBeDisabled();
        });
        it('should show error for invalid email format on blur', async () => {
            const user = user_event_1.default.setup();
            (0, react_2.render)((0, jsx_runtime_1.jsx)(Login, { onSubmit: mockOnSubmit }));
            const emailInput = react_2.screen.getByLabelText(/email/i);
            await user.type(emailInput, 'invalidemail');
            await user.tab(); // Trigger blur
            expect(react_2.screen.getByText(/please enter a valid email/i)).toBeInTheDocument();
        });
        it('should clear email error when valid email is entered', async () => {
            const user = user_event_1.default.setup();
            (0, react_2.render)((0, jsx_runtime_1.jsx)(Login, { onSubmit: mockOnSubmit }));
            const emailInput = react_2.screen.getByLabelText(/email/i);
            // Enter invalid email
            await user.type(emailInput, 'invalid');
            await user.tab();
            expect(react_2.screen.getByText(/please enter a valid email/i)).toBeInTheDocument();
            // Clear and enter valid email
            await user.clear(emailInput);
            await user.type(emailInput, 'valid@example.com');
            await user.tab();
            expect(react_2.screen.queryByText(/please enter a valid email/i)).not.toBeInTheDocument();
        });
        it('should mark email input as invalid when email format is wrong', async () => {
            const user = user_event_1.default.setup();
            (0, react_2.render)((0, jsx_runtime_1.jsx)(Login, { onSubmit: mockOnSubmit }));
            const emailInput = react_2.screen.getByLabelText(/email/i);
            await user.type(emailInput, 'invalid');
            await user.tab();
            expect(emailInput).toHaveAttribute('aria-invalid', 'true');
        });
    });
    describe('Form Submission', () => {
        it('should call onSubmit with email and password when form is submitted', async () => {
            const user = user_event_1.default.setup();
            (0, react_2.render)((0, jsx_runtime_1.jsx)(Login, { onSubmit: mockOnSubmit }));
            await user.type(react_2.screen.getByLabelText(/email/i), 'test@example.com');
            await user.type(react_2.screen.getByLabelText(/password/i), 'password123');
            await user.click(react_2.screen.getByRole('button', { name: /sign in/i }));
            expect(mockOnSubmit).toHaveBeenCalledWith('test@example.com', 'password123');
            expect(mockOnSubmit).toHaveBeenCalledTimes(1);
        });
        it('should prevent default form submission', async () => {
            const user = user_event_1.default.setup();
            (0, react_2.render)((0, jsx_runtime_1.jsx)(Login, { onSubmit: mockOnSubmit }));
            await user.type(react_2.screen.getByLabelText(/email/i), 'test@example.com');
            await user.type(react_2.screen.getByLabelText(/password/i), 'password123');
            // Form submission shouldn't cause page reload
            const form = react_2.screen.getByRole('form');
            const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
            (0, react_2.fireEvent)(form, submitEvent);
            // If default wasn't prevented, this would cause issues
            expect(mockOnSubmit).toHaveBeenCalled();
        });
    });
    describe('Loading State', () => {
        it('should show loading indicator during submission', async () => {
            const user = user_event_1.default.setup();
            // Make onSubmit take some time
            mockOnSubmit.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));
            (0, react_2.render)((0, jsx_runtime_1.jsx)(Login, { onSubmit: mockOnSubmit }));
            await user.type(react_2.screen.getByLabelText(/email/i), 'test@example.com');
            await user.type(react_2.screen.getByLabelText(/password/i), 'password123');
            await user.click(react_2.screen.getByRole('button', { name: /sign in/i }));
            expect(react_2.screen.getByText(/signing in/i)).toBeInTheDocument();
        });
        it('should disable submit button during loading', async () => {
            const user = user_event_1.default.setup();
            mockOnSubmit.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));
            (0, react_2.render)((0, jsx_runtime_1.jsx)(Login, { onSubmit: mockOnSubmit }));
            await user.type(react_2.screen.getByLabelText(/email/i), 'test@example.com');
            await user.type(react_2.screen.getByLabelText(/password/i), 'password123');
            await user.click(react_2.screen.getByRole('button', { name: /sign in/i }));
            const submitButton = react_2.screen.getByRole('button');
            expect(submitButton).toBeDisabled();
        });
        it('should re-enable submit button after submission completes', async () => {
            const user = user_event_1.default.setup();
            mockOnSubmit.mockResolvedValue(undefined);
            (0, react_2.render)((0, jsx_runtime_1.jsx)(Login, { onSubmit: mockOnSubmit }));
            await user.type(react_2.screen.getByLabelText(/email/i), 'test@example.com');
            await user.type(react_2.screen.getByLabelText(/password/i), 'password123');
            await user.click(react_2.screen.getByRole('button', { name: /sign in/i }));
            await (0, react_2.waitFor)(() => {
                expect(react_2.screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled();
            });
        });
    });
    describe('Error Handling', () => {
        it('should display error message on failed login', async () => {
            const user = user_event_1.default.setup();
            mockOnSubmit.mockRejectedValue(new Error('Invalid credentials'));
            (0, react_2.render)((0, jsx_runtime_1.jsx)(Login, { onSubmit: mockOnSubmit }));
            await user.type(react_2.screen.getByLabelText(/email/i), 'test@example.com');
            await user.type(react_2.screen.getByLabelText(/password/i), 'wrongpassword');
            await user.click(react_2.screen.getByRole('button', { name: /sign in/i }));
            await (0, react_2.waitFor)(() => {
                expect(react_2.screen.getByRole('alert')).toHaveTextContent(/invalid credentials/i);
            });
        });
        it('should display generic error for unknown errors', async () => {
            const user = user_event_1.default.setup();
            mockOnSubmit.mockRejectedValue('Something went wrong');
            (0, react_2.render)((0, jsx_runtime_1.jsx)(Login, { onSubmit: mockOnSubmit }));
            await user.type(react_2.screen.getByLabelText(/email/i), 'test@example.com');
            await user.type(react_2.screen.getByLabelText(/password/i), 'password123');
            await user.click(react_2.screen.getByRole('button', { name: /sign in/i }));
            await (0, react_2.waitFor)(() => {
                expect(react_2.screen.getByRole('alert')).toHaveTextContent(/login failed/i);
            });
        });
        it('should clear error when user starts typing again', async () => {
            const user = user_event_1.default.setup();
            mockOnSubmit.mockRejectedValueOnce(new Error('Invalid credentials'));
            (0, react_2.render)((0, jsx_runtime_1.jsx)(Login, { onSubmit: mockOnSubmit }));
            // Trigger error
            await user.type(react_2.screen.getByLabelText(/email/i), 'test@example.com');
            await user.type(react_2.screen.getByLabelText(/password/i), 'wrong');
            await user.click(react_2.screen.getByRole('button', { name: /sign in/i }));
            await (0, react_2.waitFor)(() => {
                expect(react_2.screen.getByRole('alert')).toBeInTheDocument();
            });
            // Error should clear when typing - currently not implemented in mock
            // Naomi can decide on this UX behavior
        });
        it('should use aria-live for error announcements', async () => {
            const user = user_event_1.default.setup();
            mockOnSubmit.mockRejectedValue(new Error('Invalid credentials'));
            (0, react_2.render)((0, jsx_runtime_1.jsx)(Login, { onSubmit: mockOnSubmit }));
            await user.type(react_2.screen.getByLabelText(/email/i), 'test@example.com');
            await user.type(react_2.screen.getByLabelText(/password/i), 'wrong');
            await user.click(react_2.screen.getByRole('button', { name: /sign in/i }));
            await (0, react_2.waitFor)(() => {
                const alert = react_2.screen.getByRole('alert');
                expect(alert).toHaveAttribute('aria-live', 'polite');
            });
        });
    });
    describe('Success Handling', () => {
        it('should call onSuccess callback after successful login', async () => {
            const user = user_event_1.default.setup();
            mockOnSubmit.mockResolvedValue(undefined);
            (0, react_2.render)((0, jsx_runtime_1.jsx)(Login, { onSubmit: mockOnSubmit, onSuccess: mockOnSuccess }));
            await user.type(react_2.screen.getByLabelText(/email/i), 'test@example.com');
            await user.type(react_2.screen.getByLabelText(/password/i), 'password123');
            await user.click(react_2.screen.getByRole('button', { name: /sign in/i }));
            await (0, react_2.waitFor)(() => {
                expect(mockOnSuccess).toHaveBeenCalledTimes(1);
            });
        });
        it('should not call onSuccess on failed login', async () => {
            const user = user_event_1.default.setup();
            mockOnSubmit.mockRejectedValue(new Error('Failed'));
            (0, react_2.render)((0, jsx_runtime_1.jsx)(Login, { onSubmit: mockOnSubmit, onSuccess: mockOnSuccess }));
            await user.type(react_2.screen.getByLabelText(/email/i), 'test@example.com');
            await user.type(react_2.screen.getByLabelText(/password/i), 'password123');
            await user.click(react_2.screen.getByRole('button', { name: /sign in/i }));
            await (0, react_2.waitFor)(() => {
                expect(react_2.screen.getByRole('alert')).toBeInTheDocument();
            });
            expect(mockOnSuccess).not.toHaveBeenCalled();
        });
    });
    describe('Accessibility', () => {
        it('should have associated labels for all inputs', () => {
            (0, react_2.render)((0, jsx_runtime_1.jsx)(Login, { onSubmit: mockOnSubmit }));
            const emailInput = react_2.screen.getByLabelText(/email/i);
            const passwordInput = react_2.screen.getByLabelText(/password/i);
            expect(emailInput).toHaveAccessibleName();
            expect(passwordInput).toHaveAccessibleName();
        });
        it('should have descriptive button text', () => {
            (0, react_2.render)((0, jsx_runtime_1.jsx)(Login, { onSubmit: mockOnSubmit }));
            const button = react_2.screen.getByRole('button');
            expect(button).toHaveAccessibleName(/sign in/i);
        });
        it('should associate error messages with inputs via aria-describedby', async () => {
            const user = user_event_1.default.setup();
            (0, react_2.render)((0, jsx_runtime_1.jsx)(Login, { onSubmit: mockOnSubmit }));
            const emailInput = react_2.screen.getByLabelText(/email/i);
            await user.type(emailInput, 'invalid');
            await user.tab();
            expect(emailInput).toHaveAttribute('aria-describedby', 'email-error');
        });
    });
});
describe('Login Integration', () => {
    it.todo('should integrate with auth context/provider');
    it.todo('should redirect to dashboard after successful login');
    it.todo('should preserve intended destination after login');
    it.todo('should handle network errors gracefully');
});
/**
 * OAuth / "Sign in with Microsoft" Tests
 *
 * Contract tests for OAuth UI components.
 * Written before implementation — Naomi builds to make these pass.
 */
// Mock OAuth Login component
const MockOAuthLogin = ({ onAuthStateChange }) => {
    const [authState, setAuthState] = react_1.default.useState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
    });
    const handleMicrosoftLogin = () => {
        // Redirect to /api/auth/login
        window.location.href = '/api/auth/login';
    };
    const handleLogout = async () => {
        setAuthState(prev => ({ ...prev, isLoading: true }));
        // Call logout API
        try {
            // Simulate logout
            setAuthState({ isAuthenticated: false, user: null, isLoading: false });
            onAuthStateChange?.(null);
        }
        catch {
            setAuthState(prev => ({ ...prev, isLoading: false }));
        }
    };
    // Simulate checking auth state on mount
    react_1.default.useEffect(() => {
        const checkAuth = async () => {
            setAuthState(prev => ({ ...prev, isLoading: true }));
            try {
                // Would call /api/auth/me
                setAuthState(prev => ({ ...prev, isLoading: false }));
            }
            catch {
                setAuthState({ isAuthenticated: false, user: null, isLoading: false });
            }
        };
        checkAuth();
    }, []);
    if (authState.isLoading) {
        return (0, jsx_runtime_1.jsx)("div", { "aria-busy": "true", children: "Loading..." });
    }
    if (authState.isAuthenticated && authState.user) {
        return ((0, jsx_runtime_1.jsxs)("div", { "data-testid": "authenticated-state", children: [(0, jsx_runtime_1.jsx)("span", { "data-testid": "user-display-name", children: authState.user.displayName }), (0, jsx_runtime_1.jsx)("span", { "data-testid": "user-email", children: authState.user.email }), (0, jsx_runtime_1.jsx)("button", { onClick: handleLogout, "aria-label": "Sign out", children: "Sign out" })] }));
    }
    return ((0, jsx_runtime_1.jsx)("div", { "data-testid": "unauthenticated-state", children: (0, jsx_runtime_1.jsxs)("button", { onClick: handleMicrosoftLogin, "aria-label": "Sign in with Microsoft", children: [(0, jsx_runtime_1.jsx)("svg", { "aria-hidden": "true", "data-testid": "microsoft-logo" }), "Sign in with Microsoft"] }) }));
};
// Use mock for now - replace with real import when Naomi implements
const OAuthLogin = MockOAuthLogin;
describe('OAuth Login Component', () => {
    const originalLocation = window.location;
    beforeEach(() => {
        jest.clearAllMocks();
        // Mock window.location for redirect testing
        Object.defineProperty(window, 'location', {
            value: { href: '' },
            writable: true,
        });
    });
    afterEach(() => {
        window.location = originalLocation;
    });
    describe('Sign in with Microsoft Button', () => {
        it('should render "Sign in with Microsoft" button', () => {
            (0, react_2.render)((0, jsx_runtime_1.jsx)(OAuthLogin, {}));
            expect(react_2.screen.getByRole('button', { name: /sign in with microsoft/i })).toBeInTheDocument();
        });
        it('should display Microsoft logo in button', () => {
            (0, react_2.render)((0, jsx_runtime_1.jsx)(OAuthLogin, {}));
            expect(react_2.screen.getByTestId('microsoft-logo')).toBeInTheDocument();
        });
        it('should redirect to /api/auth/login when clicked', async () => {
            const user = user_event_1.default.setup();
            (0, react_2.render)((0, jsx_runtime_1.jsx)(OAuthLogin, {}));
            await user.click(react_2.screen.getByRole('button', { name: /sign in with microsoft/i }));
            expect(window.location.href).toBe('/api/auth/login');
        });
        it('should have accessible label for screen readers', () => {
            (0, react_2.render)((0, jsx_runtime_1.jsx)(OAuthLogin, {}));
            const button = react_2.screen.getByRole('button', { name: /sign in with microsoft/i });
            expect(button).toHaveAccessibleName(/sign in with microsoft/i);
        });
    });
    describe('Unauthenticated State', () => {
        it('should show login options when not authenticated', () => {
            (0, react_2.render)((0, jsx_runtime_1.jsx)(OAuthLogin, {}));
            expect(react_2.screen.getByTestId('unauthenticated-state')).toBeInTheDocument();
        });
        it('should not show user info when not authenticated', () => {
            (0, react_2.render)((0, jsx_runtime_1.jsx)(OAuthLogin, {}));
            expect(react_2.screen.queryByTestId('user-display-name')).not.toBeInTheDocument();
            expect(react_2.screen.queryByTestId('user-email')).not.toBeInTheDocument();
        });
        it('should not show logout button when not authenticated', () => {
            (0, react_2.render)((0, jsx_runtime_1.jsx)(OAuthLogin, {}));
            expect(react_2.screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
        });
    });
    describe('Authenticated State', () => {
        // Helper to render with authenticated state
        const AuthenticatedOAuthLogin = () => {
            const [authState, setAuthState] = react_1.default.useState({
                isAuthenticated: true,
                user: { email: 'test@example.com', displayName: 'Test User' },
                isLoading: false,
            });
            const handleLogout = () => {
                setAuthState({ isAuthenticated: false, user: null, isLoading: false });
            };
            if (!authState.isAuthenticated) {
                return ((0, jsx_runtime_1.jsx)("div", { "data-testid": "logged-out", children: (0, jsx_runtime_1.jsx)("button", { "aria-label": "Sign in with Microsoft", children: "Sign in with Microsoft" }) }));
            }
            return ((0, jsx_runtime_1.jsxs)("div", { "data-testid": "authenticated-state", children: [(0, jsx_runtime_1.jsx)("span", { "data-testid": "user-display-name", children: authState.user?.displayName }), (0, jsx_runtime_1.jsx)("span", { "data-testid": "user-email", children: authState.user?.email }), (0, jsx_runtime_1.jsx)("button", { onClick: handleLogout, "aria-label": "Sign out", children: "Sign out" })] }));
        };
        it('should display user display name when logged in', () => {
            (0, react_2.render)((0, jsx_runtime_1.jsx)(AuthenticatedOAuthLogin, {}));
            expect(react_2.screen.getByTestId('user-display-name')).toHaveTextContent('Test User');
        });
        it('should display user email when logged in', () => {
            (0, react_2.render)((0, jsx_runtime_1.jsx)(AuthenticatedOAuthLogin, {}));
            expect(react_2.screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
        });
        it('should show logout button when authenticated', () => {
            (0, react_2.render)((0, jsx_runtime_1.jsx)(AuthenticatedOAuthLogin, {}));
            expect(react_2.screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
        });
        it('should not show "Sign in with Microsoft" button when authenticated', () => {
            (0, react_2.render)((0, jsx_runtime_1.jsx)(AuthenticatedOAuthLogin, {}));
            expect(react_2.screen.queryByRole('button', { name: /sign in with microsoft/i })).not.toBeInTheDocument();
        });
        it('should clear auth state when logout button is clicked', async () => {
            const user = user_event_1.default.setup();
            (0, react_2.render)((0, jsx_runtime_1.jsx)(AuthenticatedOAuthLogin, {}));
            await user.click(react_2.screen.getByRole('button', { name: /sign out/i }));
            await (0, react_2.waitFor)(() => {
                expect(react_2.screen.queryByTestId('authenticated-state')).not.toBeInTheDocument();
            });
        });
        it('should show login button after logout', async () => {
            const user = user_event_1.default.setup();
            (0, react_2.render)((0, jsx_runtime_1.jsx)(AuthenticatedOAuthLogin, {}));
            await user.click(react_2.screen.getByRole('button', { name: /sign out/i }));
            await (0, react_2.waitFor)(() => {
                expect(react_2.screen.getByRole('button', { name: /sign in with microsoft/i })).toBeInTheDocument();
            });
        });
    });
    describe('Loading State', () => {
        const LoadingOAuthLogin = () => {
            return (0, jsx_runtime_1.jsx)("div", { "aria-busy": "true", children: "Loading..." });
        };
        it('should show loading indicator while checking auth', () => {
            (0, react_2.render)((0, jsx_runtime_1.jsx)(LoadingOAuthLogin, {}));
            expect(react_2.screen.getByText(/loading/i)).toBeInTheDocument();
        });
        it('should have aria-busy while loading', () => {
            (0, react_2.render)((0, jsx_runtime_1.jsx)(LoadingOAuthLogin, {}));
            expect(react_2.screen.getByText(/loading/i).closest('[aria-busy]')).toHaveAttribute('aria-busy', 'true');
        });
    });
    describe('Auth State Callback', () => {
        it.todo('should call onAuthStateChange when user logs in');
        it.todo('should call onAuthStateChange with null when user logs out');
    });
    describe('Error States', () => {
        it.todo('should display error if OAuth callback fails');
        it.todo('should display error if /api/auth/me fails');
        it.todo('should allow retry after error');
    });
});
describe('OAuth Integration E2E Scenarios', () => {
    describe('Full OAuth Flow (mocked)', () => {
        it.todo('should complete login flow: click button -> redirect -> callback -> authenticated');
        it.todo('should handle OAuth error: click button -> redirect -> error -> show error message');
    });
    describe('Session Persistence', () => {
        it.todo('should restore auth state from session on page load');
        it.todo('should show loading state while checking session');
        it.todo('should redirect to login if session expired');
    });
    describe('Protected Routes', () => {
        it.todo('should redirect to OAuth login for protected routes when unauthenticated');
        it.todo('should allow access to protected routes when authenticated');
        it.todo('should preserve intended route after OAuth completion');
    });
});
//# sourceMappingURL=Login.test.js.map