import React, { useRef, useState, useCallback } from 'react';
import SharedNavbar from '../components/SharedNavbar';
import ChatInterface from '../components/ChatInterface';
import Sidebar from '../components/Sidebar';
import { ChatProvider, useChatContext } from '../context/ChatContext';
import { useTheme } from '../context/ThemeContext';

function ChatPageInner() {
  const { isDarkMode } = useTheme();
  const { loadSession, startNewSession } = useChatContext();

  const sendMessageRef = useRef(null);
  const [loadedSession, setLoadedSession] = useState(null);

  const handleSuggestedQuestion = (question) => {
    if (sendMessageRef.current) sendMessageRef.current(question);
  };

  const handleLoadHistory = useCallback((session) => {
    loadSession(session);
    setLoadedSession(session);
  }, [loadSession]);

  // ── FIX 3: New Chat — generate a new session ID so ChatInterface detects the reset ──
  const handleNewChat = useCallback(() => {
    setLoadedSession(null);   // clear loaded session FIRST
    startNewSession();        // this changes currentSessionId → ChatInterface useEffect fires → clears messages
  }, [startNewSession]);

  return (
    <div className="app-background flex flex-col h-screen overflow-hidden text-gray-900 dark:text-white transition-colors duration-300 font-sans">
      <SharedNavbar onNewChat={handleNewChat} />

      <div
        className="flex flex-1 overflow-hidden px-4 max-w-7xl mx-auto w-full gap-6"
        style={{ paddingTop: '72px' }}
      >
        <div className="w-[300px] flex-shrink-0 hidden lg:flex flex-col overflow-y-auto custom-scrollbar py-4">
          <Sidebar
            onSuggestedQuestion={handleSuggestedQuestion}
            onLoadHistory={handleLoadHistory}
            onNewChat={handleNewChat}
          />
        </div>

        <div className="flex-1 glass-card rounded-2xl overflow-hidden flex flex-col my-4">
          <ChatInterface
            sendMessageRef={sendMessageRef}
            loadedSession={loadedSession}
            onNewChat={handleNewChat}
          />
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <ChatProvider>
      <ChatPageInner />
    </ChatProvider>
  );
}