/**
 * ChatInput - Auto-growing textarea with character count and send button.
 */

import React, { useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import styles from './ChatInput.module.css';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (content: string) => void;
  maxLength?: number;
}

export function ChatInput({ value, onChange, onSend, maxLength = 500 }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(Math.max(textarea.scrollHeight, 40), 120);
      textarea.style.height = `${newHeight}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'Escape') {
      textareaRef.current?.blur();
    }
  };

  const handleSend = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed.length <= maxLength) {
      onSend(trimmed);
    } else if (trimmed.length > maxLength) {
      // Shake animation for overlimit
      textareaRef.current?.classList.add(styles.shake);
      setTimeout(() => {
        textareaRef.current?.classList.remove(styles.shake);
      }, 500);
    }
  };

  const charCount = value.length;
  const isOverLimit = charCount > maxLength;
  const showCount = charCount > 400 || isOverLimit;
  const isEmpty = value.trim().length === 0;

  return (
    <div className={styles.container}>
      <textarea
        ref={textareaRef}
        className={`${styles.textarea} ${isOverLimit ? styles.overlimit : ''}`}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        rows={1}
        aria-label="Chat message"
      />
      <div className={styles.footer}>
        <div className={styles.charCount}>
          {showCount && (
            <span className={isOverLimit ? styles.countError : styles.countWarning}>
              {charCount}/{maxLength}
            </span>
          )}
        </div>
        <button
          className={styles.sendButton}
          onClick={handleSend}
          disabled={isEmpty || isOverLimit}
          aria-label="Send message"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default ChatInput;
