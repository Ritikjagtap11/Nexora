/**
 * DriveChatDocumentList.jsx
 * Fixes:
 * 1. fetchSuggestedQuestions(driveFileId, docId) — queries API with docId
 *    but patches the file in state using driveFileId (they are different!)
 * 2. indexFile passes both fid and docId to fetchSuggestedQuestions
 * 3. All other logic unchanged from previous working version
 */

import { useState, useEffect, useRef } from 'react';
import {
  HardDrive, RefreshCw, Search, CheckSquare,
  AlertCircle, X, Loader2, MessageSquare,
} from 'lucide-react';
import { driveAPI, chatAPI } from '../services/api';
import { useChatContext } from '../context/ChatContext';

// ── Session-level index cache ─────────────────────────────────────────────────
const getIndexedIds = () => {
  try { return new Set(JSON.parse(sessionStorage.getItem('nexora_indexed_drive') || '[]')); }
  catch { return new Set(); }
};
const persistIndexedId = (id) => {
  try {
    const ids = getIndexedIds(); ids.add(id);
    sessionStorage.setItem('nexora_indexed_drive', JSON.stringify([...ids]));
  } catch {}
};

// ── File type helpers ─────────────────────────────────────────────────────────
const getFileType = (mime = '') => {
  if (mime.includes('pdf'))                                          return { icon: '📄', color: '#EF4444', label: 'PDF' };
  if (mime.includes('word') || mime.includes('document'))           return { icon: '📝', color: '#3B82F6', label: 'DOC' };
  if (mime.includes('sheet') || mime.includes('excel'))             return { icon: '📊', color: '#22C55E', label: 'XLS' };
  if (mime.includes('presentation') || mime.includes('powerpoint')) return { icon: '📑', color: '#F97316', label: 'PPT' };
  if (mime.includes('image'))                                        return { icon: '🖼️', color: '#8B5CF6', label: 'IMG' };
  if (mime.includes('text'))                                         return { icon: '📃', color: '#64748B', label: 'TXT' };
  return { icon: '📄', color: '#94A3B8', label: 'FILE' };
};

const byDate = (a, b) =>
  new Date(b.modifiedTime || b.createdTime || 0) -
  new Date(a.modifiedTime || a.createdTime || 0);

const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return '—'; }
};

const fmtSize = (size) => {
  if (!size) return '';
  const b = parseInt(size);
  if (isNaN(b)) return '';
  if (b < 1024)    return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
};

const highlightText = (text = '', query = '') => {
  if (!query || !text) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <span key={i} className="bg-primary/20 text-primary px-0.5 rounded">{part}</span>
      : part
  );
};

export default function DriveChatDocumentList({ onSuggestedQuestion }) {
  const [files, setFiles]             = useState([]);
  const [loading, setLoading]         = useState(false);
  const [scanStatus, setScanStatus]   = useState('idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [showBanner, setShowBanner]   = useState(true);
  const [indexing, setIndexing]       = useState({});          // fid → 'indexing'|'done'|'error'
  const [indexedIds, setIndexedIds]   = useState(getIndexedIds);

  const hasScanRunRef = useRef(false);
  const pollRef       = useRef(null);

  const { selectedDocs, toggleDocSelection, setSelectedDocs } = useChatContext();

  // ── Cache ─────────────────────────────────────────────────────────────────
  const loadFromCache = () => {
    try {
      const cached = sessionStorage.getItem('nexora_scan_files');
      const status = sessionStorage.getItem('nexora_scan_status');
      if (cached && status === 'complete') {
        const parsed = JSON.parse(cached);
        if (parsed.length > 0) {
          setFiles([...parsed].sort(byDate));
          setScanStatus('complete');
          return true;
        }
      }
    } catch {}
    return false;
  };

  // ── Drive scan ────────────────────────────────────────────────────────────
  const runScan = async () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setScanStatus('running');
    setLoading(true);
    try {
      const response = await driveAPI.startScan();
      const jobId = response?.job_id;
      if (!jobId) throw new Error('No job_id');

      pollRef.current = setInterval(async () => {
        try {
          const status = await driveAPI.getScanStatus(jobId);
          if (status.files?.length > 0) setFiles([...status.files].sort(byDate));

          if (status.status === 'complete' || status.status === 'failed') {
            clearInterval(pollRef.current); pollRef.current = null;
            setScanStatus(status.status);
            setLoading(false);

            if (status.status === 'complete') {
              const sorted = [...(status.files || [])].sort(byDate);
              setFiles(sorted);
              try {
                sessionStorage.setItem('nexora_scan_files', JSON.stringify(sorted));
                sessionStorage.setItem('nexora_scan_status', 'complete');
              } catch {}
            }
          }
        } catch {
          clearInterval(pollRef.current); pollRef.current = null;
          setScanStatus('failed'); setLoading(false);
        }
      }, 2000);
    } catch {
      setScanStatus('failed'); setLoading(false);
    }
  };

  useEffect(() => {
    if (hasScanRunRef.current) return;
    hasScanRunRef.current = true;
    if (!loadFromCache()) runScan();
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, []);

  const handleRefresh = () => runScan();

  // ── ✅ KEY FIX: fetchSuggestedQuestions takes BOTH ids ─────────────────────
  // driveFileId → used to find the file in state and patch it
  // docId       → used to call the API (this is the backend's vector store ID)
  const fetchSuggestedQuestions = async (driveFileId, docId) => {
    try {
      // Query with the backend doc_id so it finds chunks
      const res = await chatAPI.getSuggestedQuestions([docId]);
      const questions = res?.questions || res?.suggested_questions || [];
      if (!questions.length) return;

      // Patch using the DRIVE file id so the right file gets updated
      setFiles(prev => prev.map(f =>
        (f.id === driveFileId || f.drive_id === driveFileId)
          ? { ...f, suggested_questions: questions }
          : f
      ));
    } catch {}
  };

  // ── Index drive file, then fetch suggestions ───────────────────────────────
  const indexFile = async (file) => {
    const fid = file.id || file.drive_id;

    // Already indexed this session → just refetch suggestions if missing
    if (indexedIds.has(fid)) {
      const storedDocId = sessionStorage.getItem(`nexora_drive_docid_${fid}`);
      if (storedDocId && !file.suggested_questions) {
        fetchSuggestedQuestions(fid, storedDocId);
      }
      return;
    }

    setIndexing(prev => ({ ...prev, [fid]: 'indexing' }));
    try {
      const result = await driveAPI.indexFile(fid);
      const docId = result.doc_id;   // backend UUID in vector store

      // Cache the drive_id → doc_id mapping for this session
      sessionStorage.setItem(`nexora_drive_docid_${fid}`, docId);
      persistIndexedId(fid);
      setIndexedIds(getIndexedIds());
      setIndexing(prev => ({ ...prev, [fid]: 'done' }));

      // ✅ Pass BOTH ids so the right file gets patched
      await fetchSuggestedQuestions(fid, docId);
    } catch (err) {
      console.error('Drive indexFile error:', err);
      setIndexing(prev => ({ ...prev, [fid]: 'error' }));
    }
  };

  // ── Handle checkbox click ─────────────────────────────────────────────────
  const handleSelect = (file) => {
    const fid = file.id || file.drive_id;
    const isSelected = selectedDocs.includes(fid);
    toggleDocSelection(fid);
    if (!isSelected) indexFile(file);
  };

  // ── Filtered + derived ────────────────────────────────────────────────────
  const filtered = files.filter(f =>
    !searchQuery ||
    (f.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.full_path || f.folderPath || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedFileObjs = files.filter(f => selectedDocs.includes(f.id || f.drive_id));
  const allSuggestions   = selectedFileObjs
    .flatMap(f => (f.suggested_questions || []).map(q => ({ q, filename: f.name })))
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-base text-gray-900 dark:text-white">
          <HardDrive size={16} className="text-primary" />
          Drive Files
          <span className="text-[11px] font-normal text-gray-400">({files.length})</span>
        </h2>
        <button onClick={handleRefresh} disabled={loading}
          className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md text-gray-500 dark:text-gray-400 transition-colors disabled:opacity-40"
          title="Re-scan Drive">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Info banner */}
      {showBanner && files.length > 0 && (
        <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/15 border border-blue-200 dark:border-blue-700/30 rounded-xl px-3 py-2.5 text-[11px] text-blue-700 dark:text-blue-400 leading-relaxed">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          <span>Selecting a Drive file will <b>auto-index it</b> so the AI can answer questions about it.</span>
          <button onClick={() => setShowBanner(false)} className="shrink-0 ml-auto opacity-50 hover:opacity-100">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search drive files..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary transition-all text-gray-900 dark:text-white placeholder:text-gray-400"
        />
      </div>

      {/* Selected strip */}
      {selectedFileObjs.length > 0 && (
        <div className="rounded-xl border border-primary/25 bg-[#fff0f7] dark:bg-primary/10 px-3 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-primary uppercase tracking-wider">
              <CheckSquare size={11} /> {selectedFileObjs.length} drive selected
            </span>
            <button
              onClick={() =>
                setSelectedDocs(prev =>
                  prev.filter(id => !selectedFileObjs.map(f => f.id || f.drive_id).includes(id))
                )
              }
              className="text-[10px] text-primary/70 hover:text-primary underline"
            >Clear</button>
          </div>

          {selectedFileObjs.map(f => {
            const fid = f.id || f.drive_id;
            const idxState = indexing[fid];
            return (
              <div key={fid} className="flex items-center justify-between gap-2 py-0.5">
                <span className="text-[11px] text-gray-700 dark:text-gray-200 truncate flex-1">{f.name}</span>
                {idxState === 'indexing' && (
                  <span className="flex items-center gap-1 text-[10px] text-blue-500 shrink-0">
                    <Loader2 size={10} className="animate-spin" /> indexing…
                  </span>
                )}
                {idxState === 'done' && (
                  <span className="text-[10px] text-green-500 shrink-0">✓ ready</span>
                )}
                {idxState === 'error' && (
                  <span className="text-[10px] text-red-400 shrink-0">✗ failed</span>
                )}
                <button
                  onClick={() => toggleDocSelection(fid)}
                  className="text-[10px] text-gray-400 hover:text-red-400 shrink-0"
                >✕</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Suggested questions */}
      {allSuggestions.length > 0 && onSuggestedQuestion && (
        <div className="rounded-xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/60 dark:bg-blue-900/10 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">
            <MessageSquare size={10} /> Suggested Questions
          </div>
          <div className="flex flex-col gap-1">
            {allSuggestions.map(({ q, filename }, i) => (
              <button
                key={i}
                onClick={() => onSuggestedQuestion(q)}
                className="text-left text-[11px] text-blue-700 dark:text-blue-300 hover:text-primary hover:bg-white/60 dark:hover:bg-white/10 px-2 py-1.5 rounded-lg transition-colors border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
                title={`From: ${filename}`}
              >{q}</button>
            ))}
          </div>
        </div>
      )}

      {/* Scanning skeleton */}
      {scanStatus === 'running' && files.length === 0 && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-white/5 dark:via-white/10 dark:to-white/5 animate-pulse" />
          ))}
          <p className="text-[11px] text-center text-gray-400 animate-pulse">Scanning Drive…</p>
        </div>
      )}

      {/* Scan failed */}
      {scanStatus === 'failed' && files.length === 0 && (
        <div className="text-center py-4">
          <AlertCircle size={20} className="text-red-400 mx-auto mb-2" />
          <p className="text-xs text-gray-500 mb-2">Drive scan failed</p>
          <button onClick={handleRefresh} className="text-xs text-primary border border-primary/30 px-3 py-1 rounded-lg hover:bg-primary/5">Retry</button>
        </div>
      )}

      {/* Empty */}
      {scanStatus === 'complete' && filtered.length === 0 && (
        <div className="text-sm text-gray-500 text-center py-4">
          {searchQuery ? 'No drive files match your search.' : 'No drive files found.'}
        </div>
      )}

      {/* File list */}
      <div className="space-y-1.5">
        {filtered.map(file => {
          const fid        = file.id || file.drive_id;
          const { icon, color, label } = getFileType(file.mimeType || '');
          const isSelected = selectedDocs.includes(fid);
          const isDisabled = !isSelected && selectedDocs.length >= 3;
          const idxState   = indexing[fid];
          const isIndexed  = indexedIds.has(fid);

          return (
            <div
              key={fid}
              onClick={() => { if (isDisabled) return; handleSelect(file); }}
              title={
                isDisabled ? 'Max 3 selected' :
                isSelected ? 'Deselect' :
                'Select for chat (will auto-index)'
              }
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
                onChange={() => !isDisabled && handleSelect(file)}
                onClick={e => e.stopPropagation()}
                className="w-4 h-4 shrink-0 accent-primary cursor-pointer disabled:cursor-not-allowed rounded"
              />

              {/* File icon with overlay badges */}
              <div
                className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-base relative"
                style={{ background: `${color}20`, border: `1.5px solid ${color}38` }}
              >
                {icon}
                {idxState === 'indexing' && (
                  <div className="absolute inset-0 rounded-lg bg-black/30 flex items-center justify-center">
                    <Loader2 size={12} className="animate-spin text-white" />
                  </div>
                )}
                {(idxState === 'done' || isIndexed) && idxState !== 'indexing' && (
                  <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full flex items-center justify-center shadow-sm">
                    <span className="text-white text-[8px] font-bold leading-none">✓</span>
                  </div>
                )}
                {idxState === 'error' && (
                  <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center shadow-sm">
                    <span className="text-white text-[8px] font-bold leading-none">!</span>
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {highlightText(file.name, searchQuery)}
                </div>
                <div className="text-[10px] text-gray-400 flex items-center gap-1 flex-wrap">
                  <span className="font-bold uppercase px-1 py-0.5 rounded text-[9px]"
                    style={{ color, background: `${color}1a` }}>{label}</span>
                  {file.size && <span>{fmtSize(file.size)}</span>}
                  <span>• {fmtDate(file.modifiedTime || file.createdTime)}</span>
                  {idxState === 'indexing' && <span className="text-blue-400 animate-pulse">• indexing…</span>}
                  {(idxState === 'done' || (isIndexed && idxState !== 'error')) && <span className="text-green-500">• indexed</span>}
                  {idxState === 'error' && <span className="text-red-400">• index failed</span>}
                </div>
              </div>
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