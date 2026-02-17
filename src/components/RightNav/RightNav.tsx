/**
 * RightNav - Tabbed container for EventLog and Chat.
 */

import React, { useState } from 'react';
import styles from './RightNav.module.css';
import { EventLog } from '../EventLog/EventLog';
import { ChatPanel } from '../ChatPanel/ChatPanel';

type TabType = 'events' | 'chat';

interface RightNavProps {
  onSendMessage: (content: string) => void;
}

export function RightNav({ onSendMessage }: RightNavProps) {
  const [activeTab, setActiveTab] = useState<TabType>('events');
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [unreadEventCount, setUnreadEventCount] = useState(0);

  const handleTabClick = (tab: TabType) => {
    setActiveTab(tab);
    // Mark messages/events as read when tab is activated
    if (tab === 'chat') {
      setUnreadChatCount(0);
    } else {
      setUnreadEventCount(0);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.tabBar} role="tablist">
        <button
          className={`${styles.tab} ${activeTab === 'events' ? styles.active : ''}`}
          onClick={() => handleTabClick('events')}
          role="tab"
          aria-selected={activeTab === 'events'}
          aria-controls="events-panel"
        >
          Events
          {unreadEventCount > 0 && (
            <span className={styles.badge}>{unreadEventCount}</span>
          )}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'chat' ? styles.active : ''}`}
          onClick={() => handleTabClick('chat')}
          role="tab"
          aria-selected={activeTab === 'chat'}
          aria-controls="chat-panel"
        >
          Chat
          {unreadChatCount > 0 && (
            <span className={styles.badge}>{unreadChatCount}</span>
          )}
        </button>
      </div>

      <div className={styles.tabContent}>
        {activeTab === 'events' ? (
          <div id="events-panel" role="tabpanel" className={styles.panel}>
            <EventLog maxEvents={30} />
          </div>
        ) : (
          <div id="chat-panel" role="tabpanel" className={styles.panel}>
            <ChatPanel
              isVisible={activeTab === 'chat'}
              onUnreadChange={setUnreadChatCount}
              onSendMessage={onSendMessage}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default RightNav;
