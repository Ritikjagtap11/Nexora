/**
 * DriveChatDocumentList.jsx
 * Synchronized with global useBackgroundTasks context, personal Drive root files,
 * and supported indexable file formats.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  HardDrive, RefreshCw, Search, CheckSquare,
  AlertCircle, X, Loader2, MessageSquare,
} from 'lucide-react';
import { driveAPI, chatAPI } from '../services/api';
import { useChatContext } from '../context/ChatContext';
import { useBackgroundTasks } from '../context/BackgroundTasksContext';

// ── File type helpers ─────────────────────────────────────────────────────────
const getFileType = (mime = '', name = '') => {
  const mimeLower = mime.toLowerCase();
  const ext = name.split('.').pop()?.toLowerCase() || '';

  if (mimeLower.includes('pdf') || ext === 'pdf')
    return { icon: '📄', color: '#EF4444', label: 'PDF' };
  if (mimeLower.includes('word') || mimeLower.includes('document') || ext === 'docx' || ext === 'doc')
    return { icon: '📝', color: '#3B82F6', label: 'DOC' };
  if (mimeLower.includes('sheet') || mimeLower.includes('excel') || ext === 'xlsx' || ext === 'xls')
    return { icon: '📊', color: '#22C55E', label: 'XLS' };
  if (mimeLower.includes('presentation') || mimeLower.includes('powerpoint') || ext === 'pptx' || ext === 'ppt')
    return { icon: '📑', color: '#F97316', label: 'PPT' };
  if (mimeLower.includes('text') || ext === 'txt' || ext === 'md')
    return { icon: '📄', color: '#64748B', label: 'TXT' };
  if (mimeLower.includes('image') || ['png', 'jpg', 'jpeg'].includes(ext))
    return { icon: '🖼️', color: '#8B5CF6', label: 'IMG' };
  return { icon: '📄', color: '#94A3B8', label: 'FILE' };
};

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
  const {
    deepScanState,
    driveConnected,
    startPersistentDeepScan,
    indexedDriveFileIds,
    fetchIndexedDriveFileIds
  } = useBackgroundTasks();

  const [myDriveFiles, setMyDriveFiles]     = useState([]);
  const [myDriveLoading, setMyDriveLoading] = useState(false);
  const [searchQuery, setSearchQuery]       = useState('');
  const [showBanner, setShowBanner]         = useState(true);
  const [indexing, setIndexing]             = useState({});          // fid → 'indexing'|'done'|'error'
  const [suggestedQuestions, setSuggestedQuestions] = useState({}); // fid → [questions]

  const { selectedDocs, toggleDocSelection, setSelectedDocs } = useChatContext();

  // ── Fetch personal Drive files from root ──────────────────────────────────
  const fetchMyDriveFiles = useCallback(async () => {
    if (!driveConnected) return;
    setMyDriveLoading(true);
    try {
      const res = await driveAPI.listMyDrive('root');
      const list = res.files || res.items || res || [];
      setMyDriveFiles(list);
    } catch (err) {
      console.error('[DriveChatDocumentList] Failed to fetch root files:', err);
    } finally {
      setMyDriveLoading(false);
    }
  }, [driveConnected]);

  // Load files on mount or connection change
  useEffect(() => {
    fetchMyDriveFiles();
  }, [fetchMyDriveFiles, driveConnected]);

  const handleRefresh = async () => {
    await fetchMyDriveFiles();
    await startPersistentDeepScan();
  };

  // ── fetchSuggestedQuestions ────────────────────────────────────────────────
  const fetchSuggestedQuestions = useCallback(async (driveFileId, docId) => {
    try {
      const res = await chatAPI.getSuggestedQuestions([docId]);
      const questions = res?.questions || res?.suggested_questions || [];
      if (questions.length) {
        setSuggestedQuestions(prev => ({ ...prev, [driveFileId]: questions }));
      }
    } catch (err) {
      console.error('[DriveChatDocumentList] Suggested questions error:', err);
    }
  }, []);

  // ── Index drive file ───────────────────────────────────────────────────────
  const indexFile = async (file) => {
    const fid = file.id || file.drive_id;

    if (indexedDriveFileIds.has(fid)) {
      const storedDocId = sessionStorage.getItem(`nexora_drive_docid_${fid}`);
      if (storedDocId && !suggestedQuestions[fid]) {
        fetchSuggestedQuestions(fid, storedDocId);
      }
      return;
    }

    setIndexing(prev => ({ ...prev, [fid]: 'indexing' }));
    try {
      const result = await driveAPI.indexFile(fid);
      const docId = result.doc_id;

      sessionStorage.setItem(`nexora_drive_docid_${fid}`, docId);
      
      // Refresh global indexed drive IDs from server
      await fetchIndexedDriveFileIds();

      setIndexing(prev => ({ ...prev, [fid]: 'done' }));
      await fetchSuggestedQuestions(fid, docId);
    } catch (err) {
      console.error('[DriveChatDocumentList] Index error:', err);
      setIndexing(prev => ({ ...prev, [fid]: 'error' }));
    }
  };

  const handleSelect = (file) => {
    const fid = file.id || file.drive_id;
    const isSelected = selectedDocs.includes(fid);
    toggleDocSelection(fid);
    if (!isSelected) indexFile(file);
  };

  // ── Merge & filter files ──────────────────────────────────────────────────
  const mergedFiles = [];
  const fileIds = new Set();

  myDriveFiles.forEach(file => {
    const fid = file.id || file.drive_id;
    if (fid && !fileIds.has(fid)) {
      fileIds.add(fid);
      mergedFiles.push(file);
    }
  });

  (deepScanState.scannedFiles || []).forEach(file => {
    const fid = file.id || file.drive_id;
    if (fid && !fileIds.has(fid)) {
      fileIds.add(fid);
      mergedFiles.push(file);
    }
  });

  // Filter to supported formats only: pdf, docx, doc, txt, md, csv, pptx, xlsx
  const SUPPORTED_EXTENSIONS = ['pdf', 'docx', 'doc', 'txt', 'md', 'csv', 'pptx', 'xlsx'];
  const filtered = mergedFiles.filter(file => {
    const ext = file.name?.split('.').pop()?.toLowerCase() || '';
    const matchesSearch = !searchQuery ||
      (file.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (file.full_path || file.folderPath || '').toLowerCase().includes(searchQuery.toLowerCase());
    return SUPPORTED_EXTENSIONS.includes(ext) && matchesSearch;
  });

  // Auto fetch suggested questions for selected files when they're ready
  useEffect(() => {
    filtered.forEach(file => {
      const fid = file.id || file.drive_id;
      if (selectedDocs.includes(fid) && indexedDriveFileIds.has(fid) && !suggestedQuestions[fid]) {
        const storedDocId = sessionStorage.getItem(`nexora_drive_docid_${fid}`);
        if (storedDocId) {
          fetchSuggestedQuestions(fid, storedDocId);
        }
      }
    });
  }, [selectedDocs, filtered, indexedDriveFileIds, suggestedQuestions, fetchSuggestedQuestions]);

  const selectedFileObjs = filtered.filter(f => selectedDocs.includes(f.id || f.drive_id));
  const allSuggestions   = selectedFileObjs
    .flatMap(f => {
      const fid = f.id || f.drive_id;
      const questions = suggestedQuestions[fid] || f.suggested_questions || [];
      return questions.map(q => ({ q, filename: f.name }));
    })
    .slice(0, 6);

  const listLoading = myDriveLoading || (deepScanState.scanStatus === 'running' && filtered.length === 0);

  return (
    <div className="flex flex-col gap-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-base text-gray-900 dark:text-white">
          <HardDrive size={16} className="text-primary" />
          Drive Files
          <span className="text-[11px] font-normal text-gray-400">({filtered.length})</span>
        </h2>
        <button onClick={handleRefresh} disabled={listLoading}
          className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md text-gray-500 dark:text-gray-400 transition-colors disabled:opacity-40"
          title="Scan and Refresh Drive">
          <RefreshCw size={15} className={listLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Scanning status pulsing alert */}
      {deepScanState.scanStatus === 'running' && (
        <div className="p-3 bg-primary/10 border border-primary/25 rounded-xl shadow-sm animate-pulse dark:bg-primary/20 dark:border-primary/40 flex items-center gap-3">
          <Loader2 size={16} className="animate-spin text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold text-primary uppercase tracking-wider">
              Scanning Google Drive...
            </div>
            {deepScanState.scanProgress?.current_file && (
              <div className="text-[10px] text-gray-600 dark:text-gray-300 truncate">
                Processing: {deepScanState.scanProgress.current_file}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info banner */}
      {showBanner && filtered.length > 0 && (
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
          placeholder="Search Drive files..."
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
      {listLoading && filtered.length === 0 && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-white/5 dark:via-white/10 dark:to-white/5 animate-pulse" />
          ))}
          <p className="text-[11px] text-center text-gray-400 animate-pulse">Loading files…</p>
        </div>
      )}

      {/* Scan failed / Not Connected */}
      {!listLoading && driveConnected === false && (
        <div className="text-center py-4">
          <AlertCircle size={20} className="text-red-400 mx-auto mb-2" />
          <p className="text-xs text-gray-500 mb-1">Google Drive not connected.</p>
          <p className="text-[10px] text-gray-400 mb-2">
            Go to the Drive page to connect your account.
          </p>
          <button
            onClick={() => window.location.href = '/app/drive'}
            className="text-xs text-primary border border-primary/30 px-3 py-1 rounded-lg hover:bg-primary/5"
          >
            Connect Drive
          </button>
        </div>
      )}

      {/* Empty */}
      {!listLoading && driveConnected !== false && filtered.length === 0 && (
        <div className="text-sm text-gray-500 text-center py-4">
          {searchQuery ? 'No supported drive files match.' : 'No supported drive files found.'}
        </div>
      )}

      {/* File list */}
      <div className="space-y-1.5">
        {filtered.map(file => {
          const fid        = file.id || file.drive_id;
          const { icon, color, label } = getFileType(file.mimeType || '', file.name || '');
          const isSelected = selectedDocs.includes(fid);
          const isDisabled = !isSelected && selectedDocs.length >= 3;
          const idxState   = indexing[fid];
          const isIndexed  = indexedDriveFileIds.has(fid);

          return (
            <div
              key={fid}
              onClick={() => { if (isDisabled) return; handleSelect(file); }}
              title={
                isDisabled   ? 'Max 3 selected' :
                isSelected   ? 'Deselect' :
                'Select for chat (will auto-index)'
              }
              className={`group flex items-center gap-2.5 p-2.5 rounded-xl border transition-all
                ${isSelected
                  ? 'bg-[#fff0f7] border-primary/40 shadow-[0_0_0_2px_rgba(249,95,158,0.12)] dark:bg-primary/10 dark:border-primary/30 cursor-pointer'
                  : isDisabled
                    ? 'opacity-45 cursor-not-allowed bg-white/70 border-gray-100 dark:bg-white/3 dark:border-white/5'
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