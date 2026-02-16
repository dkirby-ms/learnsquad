import React, { useState, FormEvent, ChangeEvent } from 'react';
import styles from './Login.module.css';
import { useAuth, OAuthProvider } from '../../contexts';

/**
 * Login component for Microsoft Entra External Identities (CIAM).
 * 
 * CIAM provides unified sign-in/sign-up — users without accounts get a
 * self-service registration form from Microsoft. No separate registration
 * page needed from us.
 * 
 * Architecture note: OAuth provider buttons are designed to be extensible.
 * When we add social providers (Google, Facebook, etc.), add new buttons
 * that call handleOAuthSignIn with the appropriate provider.
 */

interface LoginFormData {
  email: string;
  password: string;
}

interface LoginFormErrors {
  email?: string;
  password?: string;
}

interface LoginProps {
  onLoginSuccess?: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateForm(data: LoginFormData): LoginFormErrors {
  const errors: LoginFormErrors = {};
  
  if (!data.email.trim()) {
    errors.email = 'Email is required';
  } else if (!EMAIL_REGEX.test(data.email)) {
    errors.email = 'Please enter a valid email address';
  }
  
  if (!data.password) {
    errors.password = 'Password is required';
  }
  
  return errors;
}

// Microsoft logo SVG component
function MicrosoftLogo() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 21 21">
      <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
      <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
    </svg>
  );
}

// Future: Add GoogleLogo, FacebookLogo components when social providers are enabled

export function Login({ onLoginSuccess }: LoginProps) {
  const { login: oauthLogin } = useAuth();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<LoginFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Handle OAuth sign-in via CIAM.
   * This initiates the External Identities flow which handles both sign-in and sign-up.
   */
  const handleOAuthSignIn = (provider: OAuthProvider) => {
    oauthLogin(provider);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof LoginFormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
    if (serverError) {
      setServerError(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);
    setServerError(null);

    try {
      const response = await fetch('/api/auth/login/dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Login failed. Please check your credentials.');
      }

      onLoginSuccess?.();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.form}>
        <h1 className={styles.title}>Sign In</h1>
        
        {serverError && (
          <div className={styles.serverError} role="alert">
            {serverError}
          </div>
        )}

        <button
          type="button"
          className={styles.microsoftButton}
          onClick={() => handleOAuthSignIn('microsoft')}
          aria-label="Sign in with Microsoft"
        >
          <MicrosoftLogo />
          <span>Sign in with Microsoft</span>
        </button>

        {/* 
          Future social providers: Add buttons here when CIAM social providers are configured.
          Example:
          <button onClick={() => handleOAuthSignIn('google')}>Sign in with Google</button>
          <button onClick={() => handleOAuthSignIn('facebook')}>Sign in with Facebook</button>
        */}

        {!showEmailForm ? (
          <button
            type="button"
            className={styles.emailToggle}
            onClick={() => setShowEmailForm(true)}
          >
            Use email instead
          </button>
        ) : (
          <>
            <div className={styles.divider}>
              <span>or</span>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div className={styles.field}>
                <label htmlFor="email" className={styles.label}>Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
                  disabled={isLoading}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                />
                {errors.email && (
                  <span id="email-error" className={styles.fieldError}>{errors.email}</span>
                )}
              </div>

              <div className={styles.field}>
                <label htmlFor="password" className={styles.label}>Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
                  disabled={isLoading}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                />
                {errors.password && (
                  <span id="password-error" className={styles.fieldError}>{errors.password}</span>
                )}
              </div>

              <button 
                type="submit" 
                className={styles.submitButton}
                disabled={isLoading}
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default Login;
