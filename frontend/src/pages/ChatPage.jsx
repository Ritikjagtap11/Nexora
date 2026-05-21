import React, { useRef, useState, useCallback } from 'react';
import SharedNavbar from '../components/SharedNavbar';
import ChatInterface from '../components/ChatInterface';
import Sidebar from '../components/Sidebar';
import { ChatProvider, useChatContext } from '../context/ChatContext';
import { useTheme } from '../context/ThemeContext';
import { Menu, X } from 'lucide-react';

function ChatPageInner() {
  const { isDarkMode } = useTheme();
  const { loadSession, startNewSession } = useChatContext();

  const sendMessageRef = useRef(null);
  const [loadedSession, setLoadedSession] = useState(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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
        className="flex flex-1 overflow-hidden px-2 sm:px-4 max-w-7xl mx-auto w-full gap-6"
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

      {/* Mobile Toggle FAB */}
      <button
        onClick={() => setMobileSidebarOpen(true)}
        className="fixed bottom-6 right-6 z-[1000] lg:hidden bg-primary hover:bg-primary/95 text-white p-3.5 rounded-full shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center border border-white/10"
        aria-label="Toggle Sidebar"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Mobile Sidebar Drawer Overlay */}
      {mobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1010] lg:hidden transition-opacity duration-300"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar Drawer Panel */}
      <div 
        className={`fixed inset-y-0 left-0 w-[300px] max-w-[85vw] bg-white dark:bg-[#0F172A] z-[1020] lg:hidden transform transition-transform duration-300 ease-out flex flex-col p-4 shadow-2xl ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex justify-between items-center mb-4 border-b border-gray-200/50 dark:border-white/5 pb-3">
          <span className="font-semibold text-lg text-primary">Chat Sessions</span>
          <button 
            onClick={() => setMobileSidebarOpen(false)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <Sidebar
            onSuggestedQuestion={(q) => {
              handleSuggestedQuestion(q);
              setMobileSidebarOpen(false);
            }}
            onLoadHistory={(session) => {
              handleLoadHistory(session);
              setMobileSidebarOpen(false);
            }}
            onNewChat={() => {
              handleNewChat();
              setMobileSidebarOpen(false);
            }}
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