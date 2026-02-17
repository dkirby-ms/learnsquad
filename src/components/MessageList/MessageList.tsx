/**
 * MessageList - Scrollable message display with auto-scroll behavior.
 */

import React, { useEffect, useRef, memo } from 'react';
import styles from './MessageList.module.css';
import type { ChatMessage } from '../ChatPanel/ChatPanel';

interface MessageListProps {
  messages: ChatMessage[];
  currentPlayerId: string;
  onScrollChange?: (isAtBottom: boolean) => void;
}

interface MessageItemProps {
  message: ChatMessage;
  isCurrentPlayer: boolean;
}

function formatTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 10) return 'Just now';
  if (minutes < 1) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const MessageItem = memo(({ message, isCurrentPlayer }: MessageItemProps) => {
  return (
    <div className={styles.message}>
      <div className={styles.messageHeader}>
        <div className={styles.playerInfo}>
          {message.playerColor && (
            <span
              className={styles.colorDot}
              style={{ backgroundColor: message.playerColor }}
            />
          )}
          <span
            className={`${styles.playerName} ${isCurrentPlayer ? styles.currentPlayer : ''}`}
          >
            {message.playerName}
          </span>
        </div>
        <span
          className={`${styles.timestamp} ${isCurrentPlayer ? styles.currentPlayer : ''}`}
        >
          {formatTimestamp(message.timestamp)}
        </span>
      </div>
      <div className={styles.messageContent}>{message.content}</div>
    </div>
  );
});

MessageItem.displayName = 'MessageItem';

export function MessageList({ messages, currentPlayerId, onScrollChange }: MessageListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const checkIfAtBottom = () => {
    if (!listRef.current) return false;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    return atBottom;
  };

  const scrollToBottom = () => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  };

  const handleScroll = () => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      const atBottom = checkIfAtBottom();
      if (atBottom !== isAtBottomRef.current) {
        isAtBottomRef.current = atBottom;
        onScrollChange?.(atBottom);
      }
    }, 100);
  };

  // Auto-scroll to bottom when new messages arrive (if at bottom)
  useEffect(() => {
    if (isAtBottomRef.current) {
      scrollToBottom();
    }
  }, [messages]);

  // Initial scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, []);

  return (
    <div
      ref={listRef}
      className={styles.container}
      onScroll={handleScroll}
      role="log"
      aria-live="polite"
    >
      {messages.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>💬</div>
          <div className={styles.emptyText}>No messages yet</div>
          <div className={styles.emptySubtext}>Start a conversation!</div>
        </div>
      ) : (
        messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            isCurrentPlayer={message.playerId === currentPlayerId}
          />
        ))
      )}
    </div>
  );
}

export default MessageList;
