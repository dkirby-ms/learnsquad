/**
 * React hooks for chat messaging.
 * 
 * Provides access to chat messages and a function to send messages via Colyseus.
 */

import { useSyncExternalStore, useCallback } from 'react';
import { gameStateStore } from '../store/gameState';
import type { ChatMessage } from '../store/gameState';

/**
 * Hook to access chat messages.
 * Re-renders when new messages arrive.
 */
export function useChatMessages(): readonly ChatMessage[] {
  return useSyncExternalStore(
    (callback) => gameStateStore.subscribe(callback),
    () => gameStateStore.getChatMessages()
  );
}

/**
 * Hook to send chat messages via Colyseus.
 * Returns a function that takes the message content.
 * 
 * Note: This hook provides the send function, but the actual room.send
 * is handled in useGameSocket. Import sendChatMessage from there.
 */
export function useSendChatMessage(): (content: string) => void {
  return useCallback((content: string) => {
    // This is a placeholder - actual implementation is in useGameSocket
    // Components should use the sendChatMessage function from useGameSocket
    console.warn('useSendChatMessage: Use sendChatMessage from useGameSocket instead');
  }, []);
}
