/**
 * ChatContext.jsx
 * Adds Firebase chat session persistence on top of existing doc selection logic.
 * - Saves each conversation to: users/{uid}/chat_history/{sessionId}
 * - Provides saveSession(), loadSession(), startNewSession()
 */

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
  collection, doc, setDoc, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../services/firebase';

const ChatContext = createContext();
export const useChatContext = () => useContext(ChatContext);

// Generate a session title from the first user message
const generateTitle = (messages) => {
  const first = messages.find(m => m.role === 'user')?.content || '';
  if (!first) return 'New conversation';
  return first.length > 60 ? first.slice(0, 57) + '…' : first;
};

export const ChatProvider = ({ children }) => {
  // ── Doc selection (existing logic unchanged) ────────────────────────────
  const [selectedDocs, setSelectedDocs] = useState([]);

  const toggleDocSelection = (docId) => {
    setSelectedDocs(prev => {
      if (prev.includes(docId)) return prev.filter(id => id !== docId);
      if (prev.length >= 3) return prev;
      return [...prev, docId];
    });
  };

  // ── Session state ────────────────────────────────────────────────────────
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const saveTimeoutRef = useRef(null);

  // ── Save session to Firestore (debounced 1.5s) ───────────────────────────
  const saveSession = useCallback((messages, sessionId = null) => {
    const uid = getAuth().currentUser?.uid;
    if (!uid || messages.length === 0) return;

    const sid = sessionId || currentSessionId;
    if (!sid) return;

    // Debounce — don't hammer Firestore on every token
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const ref = doc(db, 'users', uid, 'chat_history', sid);
        await setDoc(ref, {
          title: generateTitle(messages),
          messages: messages.map(m => ({
            role: m.role,
            content: m.content || '',
            ...(m.metadata ? { metadata: m.metadata } : {}),
          })),
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(), // setDoc with merge will not overwrite existing createdAt
        }, { merge: true });
      } catch (err) {
        console.error('saveSession error:', err);
      }
    }, 1500);
  }, [currentSessionId]);

  // ── Start a brand-new session ────────────────────────────────────────────
  const startNewSession = useCallback(() => {
    const newId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setCurrentSessionId(newId);
    return newId;
  }, []);

  // ── Load a historical session (called from ChatHistory) ──────────────────
  const loadSession = useCallback((session) => {
    setCurrentSessionId(session.id);
    return session; // caller uses session.messages
  }, []);

  return (
    <ChatContext.Provider value={{
      // doc selection
      selectedDocs,
      setSelectedDocs,
      toggleDocSelection,
      // session
      currentSessionId,
      setCurrentSessionId,
      saveSession,
      startNewSession,
      loadSession,
    }}>
      {children}
    </ChatContext.Provider>
  );
};