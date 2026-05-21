import React from 'react';
import SharedNavbar from '../components/SharedNavbar';
import MyDocumentsList from '../components/MyDocumentsList';
import { ChatProvider } from '../context/ChatContext';
import { useTheme } from '../context/ThemeContext';

export default function DocumentsPage() {
  const { isDarkMode } = useTheme();
  return (
    <ChatProvider>
      <div className="app-background flex flex-col min-h-screen text-gray-900 dark:text-white transition-colors duration-300 font-sans">
        <SharedNavbar />
        <div className="flex flex-1 pb-8 px-2 sm:px-4 max-w-7xl mx-auto w-full gap-6" style={{ paddingTop: '88px' }}>
          <div className="w-full glass-card rounded-2xl overflow-hidden flex flex-col p-3 sm:p-6">
            <MyDocumentsList />
          </div>
        </div>
      </div>
    </ChatProvider>
  );
}