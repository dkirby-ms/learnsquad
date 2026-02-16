import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider, useAuth } from './contexts';
import { Login } from './components/Login';
import styles from './components/Login/Login.module.css';

function AuthenticatedApp() {
  const { user, logout } = useAuth();

  return (
    <div className={styles.container}>
      <div className={styles.form}>
        <div className={styles.userInfo}>
          <p className={styles.userName}>Welcome, {user?.name || user?.email}</p>
          {user?.name && <p className={styles.userEmail}>{user.email}</p>}
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

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.form}>
          <p style={{ color: '#e8eaed', textAlign: 'center' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <AuthenticatedApp />;
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
