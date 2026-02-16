/**
 * GameControls - Pause/Resume, Speed controls, and connection status.
 * 
 * Designed for the game UI chrome layer (React), not the game canvas (PixiJS).
 */

import React from 'react';
import styles from './GameControls.module.css';
import { ConnectionStatus } from '../../hooks/useGameSocket';
import { useGameStatus } from '../../hooks/useGameState';
import { GameSpeed } from '../../game/types';

interface GameControlsProps {
  /** Current connection status */
  connectionStatus: ConnectionStatus;
  /** Error message if connection failed */
  connectionError: string | null;
  /** Connect to game server */
  onConnect: () => void;
  /** Disconnect from game server */
  onDisconnect: () => void;
  /** Pause the game */
  onPause: () => void;
  /** Resume the game */
  onResume: () => void;
  /** Set game speed */
  onSetSpeed: (speed: GameSpeed) => void;
}

const SPEED_OPTIONS: { value: GameSpeed; label: string }[] = [
  { value: GameSpeed.Normal, label: '1×' },
  { value: GameSpeed.Fast, label: '2×' },
  { value: GameSpeed.VeryFast, label: '5×' },
];

function getConnectionStatusLabel(status: ConnectionStatus): string {
  switch (status) {
    case ConnectionStatus.Disconnected:
      return 'Disconnected';
    case ConnectionStatus.Connecting:
      return 'Connecting...';
    case ConnectionStatus.Connected:
      return 'Connected';
    case ConnectionStatus.Reconnecting:
      return 'Reconnecting...';
    case ConnectionStatus.Error:
      return 'Error';
    default:
      return 'Unknown';
  }
}

function getConnectionStatusClass(status: ConnectionStatus): string {
  switch (status) {
    case ConnectionStatus.Connected:
      return styles.statusConnected;
    case ConnectionStatus.Connecting:
    case ConnectionStatus.Reconnecting:
      return styles.statusConnecting;
    case ConnectionStatus.Error:
      return styles.statusError;
    default:
      return styles.statusDisconnected;
  }
}

export function GameControls({
  connectionStatus,
  connectionError,
  onConnect,
  onDisconnect,
  onPause,
  onResume,
  onSetSpeed,
}: GameControlsProps) {
  const { tick, isPaused, speed, hasWorld } = useGameStatus();
  const isConnected = connectionStatus === ConnectionStatus.Connected;
  const isConnecting = connectionStatus === ConnectionStatus.Connecting ||
                       connectionStatus === ConnectionStatus.Reconnecting;

  return (
    <div className={styles.container}>
      {/* Connection Status */}
      <div className={styles.section}>
        <div className={styles.statusRow}>
          <span className={`${styles.statusIndicator} ${getConnectionStatusClass(connectionStatus)}`} />
          <span className={styles.statusLabel}>
            {getConnectionStatusLabel(connectionStatus)}
          </span>
        </div>
        {connectionError && (
          <div className={styles.errorText}>{connectionError}</div>
        )}
        <div className={styles.connectionButtons}>
          {!isConnected && !isConnecting && (
            <button
              className={styles.connectButton}
              onClick={onConnect}
            >
              Connect
            </button>
          )}
          {(isConnected || isConnecting) && (
            <button
              className={styles.disconnectButton}
              onClick={onDisconnect}
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      {/* Game Controls - only show when connected with world loaded */}
      {isConnected && hasWorld && (
        <>
          <div className={styles.divider} />

          {/* Tick Display */}
          <div className={styles.section}>
            <div className={styles.tickDisplay}>
              <span className={styles.tickLabel}>Tick</span>
              <span className={styles.tickValue}>{tick.toLocaleString()}</span>
            </div>
          </div>

          <div className={styles.divider} />

          {/* Pause/Resume */}
          <div className={styles.section}>
            {isPaused ? (
              <button
                className={styles.playButton}
                onClick={onResume}
                aria-label="Resume game"
              >
                <PlayIcon />
                <span>Resume</span>
              </button>
            ) : (
              <button
                className={styles.pauseButton}
                onClick={onPause}
                aria-label="Pause game"
              >
                <PauseIcon />
                <span>Pause</span>
              </button>
            )}
          </div>

          {/* Speed Controls */}
          <div className={styles.section}>
            <div className={styles.speedLabel}>Speed</div>
            <div className={styles.speedButtons}>
              {SPEED_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`${styles.speedButton} ${speed === option.value && !isPaused ? styles.speedActive : ''}`}
                  onClick={() => onSetSpeed(option.value)}
                  disabled={isPaused}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 2.5v11l9-5.5L4 2.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="3" y="2" width="4" height="12" />
      <rect x="9" y="2" width="4" height="12" />
    </svg>
  );
}

export default GameControls;
