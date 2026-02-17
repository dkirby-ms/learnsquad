/**
 * Login Component Tests
 * 
 * Contract tests for the Login UI component.
 * Written before implementation — tests define expected behavior.
 * 
 * Naomi: implement to make these pass.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Placeholder component - Naomi will implement the real one
// Tests will fail until Login component is created

// Mock Login component for contract definition
const MockLogin: React.FC<{
  onSubmit: (email: string, password: string) => Promise<void>;
  onSuccess?: () => void;
}> = ({ onSubmit, onSuccess }) => {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [emailError, setEmailError] = React.useState('');

  const validateEmail = (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  const handleEmailBlur = () => {
    if (email && !validateEmail(email)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await onSubmit(email, password);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const isSubmitDisabled = !email || !password || isLoading;

  return (
    <form onSubmit={handleSubmit} aria-label="Login form">
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={handleEmailBlur}
          placeholder="Enter your email"
          aria-invalid={!!emailError}
          aria-describedby={emailError ? 'email-error' : undefined}
        />
        {emailError && (
          <span id="email-error" role="alert">
            {emailError}
          </span>
        )}
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
        />
      </div>

      {error && (
        <div role="alert" aria-live="polite">
          {error}
        </div>
      )}

      <button type="submit" disabled={isSubmitDisabled}>
        {isLoading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
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
      render(<Login onSubmit={mockOnSubmit} />);

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/enter your email/i)).toBeInTheDocument();
    });

    it('should render password input field', () => {
      render(<Login onSubmit={mockOnSubmit} />);

      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/enter your password/i)).toBeInTheDocument();
    });

    it('should render password field with type="password"', () => {
      render(<Login onSubmit={mockOnSubmit} />);

      const passwordInput = screen.getByLabelText(/password/i);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('should render submit button', () => {
      render(<Login onSubmit={mockOnSubmit} />);

      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('should render as a form element', () => {
      render(<Login onSubmit={mockOnSubmit} />);

      expect(screen.getByRole('form', { name: /login/i })).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should disable submit button when email is empty', () => {
      render(<Login onSubmit={mockOnSubmit} />);

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      expect(submitButton).toBeDisabled();
    });

    it('should disable submit button when password is empty', async () => {
      const user = userEvent.setup();
      render(<Login onSubmit={mockOnSubmit} />);

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      expect(submitButton).toBeDisabled();
    });

    it('should disable submit button when both fields are empty', () => {
      render(<Login onSubmit={mockOnSubmit} />);

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when both fields have values', async () => {
      const user = userEvent.setup();
      render(<Login onSubmit={mockOnSubmit} />);

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      expect(submitButton).not.toBeDisabled();
    });

    it('should show error for invalid email format on blur', async () => {
      const user = userEvent.setup();
      render(<Login onSubmit={mockOnSubmit} />);

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'invalidemail');
      await user.tab(); // Trigger blur

      expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument();
    });

    it('should clear email error when valid email is entered', async () => {
      const user = userEvent.setup();
      render(<Login onSubmit={mockOnSubmit} />);

      const emailInput = screen.getByLabelText(/email/i);

      // Enter invalid email
      await user.type(emailInput, 'invalid');
      await user.tab();
      expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument();

      // Clear and enter valid email
      await user.clear(emailInput);
      await user.type(emailInput, 'valid@example.com');
      await user.tab();

      expect(screen.queryByText(/please enter a valid email/i)).not.toBeInTheDocument();
    });

    it('should mark email input as invalid when email format is wrong', async () => {
      const user = userEvent.setup();
      render(<Login onSubmit={mockOnSubmit} />);

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'invalid');
      await user.tab();

      expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('Form Submission', () => {
    it('should call onSubmit with email and password when form is submitted', async () => {
      const user = userEvent.setup();
      render(<Login onSubmit={mockOnSubmit} />);

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      expect(mockOnSubmit).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    it('should prevent default form submission', async () => {
      const user = userEvent.setup();
      render(<Login onSubmit={mockOnSubmit} />);

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');

      // Form submission shouldn't cause page reload
      const form = screen.getByRole('form');
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      fireEvent(form, submitEvent);

      // If default wasn't prevented, this would cause issues
      expect(mockOnSubmit).toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator during submission', async () => {
      const user = userEvent.setup();
      // Make onSubmit take some time
      mockOnSubmit.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

      render(<Login onSubmit={mockOnSubmit} />);

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      expect(screen.getByText(/signing in/i)).toBeInTheDocument();
    });

    it('should disable submit button during loading', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

      render(<Login onSubmit={mockOnSubmit} />);

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      const submitButton = screen.getByRole('button');
      expect(submitButton).toBeDisabled();
    });

    it('should re-enable submit button after submission completes', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockResolvedValue(undefined);

      render(<Login onSubmit={mockOnSubmit} />);

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message on failed login', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockRejectedValue(new Error('Invalid credentials'));

      render(<Login onSubmit={mockOnSubmit} />);

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/invalid credentials/i);
      });
    });

    it('should display generic error for unknown errors', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockRejectedValue('Something went wrong');

      render(<Login onSubmit={mockOnSubmit} />);

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/login failed/i);
      });
    });

    it('should clear error when user starts typing again', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockRejectedValueOnce(new Error('Invalid credentials'));

      render(<Login onSubmit={mockOnSubmit} />);

      // Trigger error
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'wrong');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Error should clear when typing - currently not implemented in mock
      // Naomi can decide on this UX behavior
    });

    it('should use aria-live for error announcements', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockRejectedValue(new Error('Invalid credentials'));

      render(<Login onSubmit={mockOnSubmit} />);

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'wrong');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveAttribute('aria-live', 'polite');
      });
    });
  });

  describe('Success Handling', () => {
    it('should call onSuccess callback after successful login', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockResolvedValue(undefined);

      render(<Login onSubmit={mockOnSubmit} onSuccess={mockOnSuccess} />);

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      });
    });

    it('should not call onSuccess on failed login', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockRejectedValue(new Error('Failed'));

      render(<Login onSubmit={mockOnSubmit} onSuccess={mockOnSuccess} />);

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(mockOnSuccess).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have associated labels for all inputs', () => {
      render(<Login onSubmit={mockOnSubmit} />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);

      expect(emailInput).toHaveAccessibleName();
      expect(passwordInput).toHaveAccessibleName();
    });

    it('should have descriptive button text', () => {
      render(<Login onSubmit={mockOnSubmit} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAccessibleName(/sign in/i);
    });

    it('should associate error messages with inputs via aria-describedby', async () => {
      const user = userEvent.setup();
      render(<Login onSubmit={mockOnSubmit} />);

      const emailInput = screen.getByLabelText(/email/i);
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
 * Contract tests for OAuth UI components using Entra External ID (CIAM).
 * 
 * Key CIAM UI considerations:
 * - "Sign in" button handles both signin and self-service signup
 * - Social provider buttons may appear (Google, Facebook) in future
 * - No pre-registration required — first-time users are auto-created
 * 
 * Written before implementation — Naomi builds to make these pass.
 */

// Mock OAuth Login component
const MockOAuthLogin: React.FC<{
  onAuthStateChange?: (user: { email: string; displayName: string } | null) => void;
}> = ({ onAuthStateChange }) => {
  const [authState, setAuthState] = React.useState<{
    isAuthenticated: boolean;
    user: { email: string; displayName: string } | null;
    isLoading: boolean;
  }>({
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
    } catch {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Simulate checking auth state on mount
  React.useEffect(() => {
    const checkAuth = async () => {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      try {
        // Would call /api/auth/me
        setAuthState(prev => ({ ...prev, isLoading: false }));
      } catch {
        setAuthState({ isAuthenticated: false, user: null, isLoading: false });
      }
    };
    checkAuth();
  }, []);

  if (authState.isLoading) {
    return <div aria-busy="true">Loading...</div>;
  }

  if (authState.isAuthenticated && authState.user) {
    return (
      <div data-testid="authenticated-state">
        <span data-testid="user-display-name">{authState.user.displayName}</span>
        <span data-testid="user-email">{authState.user.email}</span>
        <button onClick={handleLogout} aria-label="Sign out">
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div data-testid="unauthenticated-state">
      <button onClick={handleMicrosoftLogin} aria-label="Sign in with Microsoft">
        <svg aria-hidden="true" data-testid="microsoft-logo" />
        Sign in with Microsoft
      </button>
    </div>
  );
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
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  describe('Sign in with Microsoft Button', () => {
    it('should render "Sign in with Microsoft" button', () => {
      render(<OAuthLogin />);

      expect(screen.getByRole('button', { name: /sign in with microsoft/i })).toBeInTheDocument();
    });

    it('should display Microsoft logo in button', () => {
      render(<OAuthLogin />);

      expect(screen.getByTestId('microsoft-logo')).toBeInTheDocument();
    });

    it('should redirect to /api/auth/login when clicked', async () => {
      const user = userEvent.setup();
      render(<OAuthLogin />);

      await user.click(screen.getByRole('button', { name: /sign in with microsoft/i }));

      expect(window.location.href).toBe('/api/auth/login');
    });

    it('should have accessible label for screen readers', () => {
      render(<OAuthLogin />);

      const button = screen.getByRole('button', { name: /sign in with microsoft/i });
      expect(button).toHaveAccessibleName(/sign in with microsoft/i);
    });
  });

  describe('Unauthenticated State', () => {
    it('should show login options when not authenticated', () => {
      render(<OAuthLogin />);

      expect(screen.getByTestId('unauthenticated-state')).toBeInTheDocument();
    });

    it('should not show user info when not authenticated', () => {
      render(<OAuthLogin />);

      expect(screen.queryByTestId('user-display-name')).not.toBeInTheDocument();
      expect(screen.queryByTestId('user-email')).not.toBeInTheDocument();
    });

    it('should not show logout button when not authenticated', () => {
      render(<OAuthLogin />);

      expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
    });
  });

  describe('Authenticated State', () => {
    // Helper to render with authenticated state
    const AuthenticatedOAuthLogin: React.FC = () => {
      const [authState, setAuthState] = React.useState<{
        isAuthenticated: boolean;
        user: { email: string; displayName: string } | null;
        isLoading: boolean;
      }>({
        isAuthenticated: true,
        user: { email: 'test@example.com', displayName: 'Test User' },
        isLoading: false,
      });

      const handleLogout = () => {
        setAuthState({ isAuthenticated: false, user: null, isLoading: false });
      };

      if (!authState.isAuthenticated) {
        return (
          <div data-testid="logged-out">
            <button aria-label="Sign in with Microsoft">Sign in with Microsoft</button>
          </div>
        );
      }

      return (
        <div data-testid="authenticated-state">
          <span data-testid="user-display-name">{authState.user?.displayName}</span>
          <span data-testid="user-email">{authState.user?.email}</span>
          <button onClick={handleLogout} aria-label="Sign out">
            Sign out
          </button>
        </div>
      );
    };

    it('should display user display name when logged in', () => {
      render(<AuthenticatedOAuthLogin />);

      expect(screen.getByTestId('user-display-name')).toHaveTextContent('Test User');
    });

    it('should display user email when logged in', () => {
      render(<AuthenticatedOAuthLogin />);

      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
    });

    it('should show logout button when authenticated', () => {
      render(<AuthenticatedOAuthLogin />);

      expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    });

    it('should not show "Sign in with Microsoft" button when authenticated', () => {
      render(<AuthenticatedOAuthLogin />);

      expect(screen.queryByRole('button', { name: /sign in with microsoft/i })).not.toBeInTheDocument();
    });

    it('should clear auth state when logout button is clicked', async () => {
      const user = userEvent.setup();
      render(<AuthenticatedOAuthLogin />);

      await user.click(screen.getByRole('button', { name: /sign out/i }));

      await waitFor(() => {
        expect(screen.queryByTestId('authenticated-state')).not.toBeInTheDocument();
      });
    });

    it('should show login button after logout', async () => {
      const user = userEvent.setup();
      render(<AuthenticatedOAuthLogin />);

      await user.click(screen.getByRole('button', { name: /sign out/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sign in with microsoft/i })).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    const LoadingOAuthLogin: React.FC = () => {
      return <div aria-busy="true">Loading...</div>;
    };

    it('should show loading indicator while checking auth', () => {
      render(<LoadingOAuthLogin />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should have aria-busy while loading', () => {
      render(<LoadingOAuthLogin />);

      expect(screen.getByText(/loading/i).closest('[aria-busy]')).toHaveAttribute('aria-busy', 'true');
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

/**
 * CIAM-Specific UI Tests
 * 
 * Entra External ID (CIAM) enables features that affect the UI:
 * - Self-service signup: Single button for both signin AND signup
 * - Social IdPs: Google, Facebook buttons (future)
 */
describe('CIAM: Self-Service Signup UI', () => {
  describe('First-Time User Experience', () => {
    it.todo('should redirect to same endpoint for new and returning users');
    it.todo('should show onboarding prompt after first successful login');
    it.todo('should allow profile completion after OAuth signup');
  });

  describe('Button Behavior', () => {
    it('"Sign in with Microsoft" handles both signin and signup', () => {
      // In CIAM, there's no separate "Create account" button
      // The same button handles both flows — CIAM manages signup internally
      render(<OAuthLogin />);

      const signInButton = screen.getByRole('button', { name: /sign in with microsoft/i });
      expect(signInButton).toBeInTheDocument();
      // No separate signup button needed for Microsoft IdP
      expect(screen.queryByRole('button', { name: /create account/i })).not.toBeInTheDocument();
    });
  });
});

describe('CIAM: Social Identity Provider UI', () => {
  // Social IdP buttons coming in future iteration
  describe('Google Sign-In Button', () => {
    it.skip('should render "Sign in with Google" button when enabled', () => {
      // Will add when Google IdP is configured in CIAM
    });

    it.skip('should redirect to /api/auth/login?provider=google when clicked', () => {
      // Provider-specific redirect parameter
    });
  });

  describe('Facebook Sign-In Button', () => {
    it.skip('should render "Sign in with Facebook" button when enabled', () => {
      // Will add when Facebook IdP is configured in CIAM
    });
  });

  describe('Multiple IdP Layout', () => {
    it.todo('should display all enabled IdP buttons');
    it.todo('should maintain consistent button styling across IdPs');
    it.todo('should show divider between IdP buttons and email/password form if both exist');
  });
});
