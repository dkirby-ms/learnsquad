import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider, useAuth } from './contexts';
import { Login } from './components/Login';
import { GamePage } from './pages';
import styles from './components/Login/Login.module.css';

/**
 * Simple hash-based routing for the MVP.
 * Routes: #/ (home/login), #/game (game view)
 */
function useHashRoute(): string {
  const [route, setRoute] = React.useState(window.location.hash || '#/');

  React.useEffect(() => {
    const handleHashChange = () => setRoute(window.location.hash || '#/');
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return route;
}

function AuthenticatedHome() {
  const { user, logout } = useAuth();

  const handlePlay = () => {
    window.location.hash = '#/game';
  };

  return (
    <div className={styles.container}>
      <div className={styles.form}>
        <div className={styles.userInfo}>
          <p className={styles.userName}>Welcome, {user?.name || user?.email}</p>
          {user?.name && <p className={styles.userEmail}>{user.email}</p>}
          <button
            className={styles.submitButton}
            onClick={handlePlay}
            style={{ marginBottom: '12px' }}
          >
            Play Game
          </button>
          <button className={styles.logoutButton} onClick={logout}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, checkAuth } = useAuth();
  const route = useHashRoute();

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.form}>
          <p style={{ color: '#e8eaed', textAlign: 'center' }}>Loading...</p>
        </div>
      </div>
    );
  }

  // Game route
  if (route === '#/game') {
    return <GamePage />;
  }

  // Home route
  if (isAuthenticated) {
    return <AuthenticatedHome />;
  }

  return <Login onLoginSuccess={checkAuth} />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
