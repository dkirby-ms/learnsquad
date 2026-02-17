/**
 * ChatPanel - Chat container with message list and input.
 */

import React, { useState, useEffect } from 'react';
import styles from './ChatPanel.module.css';
import { MessageList } from '../MessageList/MessageList';
import { ChatInput } from '../ChatInput/ChatInput';
import { useChatMessages, useCurrentPlayer } from '../../hooks/useGameState';

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  playerColor?: string;
  content: string;
  timestamp: number;
}

interface ChatPanelProps {
  isVisible: boolean;
  onUnreadChange?: (count: number) => void;
  onSendMessage: (content: string) => void;
}

export function ChatPanel({ isVisible, onUnreadChange, onSendMessage }: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [lastReadMessageId, setLastReadMessageId] = useState<string | null>(null);
  
  const messages = useChatMessages();
  const currentPlayer = useCurrentPlayer();
  
  // Convert readonly array to mutable for component use
  const messageList: ChatMessage[] = [...messages];
  
  // Get current player ID from the session
  const currentPlayerId = currentPlayer?.id ?? '';

  const handleSendMessage = (content: string) => {
    onSendMessage(content);
    setInputValue('');
  };

  const handleScrollChange = (atBottom: boolean) => {
    setIsAtBottom(atBottom);
  };

  // Mark messages as read when panel becomes visible and at bottom
  useEffect(() => {
    if (isVisible && isAtBottom && messageList.length > 0) {
      const lastMessage = messageList[messageList.length - 1];
      if (lastMessage.id !== lastReadMessageId) {
        setLastReadMessageId(lastMessage.id);
        onUnreadChange?.(0);
      }
    }
  }, [isVisible, isAtBottom, messageList, lastReadMessageId, onUnreadChange]);

  return (
    <div className={styles.container}>
      <MessageList
        messages={messageList}
        currentPlayerId={currentPlayerId}
        onScrollChange={handleScrollChange}
      />
      <div className={styles.inputSection}>
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSendMessage}
          maxLength={500}
        />
      </div>
    </div>
  );
}

export default ChatPanel;
