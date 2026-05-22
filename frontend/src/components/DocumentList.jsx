/**
 * ChatDocumentList.jsx
 * Fixes:
 * 1. chunk_count=0 display bug — now shows actual count correctly
 * 2. Suggested questions auto-fetch when doc has >= 1 chunk (on select)
 * 3. Uses doc.doc_id (backend id) for getSuggestedQuestions, not the file id
 */

import { useState, useEffect, useCallback } from 'react';
import { FileText, RefreshCw, Search, CheckSquare, Trash2, AlertCircle } from 'lucide-react';
import { documentAPI, chatAPI } from '../services/api';
import { useChatContext } from '../context/ChatContext';

// ── Helpers ─────────────────────────────────────────────────────────────────

const getFileType = (filename = '') => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':  return { icon: '📄', color: '#EF4444', label: 'PDF' };
    case 'doc':
    case 'docx': return { icon: '📝', color: '#3B82F6', label: 'DOC' };
    case 'xls':
    case 'xlsx': return { icon: '📊', color: '#22C55E', label: 'XLS' };
    case 'ppt':
    case 'pptx': return { icon: '📑', color: '#F97316', label: 'PPT' };
    case 'txt':  return { icon: '📄', color: '#64748B', label: 'TXT' };
    case 'png':
    case 'jpg':
    case 'jpeg': return { icon: '🖼️', color: '#8B5CF6', label: 'IMG' };
    default:     return { icon: '📄', color: '#94A3B8', label: 'FILE' };
  }
};

const fmtDate = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return '—'; }
};

const fmtSize = (bytes) => {
  if (!bytes) return '';
  const b = parseInt(bytes);
  if (isNaN(b)) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
};

const highlightText = (text = '', query = '') => {
  if (!query || !text) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <span key={i} className="bg-primary/20 text-primary px-0.5 rounded">{part}</span>
      : part
  );
};

// ── KEY FIX: chunk count helper ───────────────────────────────────────────────
// chunk_count can be 0 (number), undefined, or null — treat only >= 1 as "indexed"
const getChunkCount = (doc) =>
  typeof doc.chunk_count === 'number' ? doc.chunk_count
  : typeof doc.chunks     === 'number' ? doc.chunks
  : null;

const isIndexed = (doc) => {
  const count = getChunkCount(doc);
  return count !== null && count >= 1;
};

// ── Component ────────────────────────────────────────────────────────────────

export default function ChatDocumentList({ refreshTrigger, onSuggestedQuestion }) {
  const [docs,        setDocs]        = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { selectedDocs, toggleDocSelection, setSelectedDocs } = useChatContext();

  // ── Load documents ─────────────────────────────────────────────────────────
  const loadDocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await documentAPI.listDocuments();
      const list = res?.documents || res?.docs || res || [];
      // Sort by most recent timestamp
      const sorted = [...list].sort((a, b) => {
        const ta = new Date(a.created_at || a.uploaded_at || a.upload_date || a.modifiedTime || a.timestamp || 0);
        const tb = new Date(b.created_at || b.uploaded_at || b.upload_date || b.modifiedTime || b.timestamp || 0);
        return tb - ta;
      });
      setDocs(sorted);
    } catch (err) {
      console.error('[ChatDocumentList] load error:', err);
      setError('Failed to load documents.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs, refreshTrigger]);

  // ── KEY FIX: fetch suggested questions using doc_id (not file id) ─────────
  // Called automatically when a doc is selected AND has >= 1 chunk
  const fetchSuggestedQuestions = useCallback(async (doc) => {
    // Use doc.doc_id if available (backend vector store id), fall back to doc.id
    const queryId = doc.doc_id || doc.id;
    if (!queryId) return;
    try {
      const res       = await chatAPI.getSuggestedQuestions([queryId]);
      const questions = res?.questions || res?.suggested_questions || [];
      if (questions.length === 0) return;
      setDocs(prev =>
        prev.map(d => (d.id === doc.id ? { ...d, suggested_questions: questions } : d))
      );
    } catch (err) {
      console.error('[ChatDocumentList] suggestions error:', err);
    }
  }, []);

  // ── When selection changes, auto-fetch suggestions for newly selected docs ──
  useEffect(() => {
    docs.forEach(doc => {
      const docId = doc.id;
      if (
        selectedDocs.includes(docId) &&   // is selected
        isIndexed(doc) &&                  // has >= 1 chunk
        !doc.suggested_questions           // not already fetched
      ) {
        fetchSuggestedQuestions(doc);
      }
    });
  }, [selectedDocs, docs, fetchSuggestedQuestions]);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (e, docId) => {
    e.stopPropagation();
    try {
      await documentAPI.deleteDocument(docId);
      setDocs(prev => prev.filter(d => d.id !== docId));
      setSelectedDocs(prev => prev.filter(id => id !== docId));
    } catch (err) {
      console.error('[ChatDocumentList] delete error:', err);
    }
  }, [setSelectedDocs]);

  // ── Filter + derived ───────────────────────────────────────────────────────
  const filtered = docs.filter(d =>
    !searchQuery || (d.filename || d.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedDocObjs = docs.filter(d => selectedDocs.includes(d.id));

  const allSuggestions = selectedDocObjs
    .flatMap(d => (d.suggested_questions || []).map(q => ({ q, filename: d.filename || d.name })))
    .slice(0, 6);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-base text-gray-900 dark:text-white">
          <FileText size={16} className="text-primary" />
          Documents
          {!loading && (
            <span className="text-[11px] font-normal text-gray-400">({docs.length})</span>
          )}
        </h2>
        <button
          onClick={loadDocs}
          disabled={loading}
          className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md text-gray-500 dark:text-gray-400 transition-colors disabled:opacity-40"
          title="Refresh documents"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Search */}
      {docs.length > 3 && (
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs focus:outline-none focus:border-primary transition-all text-gray-900 dark:text-white placeholder:text-gray-400"
          />
        </div>
      )}

      {/* Selected strip */}
      {selectedDocObjs.length > 0 && (
        <div className="rounded-xl border border-primary/25 bg-[#fff0f7] dark:bg-primary/10 px-3 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-primary uppercase tracking-wider">
              <CheckSquare size={11} /> {selectedDocObjs.length} selected
            </span>
            <button
              onClick={() => setSelectedDocs(prev => prev.filter(id => !selectedDocObjs.map(d => d.id).includes(id)))}
              className="text-[10px] text-primary/70 hover:text-primary underline"
            >Clear</button>
          </div>
          {selectedDocObjs.map(d => (
            <div key={d.id} className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-gray-700 dark:text-gray-200 truncate flex-1">
                {d.filename || d.name}
              </span>
              <button
                onClick={() => toggleDocSelection(d.id)}
                className="text-[10px] text-gray-400 hover:text-red-400 shrink-0"
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Suggested questions — shown when selected docs have chunks */}
      {allSuggestions.length > 0 && onSuggestedQuestion && (
        <div className="rounded-xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/60 dark:bg-blue-900/10 px-3 py-2.5">
          <div className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">
            💡 Suggested
          </div>
          <div className="flex flex-col gap-1">
            {allSuggestions.map(({ q, filename }, i) => (
              <button
                key={i}
                onClick={() => onSuggestedQuestion(q)}
                className="text-left text-[11px] text-blue-700 dark:text-blue-300 hover:text-primary hover:bg-white/60 dark:hover:bg-white/10 px-2 py-1.5 rounded-lg transition-colors"
                title={`From: ${filename}`}
              >{q}</button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-white/5 dark:via-white/10 dark:to-white/5 animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="text-center py-4">
          <AlertCircle size={18} className="text-red-400 mx-auto mb-2" />
          <p className="text-xs text-gray-500 mb-2">{error}</p>
          <button onClick={loadDocs} className="text-xs text-primary border border-primary/30 px-3 py-1 rounded-lg hover:bg-primary/5">
            Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && docs.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <FileText size={28} strokeWidth={1.3} className="text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No documents yet.</p>
          <p className="text-[11px] text-gray-400">Upload a file above to get started.</p>
        </div>
      )}

      {/* No search results */}
      {!loading && !error && docs.length > 0 && filtered.length === 0 && (
        <p className="text-xs text-center text-gray-400 py-4">No documents match your search.</p>
      )}

      {/* Document list */}
      <div className="space-y-1.5">
        {filtered.map(doc => {
          const name       = doc.filename || doc.name || 'Untitled';
          const { icon, color, label } = getFileType(name);
          const isSelected = selectedDocs.includes(doc.id);
          const isDisabled = !isSelected && selectedDocs.length >= 3;
          const chunkCount = getChunkCount(doc);   // real number or null
          const hasChunks  = isIndexed(doc);        // true only if >= 1

          return (
            <div
              key={doc.id}
              onClick={() => { if (!isDisabled) toggleDocSelection(doc.id); }}
              title={isDisabled ? 'Max 3 selected' : isSelected ? 'Deselect' : 'Select for chat'}
              className={`group flex items-center gap-2.5 p-2.5 rounded-xl border transition-all
                ${isSelected
                  ? 'bg-[#fff0f7] border-primary/40 shadow-[0_0_0_2px_rgba(249,95,158,0.12)] dark:bg-primary/10 dark:border-primary/30 cursor-pointer'
                  : isDisabled
                    ? 'opacity-40 cursor-not-allowed bg-white/70 border-gray-100 dark:bg-white/3 dark:border-white/5'
                    : 'bg-white/85 border-primary/10 hover:bg-[#ffe4f0]/40 hover:border-primary/20 dark:bg-white/3 dark:border-white/5 dark:hover:border-white/15 cursor-pointer'
                }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                disabled={isDisabled}
                onChange={() => !isDisabled && toggleDocSelection(doc.id)}
                onClick={e => e.stopPropagation()}
                className="w-4 h-4 shrink-0 accent-primary cursor-pointer disabled:cursor-not-allowed rounded"
              />

              <div
                className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-base"
                style={{ background: `${color}20`, border: `1.5px solid ${color}38` }}
              >{icon}</div>

              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {highlightText(name, searchQuery)}
                </div>
                <div className="text-[10px] text-gray-400 flex items-center gap-1 flex-wrap">
                  <span
                    className="font-bold uppercase px-1 py-0.5 rounded text-[9px]"
                    style={{ color, background: `${color}1a` }}
                  >{label}</span>

                  {doc.file_size && <span>{fmtSize(doc.file_size)}</span>}

                  {/* KEY FIX: chunk count */}
                  {chunkCount !== null && (
                    <span className={hasChunks ? 'text-green-500' : 'text-gray-400'}>
                      • {chunkCount} chunk{chunkCount !== 1 ? 's' : ''}
                    </span>
                  )}

                  <span>• {fmtDate(doc.created_at || doc.uploaded_at || doc.upload_date)}</span>
                </div>
              </div>

              {/* Delete button 
              <button
                onClick={e => handleDelete(e, doc.id)}
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-300 hover:text-red-400"
                title="Delete document"
              >
                <Trash2 size={12} />
              </button>*/}
            </div>
          );
        })}
      </div>

      {selectedDocs.length >= 3 && (
        <p className="text-[10px] text-center text-gray-400">Max 3 documents. Deselect one to choose another.</p>
      )}
    </div>
  );
}
