/**
 * Tick Broadcaster
 * 
 * Utility for managing tick broadcast to multiple rooms.
 * Handles server-wide tick coordination if needed.
 */

import type { GameRoom } from './rooms';
import type { TickComplete } from './types';

/**
 * Tick broadcaster for coordinating multiple rooms.
 * 
 * Currently each room manages its own tick loop via GameLoop.
 * This module exists for:
 * - Future server-wide tick synchronization
 * - Metrics/monitoring of tick rates
 * - Coordinated pause/resume across rooms
 */
export class TickBroadcaster {
  private rooms: Set<GameRoom> = new Set();
  private isPaused: boolean = false;
  
  /** Track tick performance */
  private tickCounts: Map<string, number> = new Map();
  private lastMetricsReset: number = Date.now();

  /** Register a room for tick broadcasting */
  registerRoom(room: GameRoom): void {
    this.rooms.add(room);
    this.tickCounts.set(room.id, 0);
  }

  /** Unregister a room */
  unregisterRoom(room: GameRoom): void {
    this.rooms.delete(room);
    this.tickCounts.delete(room.id);
  }

  /** Pause all rooms */
  pauseAll(): void {
    this.isPaused = true;
    for (const room of this.rooms) {
      room.pause();
    }
  }

  /** Resume all rooms */
  resumeAll(): void {
    this.isPaused = false;
    for (const room of this.rooms) {
      room.resume();
    }
  }

  /** Get tick metrics for monitoring */
  getMetrics(): TickMetrics {
    const now = Date.now();
    const elapsed = (now - this.lastMetricsReset) / 1000;
    
    const roomMetrics: Record<string, RoomTickMetrics> = {};
    for (const [roomId, count] of this.tickCounts) {
      roomMetrics[roomId] = {
        tickCount: count,
        ticksPerSecond: count / elapsed,
      };
    }
    
    return {
      isPaused: this.isPaused,
      roomCount: this.rooms.size,
      rooms: roomMetrics,
      measurementPeriodSeconds: elapsed,
    };
  }

  /** Reset metrics counters */
  resetMetrics(): void {
    this.lastMetricsReset = Date.now();
    for (const roomId of this.tickCounts.keys()) {
      this.tickCounts.set(roomId, 0);
    }
  }

  /** Record that a tick occurred in a room (for metrics) */
  recordTick(roomId: string): void {
    const current = this.tickCounts.get(roomId) ?? 0;
    this.tickCounts.set(roomId, current + 1);
  }
}

export interface RoomTickMetrics {
  tickCount: number;
  ticksPerSecond: number;
}

export interface TickMetrics {
  isPaused: boolean;
  roomCount: number;
  rooms: Record<string, RoomTickMetrics>;
  measurementPeriodSeconds: number;
}

/** Singleton broadcaster for server-wide coordination */
let globalBroadcaster: TickBroadcaster | null = null;

export function getTickBroadcaster(): TickBroadcaster {
  if (!globalBroadcaster) {
    globalBroadcaster = new TickBroadcaster();
  }
  return globalBroadcaster;
}
