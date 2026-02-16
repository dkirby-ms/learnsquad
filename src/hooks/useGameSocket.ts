/**
 * React hook for Colyseus room connection to the game server.
 * 
 * Handles room lifecycle, reconnection, and state synchronization.
 * Integrates with the game state store via Colyseus schema listeners.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Client, Room } from '@colyseus/sdk';
import { gameStateStore } from '../store/gameState';
import { GameSpeed, GameWorld, GameEvent, Node, EntityId, Connection } from '../game/types';

/** Connection status */
export enum ConnectionStatus {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Reconnecting = 'reconnecting',
  Error = 'error',
}

/** Configuration for the Colyseus connection */
export interface GameSocketConfig {
  /** WebSocket server URL (defaults to relative ws:// based on current host) */
  url?: string;
  /** Game ID to join on connect */
  gameId?: string;
  /** Enable automatic reconnection (default: true) */
  autoReconnect?: boolean;
  /** Reconnection delay in ms (default: 1000, max: 30000) */
  reconnectDelay?: number;
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
};

const MAX_RECONNECT_DELAY = 30000;
const ROOM_NAME = 'game';

/**
 * Build Colyseus server URL based on current location or config.
 */
function buildServerUrl(configUrl?: string): string {
  if (configUrl) {
    console.log('[Colyseus] Using configured URL:', configUrl);
    return configUrl;
  }
  // Default: use current host with ws:// or wss://
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const url = `${protocol}//${host}`;
  console.log('[Colyseus] Using default URL:', url);
  return url;
}

/**
 * Convert Colyseus room state to GameWorld for the store.
 * The Colyseus schema state is automatically synced from the server.
 */
function stateToGameWorld(state: any): GameWorld {
  // Guard against null/undefined state
  if (!state) {
    return {
      id: '',
      currentTick: 0,
      speed: GameSpeed.Paused,
      isPaused: true,
      nodes: {},
      connections: {},
      eventQueue: [],
    };
  }

  // Convert Colyseus MapSchema to plain objects
  const nodes: Record<EntityId, Node> = {};
  const connections: Record<EntityId, Connection> = {};

  if (state.nodes && typeof state.nodes.forEach === 'function') {
    state.nodes.forEach((node: any, id: string) => {
      if (node) {
        nodes[id] = nodeFromSchema(node, id);
      }
    });
  }

  if (state.connections && typeof state.connections.forEach === 'function') {
    state.connections.forEach((conn: any, id: string) => {
      if (conn) {
        connections[id] = connectionFromSchema(conn, id);
      }
    });
  }

  return {
    id: state.id ?? '',
    currentTick: state.currentTick ?? 0,
    speed: state.speed ?? GameSpeed.Paused,
    isPaused: state.isPaused ?? true,
    nodes,
    connections,
    eventQueue: [],
  };
}

function nodeFromSchema(node: any, id: string): Node {
  // Guard against undefined node
  if (!node) {
    return {
      id,
      name: '',
      position: { x: 0, y: 0 },
      status: 'neutral',
      ownerId: null,
      resources: [],
      connectionIds: [],
    };
  }

  const resources = node.resources
    ? Array.from(node.resources.values()).map((r: any) => ({
        type: r.type,
        amount: r.amount,
        regenRate: r.regenRate,
        maxCapacity: r.maxCapacity,
      }))
    : [];

  const connectionIds: EntityId[] = node.connectionIds
    ? Array.from(node.connectionIds.values()).map((id: any) => String(id))
    : [];

  // Handle nested position schema from server
  const position = node.position 
    ? { x: node.position.x ?? 0, y: node.position.y ?? 0 }
    : { x: node.x ?? 0, y: node.y ?? 0 };

  return {
    id,
    name: node.name ?? '',
    position,
    status: node.status ?? 'neutral',
    ownerId: node.ownerId || null,
    resources,
    connectionIds,
  };
}

function connectionFromSchema(conn: any, id: string): Connection {
  // Guard against undefined connection
  if (!conn) {
    return {
      id,
      fromNodeId: '',
      toNodeId: '',
      type: 'direct',
      travelTime: 1,
      isActive: true,
    };
  }

  return {
    id,
    fromNodeId: conn.fromNodeId ?? '',
    toNodeId: conn.toNodeId ?? '',
    type: conn.type ?? 'direct',
    travelTime: conn.travelTime ?? 1,
    isActive: conn.isActive ?? true,
  };
}

/**
 * Hook for managing Colyseus room connection to game server.
 */
export function useGameSocket(config: GameSocketConfig = {}): GameSocketReturn {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const clientRef = useRef<Client | null>(null);
  const roomRef = useRef<Room | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectionTokenRef = useRef<string | null>(null);

  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.Disconnected);
  const [error, setError] = useState<string | null>(null);
  const [lastConnectAttempt, setLastConnectAttempt] = useState<number | null>(null);

  const clearTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const setupRoomListeners = useCallback((room: Room) => {
    // Full state change listener
    room.onStateChange((state) => {
      console.log('[Colyseus] State change received:', state);
      const world = stateToGameWorld(state);
      console.log('[Colyseus] Converted world:', world);
      gameStateStore.applySnapshot(world);
    });

    // Handle events broadcast from server
    room.onMessage('events', (events: GameEvent[]) => {
      if (events && events.length > 0) {
        gameStateStore.addEvents(events);
      }
    });

    // Handle errors
    room.onError((code, message) => {
      console.error(`[Colyseus] Room error (${code}):`, message);
      setError(message ?? `Error code: ${code}`);
    });

    // Handle room leave
    room.onLeave((code) => {
      clearTimers();
      roomRef.current = null;

      // 1000 = normal closure, 4000+ = application-level codes
      const wasClean = code === 1000 || code >= 4000;

      if (wasClean) {
        setStatus(ConnectionStatus.Disconnected);
        gameStateStore.clear();
        reconnectionTokenRef.current = null;
      } else if (mergedConfig.autoReconnect && reconnectionTokenRef.current) {
        // Attempt reconnection with token
        reconnectAttemptRef.current += 1;
        const delay = Math.min(
          mergedConfig.reconnectDelay * Math.pow(2, reconnectAttemptRef.current - 1),
          MAX_RECONNECT_DELAY
        );
        setStatus(ConnectionStatus.Reconnecting);
        reconnectTimeoutRef.current = window.setTimeout(() => {
          attemptReconnect();
        }, delay);
      } else if (mergedConfig.autoReconnect) {
        // No token, do a fresh join
        reconnectAttemptRef.current += 1;
        const delay = Math.min(
          mergedConfig.reconnectDelay * Math.pow(2, reconnectAttemptRef.current - 1),
          MAX_RECONNECT_DELAY
        );
        setStatus(ConnectionStatus.Reconnecting);
        reconnectTimeoutRef.current = window.setTimeout(() => {
          doConnect();
        }, delay);
      } else {
        setStatus(ConnectionStatus.Disconnected);
        gameStateStore.clear();
      }
    });
  }, [mergedConfig.autoReconnect, mergedConfig.reconnectDelay, clearTimers]);

  const attemptReconnect = useCallback(async () => {
    if (!clientRef.current || !reconnectionTokenRef.current) {
      doConnect();
      return;
    }

    setStatus(ConnectionStatus.Reconnecting);
    setLastConnectAttempt(Date.now());

    try {
      const room = await clientRef.current.reconnect(reconnectionTokenRef.current);
      roomRef.current = room;
      reconnectionTokenRef.current = room.reconnectionToken;
      setupRoomListeners(room);
      setStatus(ConnectionStatus.Connected);
      setError(null);
      reconnectAttemptRef.current = 0;
    } catch (err) {
      console.warn('[Colyseus] Reconnection failed, trying fresh join:', err);
      // Fall back to fresh connection
      reconnectionTokenRef.current = null;
      doConnect();
    }
  }, [setupRoomListeners]);

  const doConnect = useCallback(async () => {
    clearTimers();

    const url = buildServerUrl(mergedConfig.url);
    setStatus(
      reconnectAttemptRef.current > 0
        ? ConnectionStatus.Reconnecting
        : ConnectionStatus.Connecting
    );
    setError(null);
    setLastConnectAttempt(Date.now());

    try {
      // Create client if needed
      if (!clientRef.current) {
        console.log('[Colyseus] Creating client with URL:', url);
        clientRef.current = new Client(url);
      }

      // Join or create the game room
      const options = mergedConfig.gameId ? { gameId: mergedConfig.gameId } : {};
      console.log('[Colyseus] Joining room:', ROOM_NAME, 'with options:', options);
      const room = await clientRef.current.joinOrCreate(ROOM_NAME, options);
      console.log('[Colyseus] Joined room successfully, room.state:', room.state);
      
      roomRef.current = room;
      reconnectionTokenRef.current = room.reconnectionToken;
      setupRoomListeners(room);

      setStatus(ConnectionStatus.Connected);
      setError(null);
      reconnectAttemptRef.current = 0;
    } catch (err) {
      console.error('[Colyseus] Connection error:', err);
      const message = err instanceof Error ? err.message : 'Failed to join room';
      setError(message);
      setStatus(ConnectionStatus.Error);

      // Schedule retry if auto-reconnect enabled
      if (mergedConfig.autoReconnect) {
        reconnectAttemptRef.current += 1;
        const delay = Math.min(
          mergedConfig.reconnectDelay * Math.pow(2, reconnectAttemptRef.current - 1),
          MAX_RECONNECT_DELAY
        );
        reconnectTimeoutRef.current = window.setTimeout(() => {
          doConnect();
        }, delay);
      }
    }
  }, [mergedConfig, clearTimers, setupRoomListeners]);

  const connect = useCallback(() => {
    // Clean up existing room
    if (roomRef.current) {
      roomRef.current.leave();
      roomRef.current = null;
    }
    reconnectAttemptRef.current = 0;
    reconnectionTokenRef.current = null;
    doConnect();
  }, [doConnect]);

  const disconnect = useCallback(() => {
    clearTimers();
    reconnectAttemptRef.current = 0;
    reconnectionTokenRef.current = null;
    if (roomRef.current) {
      roomRef.current.leave();
      roomRef.current = null;
    }
    setStatus(ConnectionStatus.Disconnected);
    gameStateStore.clear();
  }, [clearTimers]);

  const pause = useCallback(() => {
    roomRef.current?.send('pause');
  }, []);

  const resume = useCallback(() => {
    roomRef.current?.send('resume');
  }, []);

  const setSpeed = useCallback((speed: GameSpeed) => {
    roomRef.current?.send('set_speed', { speed });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
      if (roomRef.current) {
        roomRef.current.leave();
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
