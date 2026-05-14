/**
 * ChatHistory.jsx
 * Fixes:
 * 1. Queries users/{uid}/chat_history subcollection (matching ChatContext.saveSession)
 *    Previously queried top-level 'chat_history' — wrong path, always empty
 * 2. New Chat button at top
 * 3. Grouped by Today / Yesterday / Last 7 Days / Last 30 Days / Older
 */

import { useState, useEffect, useCallback } from 'react';
import {
  History, MessageSquare, Trash2, RefreshCw, Search, PlusCircle,
} from 'lucide-react';
import { db, auth } from '../services/firebase';
import {
  collection, query, orderBy, onSnapshot,
  deleteDoc, doc, limit,
} from 'firebase/firestore';
import ConfirmModal from '../components/ConfirmModal';

// ── Helpers ───────────────────────────────────────────────────────────────────

const toDate = (val) => {
  if (!val) return null;
  if (val?.toDate) return val.toDate();
  if (val instanceof Date) return val;
  return new Date(val);
};

const dayLabel = (date) => {
  if (!date) return 'Older';
  const diff = Math.floor((Date.now() - date) / 86400000);
  if (diff === 0)  return 'Today';
  if (diff === 1)  return 'Yesterday';
  if (diff <= 7)   return 'Last 7 Days';
  if (diff <= 30)  return 'Last 30 Days';
  return 'Older';
};

const GROUP_ORDER = ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'Older'];

const fmtTime = (date) =>
  date?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) ?? '';
const fmtDate = (date) =>
  date?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) ?? '';

const sessionTitle = (session) => {
  if (session.title && session.title !== 'New Chat' && session.title !== 'New conversation')
    return session.title;
  if (session.firstMessage) return session.firstMessage.slice(0, 55);
  if (Array.isArray(session.messages)) {
    const first = session.messages.find((m) => m.role === 'user');
    if (first?.content) return first.content.slice(0, 55);
  }
  return 'Untitled chat';
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChatHistory({ currentSessionId, onSelectSession, onNewChat }) {
  const [sessions,    setSessions]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId,  setDeletingId]  = useState(null);
  const [modal, setModal] = useState(null);
  const [retryKey,    setRetryKey]    = useState(0);
  
  // ── ✅ Fixed Firestore path: users/{uid}/chat_history ─────────────────────
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { setLoading(false); setError('Not signed in.'); return; }

    setLoading(true);
    setError(null);

    const colRef = collection(db, 'users', user.uid, 'chat_history');
    const q = query(colRef, orderBy('updatedAt', 'desc'), limit(100));

    const unsub = onSnapshot(
      q,
      (snap) => {
        setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('[ChatHistory] Firestore error:', err);
        if (err.code === 'failed-precondition') {
          setError('Index missing. Open the console link to create it, then retry.');
        } else if (err.code === 'permission-denied') {
          setError('Permission denied. Check Firestore rules.');
        } else {
          setError('Failed to load history.');
        }
        setLoading(false);
      },
    );

    return () => unsub();
  }, [retryKey]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = useCallback((e, sessionId) => {
  e.stopPropagation();

  const user = auth.currentUser;
  if (!user) return;

  // ⭐ open ConfirmModal instead of window.confirm
  setModal({
    title: "Delete chat?",
    message: "This conversation will be permanently removed.",
    confirmLabel: "Delete",
    danger: true,

    onConfirm: async () => {
      setDeletingId(sessionId);

      try {
        await deleteDoc(doc(db, "users", user.uid, "chat_history", sessionId));
      } catch (err) {
        console.error("[ChatHistory] delete error:", err);
      } finally {
        setDeletingId(null);
      }
    }
  });

}, []);

  // ── Filter + group ────────────────────────────────────────────────────────
  const filtered = sessions.filter((s) =>
    !searchQuery ||
    sessionTitle(s).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const grouped = filtered.reduce((acc, session) => {
    const date  = toDate(session.updatedAt || session.createdAt);
    const label = dayLabel(date);
    if (!acc[label]) acc[label] = [];
    acc[label].push({ session, date });
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-base text-gray-900 dark:text-white">
          <History size={16} className="text-primary" />
          Chat History
          {!loading && (
            <span className="text-[11px] font-normal text-gray-400">({sessions.length})</span>
          )}
        </h2>
        <button
          onClick={() => setRetryKey((k) => k + 1)}
          disabled={loading}
          className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md text-gray-500 dark:text-gray-400 transition-colors disabled:opacity-40"
          title="Refresh history"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ✅ New Chat button 
      <button
        onClick={onNewChat}
        className="flex items-center justify-center gap-2 py-2 w-full rounded-xl text-white text-[13px] font-semibold transition-all active:scale-95"
        style={{
          background: 'linear-gradient(135deg, #F95F9E, #FC9CBF)',
          boxShadow: '0 3px 12px rgba(249,95,158,0.30)',
        }}
      >
        <PlusCircle size={15} />
        New Chat
      </button>*/}

      {/* Search (only when enough sessions) */}
      {sessions.length > 4 && (
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search history…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs focus:outline-none focus:border-primary transition-all text-gray-900 dark:text-white placeholder:text-gray-400"
          />
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-14 rounded-xl bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-white/5 dark:via-white/10 dark:to-white/5 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="text-center py-6 px-2">
          <p className="text-xs text-red-400 mb-3">{error}</p>
          <button
            onClick={() => setRetryKey((k) => k + 1)}
            className="text-xs text-primary border border-primary/30 px-3 py-1 rounded-lg hover:bg-primary/5"
          >Retry</button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && sessions.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <MessageSquare size={28} strokeWidth={1.3} className="text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No chat history yet.</p>
          <p className="text-[11px] text-gray-400">Start a conversation to see it here.</p>
        </div>
      )}

      {/* No search results */}
      {!loading && !error && sessions.length > 0 && filtered.length === 0 && (
        <p className="text-xs text-center text-gray-400 py-4">No chats match your search.</p>
      )}

      {/* Grouped session list */}
      {!loading && !error && (
        <div className="flex flex-col gap-4">
          {GROUP_ORDER.filter((g) => grouped[g]?.length).map((group) => (
            <div key={group}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5 px-1">
                {group}
              </p>
              <div className="flex flex-col gap-1">
                {grouped[group].map(({ session, date }) => {
                  const isActive   = session.id === currentSessionId;
                  const isDeleting = session.id === deletingId;
                  const title      = sessionTitle(session);
                  const msgCount   = session.messages?.length ?? session.messageCount ?? 0;

                  return (
                    <div
                      key={session.id}
                      onClick={() => onSelectSession?.(session)}
                      className={`group relative flex items-start gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all
                        ${isActive
                          ? 'bg-[#fff0f7] border-primary/40 shadow-[0_0_0_2px_rgba(249,95,158,0.10)] dark:bg-primary/10 dark:border-primary/30'
                          : 'bg-white/80 border-gray-100 hover:bg-[#ffe4f0]/30 hover:border-primary/20 dark:bg-white/3 dark:border-white/5 dark:hover:border-white/15'
                        }
                        ${isDeleting ? 'opacity-40 pointer-events-none' : ''}
                      `}
                    >
                      <div className={`shrink-0 mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center
                        ${isActive
                          ? 'bg-primary/15 text-primary'
                          : 'bg-gray-100 dark:bg-white/5 text-gray-400'
                        }`}>
                        <MessageSquare size={13} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className={`text-[12px] font-medium truncate leading-snug
                          ${isActive ? 'text-primary' : 'text-gray-800 dark:text-white/90'}`}>
                          {title}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          {msgCount > 0 && <span>{msgCount} msg{msgCount !== 1 ? 's' : ''}</span>}
                          {msgCount > 0 && date && <span>·</span>}
                          {date && <span>{group === 'Today' ? fmtTime(date) : fmtDate(date)}</span>}
                        </p>
                      </div>

                      <button
                        onClick={(e) => handleDelete(e, session.id)}
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-300 hover:text-red-400"
                        title="Delete chat"
                      >
                        <Trash2 size={12} />
                      </button>
                          <ConfirmModal
                              modal={modal}
                              onClose={() => setModal(null)}
                          />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}