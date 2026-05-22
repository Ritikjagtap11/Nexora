import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Sun, Moon, LogOut, Menu, X } from 'lucide-react';

export default function SharedNavbar() {
  const { isDarkMode, toggleTheme, getLogo } = useTheme();
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const getTabClass = (path) => {
    const isActive = location.pathname === path;
    return isActive 
      ? "px-4 py-1.5 text-sm font-semibold rounded-lg bg-white dark:bg-white/10 text-primary dark:text-white shadow-sm border border-gray-200/50 dark:border-white/5 transition-all"
      : "px-4 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors";
  };

  const getMobileTabClass = (path) => {
    const isActive = location.pathname === path;
    return isActive
      ? "flex items-center w-full px-4 py-3 text-sm font-semibold rounded-xl bg-primary/10 border-l-4 border-[#F95F9E] text-[#F95F9E] transition-all"
      : "flex items-center w-full px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl transition-all";
  };

  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000] w-[calc(100%-2rem)] max-w-5xl">
      <div className="relative bg-white/70 dark:bg-cards-dark/70 backdrop-blur-2xl rounded-2xl border border-gray-200/60 dark:border-white/10 shadow-lg shadow-black/[0.04] dark:shadow-black/30 px-4 sm:px-6 h-14 flex items-center justify-between transition-colors duration-300">
        
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <Link to="/">
            <img src={getLogo()} alt="NEXORA Logo" className="h-6 sm:h-7" />
          </Link>
        </div>

        {/* Center: Tabs (Desktop only) */}
        <div className="hidden md:flex items-center p-1 bg-gray-100/50 dark:bg-black/20 rounded-xl border border-gray-200/50 dark:border-white/5 overflow-x-auto scrollbar-none">
          <Link to="/app" className={getTabClass('/app')}>Dashboard</Link>
          <Link to="/app/documents" className={getTabClass('/app/documents')}>My Documents</Link>
          <Link to="/app/drive" className={getTabClass('/app/drive')}>Drive</Link>
          <Link to="/app/chat" className={getTabClass('/app/chat')}>Chat</Link>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-all duration-200 cursor-pointer"
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

              {/* Gmail tooltip on hover (Desktop only) */}
              <div className="absolute top-10 left-1/2 -translate-x-1/2 
                  bg-primary text-white text-xs px-3 py-1.5 rounded-md shadow-lg
                  opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap hidden md:block z-50">
                {user?.email}
              </div>
            </div>

            {/* Logout (Desktop only) */}
            <button 
              onClick={logout} 
              className="hidden md:flex p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all cursor-pointer" 
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>

            {/* Hamburger Button (Mobile only) */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex md:hidden p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-all cursor-pointer"
              aria-label="Toggle Menu"
            >
              {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Animated Dropdown Drawer (Mobile only) */}
        {isOpen && (
          <div className="absolute top-16 left-0 right-0 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-2xl rounded-2xl border border-gray-200/60 dark:border-white/10 shadow-2xl p-4 flex flex-col gap-3 z-[2000] md:hidden transform origin-top transition-all duration-300 scale-95 opacity-100 animate-fade-in">
            <div className="flex flex-col gap-1.5">
              <Link to="/app" onClick={() => setIsOpen(false)} className={getMobileTabClass('/app')}>Dashboard</Link>
              <Link to="/app/documents" onClick={() => setIsOpen(false)} className={getMobileTabClass('/app/documents')}>My Documents</Link>
              <Link to="/app/drive" onClick={() => setIsOpen(false)} className={getMobileTabClass('/app/drive')}>Drive</Link>
              <Link to="/app/chat" onClick={() => setIsOpen(false)} className={getMobileTabClass('/app/chat')}>Chat</Link>
            </div>
            
            <div className="border-t border-gray-200/60 dark:border-white/10 pt-3 flex flex-col gap-3">
              <div className="px-4 py-1 text-xs text-gray-500 dark:text-gray-400 font-medium break-all">
                Connected: <span className="font-semibold text-gray-700 dark:text-gray-200">{user?.email}</span>
              </div>
              <button 
                onClick={() => {
                  setIsOpen(false);
                  logout();
                }} 
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-red-500/20 hover:border-red-500 bg-red-500/5 hover:bg-red-500/10 text-red-500 transition-all duration-200 font-medium cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </nav>
  );
}
