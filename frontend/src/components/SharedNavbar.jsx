import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Sun, Moon, LogOut } from 'lucide-react';

export default function SharedNavbar() {
  const { isDarkMode, toggleTheme, getLogo } = useTheme();
  const { user, logout } = useAuth();
  const location = useLocation();

  const getTabClass = (path) => {
    const isActive = location.pathname === path;
    return isActive 
      ? "px-2 sm:px-4 py-1 sm:py-1.5 text-[11px] sm:text-sm font-semibold rounded-lg bg-white dark:bg-white/10 text-primary dark:text-white shadow-sm border border-gray-200/50 dark:border-white/5 transition-all"
      : "px-2 sm:px-4 py-1 sm:py-1.5 text-[11px] sm:text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors";
  };

  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000] w-[calc(100%-2rem)] max-w-5xl">
      <div className="bg-white/70 dark:bg-cards-dark/70 backdrop-blur-2xl rounded-2xl border border-gray-200/60 dark:border-white/10 shadow-lg shadow-black/[0.04] dark:shadow-black/30 px-3 sm:px-6 h-14 flex items-center justify-between transition-colors duration-300">
        
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <Link to="/">
            <img src={getLogo()} alt="NEXORA Logo" className="h-6 sm:h-7" />
          </Link>
        </div>

        {/* Center: Tabs */}
        <div className="flex items-center p-0.5 sm:p-1 bg-gray-100/50 dark:bg-black/20 rounded-xl border border-gray-200/50 dark:border-white/5 max-w-[70%] sm:max-w-none overflow-x-auto scrollbar-none">
          <Link to="/app" className={getTabClass('/app')}>Dashboard</Link>
          <Link to="/app/documents" className={getTabClass('/app/documents')}>My Documents</Link>
          <Link to="/app/drive" className={getTabClass('/app/drive')}>Drive</Link>
          <Link to="/app/chat" className={getTabClass('/app/chat')}>Chat</Link>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-all duration-200"
            aria-label="Toggle Theme"
          >
            {isDarkMode ? <Sun className="w-5 h-5 text-secondary" /> : <Moon className="w-5 h-5 text-gray-500" />}
          </button>
          
          <div className="flex items-center gap-2 pl-2 md:pl-4 border-l border-gray-200/60 dark:border-white/10">
            <div className="relative group inline-block">
              {/* Avatar circle */}
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm shadow-sm cursor-pointer">
                {(user?.displayName || user?.email || 'U')[0].toUpperCase()}
              </div>

              {/* Gmail tooltip on hover */}
              <div className="absolute top-10 left-1/2 -translate-x-1/2 
                  bg-primary text-white text-xs px-3 py-1.5 rounded-md shadow-lg
                  opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap">
                {user?.email}
              </div>
            </div>

            <button 
              onClick={logout} 
              className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all" 
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

      </div>
    </nav>
  );
}
