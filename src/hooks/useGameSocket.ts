/**
 * React hook for WebSocket connection to the game server.
 * 
 * Handles connection lifecycle, reconnection, and message parsing.
 * Integrates with the game state store for state updates.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ServerMessage,
  ClientMessage,
  ClientMessageType,
  handleServerMessage,
  gameStateStore,
} from '../store/gameState';
import { GameSpeed } from '../game/types';

/** Connection status */
export enum ConnectionStatus {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Reconnecting = 'reconnecting',
  Error = 'error',
}

/** Configuration for the WebSocket connection */
export interface GameSocketConfig {
  /** WebSocket server URL (defaults to relative ws:// based on current host) */
  url?: string;
  /** Game ID to join on connect */
  gameId?: string;
  /** Enable automatic reconnection (default: true) */
  autoReconnect?: boolean;
  /** Reconnection delay in ms (default: 1000, max: 30000) */
  reconnectDelay?: number;
  /** Ping interval in ms (default: 30000) */
  pingInterval?: number;
}

/** Return type for useGameSocket hook */
export interface GameSocketReturn {
  /** Current connection status */
  status: ConnectionStatus;
  /** Error message if status is Error */
  error: string | null;
  /** Connect to the server */
  connect: () => void;
  /** Disconnect from the server */
  disconnect: () => void;
  /** Send a pause command */
  pause: () => void;
  /** Send a resume command */
  resume: () => void;
  /** Send a set speed command */
  setSpeed: (speed: GameSpeed) => void;
  /** Last connection attempt time */
  lastConnectAttempt: number | null;
}

const DEFAULT_CONFIG: Required<GameSocketConfig> = {
  url: '',
  gameId: '',
  autoReconnect: true,
  reconnectDelay: 1000,
  pingInterval: 30000,
};

const MAX_RECONNECT_DELAY = 30000;

/**
 * Build WebSocket URL based on current location or config.
 */
function buildWebSocketUrl(configUrl?: string, gameId?: string): string {
  if (configUrl) {
    return gameId ? `${configUrl}?gameId=${gameId}` : configUrl;
  }

  // Default: use current host with ws:// or wss://
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const path = `/ws/game${gameId ? `?gameId=${gameId}` : ''}`;
  return `${protocol}//${host}${path}`;
}

/**
 * Hook for managing WebSocket connection to game server.
 */
export function useGameSocket(config: GameSocketConfig = {}): GameSocketReturn {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);

  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.Disconnected);
  const [error, setError] = useState<string | null>(null);
  const [lastConnectAttempt, setLastConnectAttempt] = useState<number | null>(null);

  const clearTimers = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const send = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const startPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    pingIntervalRef.current = window.setInterval(() => {
      send({ type: ClientMessageType.Ping });
    }, mergedConfig.pingInterval);
  }, [send, mergedConfig.pingInterval]);

  const connect = useCallback(() => {
    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    clearTimers();

    const url = buildWebSocketUrl(mergedConfig.url, mergedConfig.gameId);
    setStatus(
      reconnectAttemptRef.current > 0
        ? ConnectionStatus.Reconnecting
        : ConnectionStatus.Connecting
    );
    setError(null);
    setLastConnectAttempt(Date.now());

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus(ConnectionStatus.Connected);
        setError(null);
        reconnectAttemptRef.current = 0;
        startPingInterval();

        // Join game if gameId specified
        if (mergedConfig.gameId) {
          send({ type: ClientMessageType.JoinGame, payload: { gameId: mergedConfig.gameId } });
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: ServerMessage = JSON.parse(event.data);
          handleServerMessage(message);
        } catch (err) {
          console.error('Failed to parse server message:', err);
        }
      };

      ws.onerror = () => {
        setError('WebSocket connection error');
        setStatus(ConnectionStatus.Error);
      };

      ws.onclose = (event) => {
        clearTimers();
        wsRef.current = null;

        if (event.wasClean) {
          setStatus(ConnectionStatus.Disconnected);
          gameStateStore.clear();
        } else if (mergedConfig.autoReconnect) {
          // Schedule reconnection with exponential backoff
          reconnectAttemptRef.current += 1;
          const delay = Math.min(
            mergedConfig.reconnectDelay * Math.pow(2, reconnectAttemptRef.current - 1),
            MAX_RECONNECT_DELAY
          );
          setStatus(ConnectionStatus.Reconnecting);
          reconnectTimeoutRef.current = window.setTimeout(connect, delay);
        } else {
          setStatus(ConnectionStatus.Disconnected);
          gameStateStore.clear();
        }
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create WebSocket');
      setStatus(ConnectionStatus.Error);
    }
  }, [mergedConfig, clearTimers, startPingInterval, send]);

  const disconnect = useCallback(() => {
    clearTimers();
    reconnectAttemptRef.current = 0;
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }
    setStatus(ConnectionStatus.Disconnected);
    gameStateStore.clear();
  }, [clearTimers]);

  const pause = useCallback(() => {
    send({ type: ClientMessageType.Pause });
  }, [send]);

  const resume = useCallback(() => {
    send({ type: ClientMessageType.Resume });
  }, [send]);

  const setSpeed = useCallback((speed: GameSpeed) => {
    send({ type: ClientMessageType.SetSpeed, payload: { speed } });
  }, [send]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmount');
      }
    };
  }, [clearTimers]);

  return {
    status,
    error,
    connect,
    disconnect,
    pause,
    resume,
    setSpeed,
    lastConnectAttempt,
  };
}
