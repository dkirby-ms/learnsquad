/**
 * Game page - Main game view with lazy loading.
 * 
 * Uses React.lazy to code-split the GameWorld component for better
 * initial load performance.
 */

import React, { Suspense, lazy } from 'react';
import { useAuth } from '../contexts';
import styles from './GamePage.module.css';

// Lazy load the GameWorld component
const GameWorld = lazy(() =>
  import('../components/GameWorld/index.js').then((mod) => ({ default: mod.GameWorld }))
);

function LoadingScreen() {
  return (
    <div className={styles.loading}>
      <div className={styles.spinner} />
      <p>Loading game...</p>
    </div>
  );
}

function UnauthenticatedScreen() {
  const { login } = useAuth();

  return (
    <div className={styles.unauthenticated}>
      <h1>Sign In Required</h1>
      <p>You need to be signed in to play the game.</p>
      <button className={styles.signInButton} onClick={() => login()}>
        Sign In
      </button>
    </div>
  );
}

// Get WebSocket URL from env or default to localhost:3000 in development
// Helper function to access Vite env at runtime (avoids tsc import.meta issues)
const getWsUrl = (): string => {
  try {
    // @ts-ignore - import.meta.env exists at runtime in Vite
    return import.meta.env.VITE_WS_URL || 'ws://localhost:3000';
  } catch {
    return 'ws://localhost:3000';
  }
};

export function GamePage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const WS_URL = getWsUrl();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <UnauthenticatedScreen />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <GameWorld gameId={user?.id} wsUrl={WS_URL} />
    </Suspense>
  );
}

export default GamePage;
