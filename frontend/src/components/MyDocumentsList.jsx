import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  FileText, FileImage, File, Search, Trash2,
  Loader2, AlertCircle, CalendarDays, Database,
  X, ShieldAlert, CheckCircle2, RefreshCw,
  CheckSquare, Square,
} from 'lucide-react';
import { documentAPI } from '../services/api';

// ─── Helpers ────────────────────────────────────────────────────────────────────

const getTheme = (dark) => ({
  bgPage: dark ? '#0F172A' : 'transparent',
  bgSidebar: dark ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.82)',
  bgTopbar: dark ? 'rgba(15,23,42,0.88)' : 'rgba(255,255,255,0.84)',
  bgCard: dark ? '#1E293B' : '#FFFFFF',
  bgCardHover: dark ? '#243044' : '#FFF5F9',
  bgSecondary: dark ? 'rgba(255,255,255,0.06)' : '#F8FAFC',
  bgInput: dark ? 'rgba(255,255,255,0.06)' : 'rgba(249,95,158,0.04)',
  bgTag: dark ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
  border: dark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
  borderCard: dark ? 'rgba(255,255,255,0.09)' : '#EAF0F7',
  borderCardHov: 'rgba(249,95,158,0.50)',
  textPrimary: dark ? '#F1F5F9' : '#0F172A',
  textSecondary: dark ? '#94A3B8' : '#64748B',
  textMuted: dark ? '#64748B' : '#94A3B8',
  shadow: dark ? '0 2px 10px rgba(0,0,0,0.35)' : '0 1px 5px rgba(0,0,0,0.06)',
  shadowHov: dark ? '0 8px 32px rgba(249,95,158,0.20)' : '0 8px 28px rgba(249,95,158,0.15)',
  scanBarBg: dark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
  codeBlock: dark ? 'rgba(255,255,255,0.07)' : '#F8FAFC',
  resultHeader: dark ? 'rgba(255,255,255,0.015)' : 'rgba(249,95,158,0.015)',
  folderActive: dark ? 'rgba(249,95,158,0.11)' : 'rgba(249,95,158,0.06)',
  folderHov: dark ? 'rgba(255,255,255,0.04)' : 'rgba(249,95,158,0.035)',
  scanDisabled: dark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
});

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getFileInfo = (filename = '', isDark) => {
  const ext = filename.split('.').pop()?.toLowerCase() || 'file';
  const map = {
    pdf:  { Icon: FileText,  iconColor: isDark ? 'text-rose-400' : 'text-rose-500',   bg: isDark ? 'bg-rose-500/10' : 'bg-rose-100',   badgeCls: isDark ? 'bg-rose-500/15 text-rose-400 border-rose-500/25' : 'bg-rose-100 text-rose-600 border-rose-200' },
    docx: { Icon: FileText,  iconColor: isDark ? 'text-blue-400' : 'text-blue-600',   bg: isDark ? 'bg-blue-500/10' : 'bg-blue-100',   badgeCls: isDark ? 'bg-blue-500/15 text-blue-400 border-blue-500/25' : 'bg-blue-100 text-blue-600 border-blue-200' },
    doc:  { Icon: FileText,  iconColor: isDark ? 'text-blue-400' : 'text-blue-600',   bg: isDark ? 'bg-blue-500/10' : 'bg-blue-100',   badgeCls: isDark ? 'bg-blue-500/15 text-blue-400 border-blue-500/25' : 'bg-blue-100 text-blue-600 border-blue-200' },
    txt:  { Icon: FileText,  iconColor: isDark ? 'text-gray-400' : 'text-gray-500',   bg: isDark ? 'bg-gray-500/10' : 'bg-gray-100',   badgeCls: isDark ? 'bg-gray-500/15 text-gray-400 border-gray-500/25' : 'bg-gray-100 text-gray-600 border-gray-200' },
    md:   { Icon: FileText,  iconColor: isDark ? 'text-teal-400' : 'text-teal-600',   bg: isDark ? 'bg-teal-500/10' : 'bg-teal-100',   badgeCls: isDark ? 'bg-teal-500/15 text-teal-400 border-teal-500/25' : 'bg-teal-100 text-teal-600 border-teal-200' },
    png:  { Icon: FileImage, iconColor: isDark ? 'text-violet-400' : 'text-violet-600', bg: isDark ? 'bg-violet-500/10' : 'bg-violet-100', badgeCls: isDark ? 'bg-violet-500/15 text-violet-400 border-violet-500/25' : 'bg-violet-100 text-violet-600 border-violet-200' },
    jpg:  { Icon: FileImage, iconColor: isDark ? 'text-violet-400' : 'text-violet-600', bg: isDark ? 'bg-violet-500/10' : 'bg-violet-100', badgeCls: isDark ? 'bg-violet-500/15 text-violet-400 border-violet-500/25' : 'bg-violet-100 text-violet-600 border-violet-200' },
    jpeg: { Icon: FileImage, iconColor: isDark ? 'text-violet-400' : 'text-violet-600', bg: isDark ? 'bg-violet-500/10' : 'bg-violet-100', badgeCls: isDark ? 'bg-violet-500/15 text-violet-400 border-violet-500/25' : 'bg-violet-100 text-violet-600 border-violet-200' },
    svg:  { Icon: FileImage, iconColor: isDark ? 'text-orange-400' : 'text-orange-600', bg: isDark ? 'bg-orange-500/10' : 'bg-orange-100', badgeCls: isDark ? 'bg-orange-500/15 text-orange-400 border-orange-500/25' : 'bg-orange-100 text-orange-600 border-orange-200' },
  };
  return {
    ...(map[ext] ?? { 
      Icon: File, 
      iconColor: isDark ? 'text-primary' : 'text-primary', 
      bg: isDark ? 'bg-primary/10' : 'bg-primary/10', 
      badgeCls: isDark ? 'bg-primary/15 text-primary border-primary/25' : 'bg-primary/10 text-primary border-primary/20' 
    }),
    ext,
  };
};

// ─── Highlight matching text ─────────────────────────────────────────────────────
const HighlightText = ({ text = '', query = '' }) => {
  if (!query.trim()) return <span>{text}</span>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  const re = new RegExp(`^${escaped}$`, 'i');
  return (
    <span>
      {parts.map((part, i) =>
        re.test(part)
          ? <mark key={i} className="bg-primary/30 text-gray-900 dark:text-white rounded-sm px-0.5 not-italic">{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </span>
  );
};

// ─── Toast ───────────────────────────────────────────────────────────────────────
const Toast = ({ message, type = 'success', onClose }) => (
  <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-[13px] font-medium
    ${type === 'success'
      ? 'bg-[#0c1e15] border-emerald-700/40 text-emerald-300'
      : 'bg-[#1e0c0c] border-red-700/40 text-red-300'
    }`}
  >
    {type === 'success'
      ? <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
      : <AlertCircle size={15} className="text-red-400 shrink-0" />
    }
    <span>{message}</span>
    <button onClick={onClose} className="ml-2 opacity-50 hover:opacity-100 transition-opacity">
      <X size={13} />
    </button>
  </div>
);

// ─── Deleting overlay ────────────────────────────────────────────────────────────
const DeletingOverlay = () => (
  <div className="absolute inset-0 rounded-2xl bg-black/65 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 z-20">
    <Loader2 size={20} className="text-red-400 animate-spin" />
    <span className="text-[10px] font-semibold text-red-300 tracking-widest uppercase">Deleting…</span>
  </div>
);

// ─── Skeleton ────────────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="border border-white/[0.07] rounded-2xl p-4 flex flex-col gap-3 animate-pulse h-[100px] bg-white/[0.02]">
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-white/[0.07] shrink-0" />
      <div className="flex-1 space-y-2 min-w-0">
        <div className="h-3 bg-white/[0.07] rounded w-3/4" />
        <div className="h-2.5 bg-white/[0.07] rounded w-2/5" />
      </div>
      <div className="h-4 w-8 bg-white/[0.07] rounded" />
    </div>
    <div className="flex gap-3 pl-12">
      <div className="h-3 bg-white/[0.07] rounded w-24" />
      <div className="h-3 bg-white/[0.07] rounded w-16" />
    </div>
  </div>
);

// ─── Document card ───────────────────────────────────────────────────────────────
const DocumentCard = ({ doc, isSelected, onToggle, onDelete, deleting, searchQuery }) => {
  const name = doc.filename || doc.name || 'Untitled';
  const { Icon, iconColor, bg, badgeCls, ext } = getFileInfo(name);
  const displayName = name.includes('.') ? name.substring(0, name.lastIndexOf('.')) : name;

  return (
    <div
      className={`relative group flex flex-col gap-3 rounded-2xl border p-4 transition-all duration-200 cursor-pointer select-none overflow-hidden
        ${isSelected
          ? 'border-primary/50 bg-primary/[0.07] shadow-[0_0_0_1px_rgba(233,30,140,0.2),0_4px_16px_rgba(233,30,140,0.08)]'
          : 'border-white/[0.07] bg-white/[0.025] hover:border-primary/25 hover:bg-white/[0.045]'
        }`}
      onClick={() => onToggle(doc.id)}
    >
      {/* Deleting overlay */}
      {deleting && <DeletingOverlay />}

      {/* Selected left accent */}
      {isSelected && <div className="absolute left-0 top-3 bottom-3 w-[3px] bg-primary rounded-r-full" />}

      {/* ── Row 1: checkbox · icon · name · ext badge ── */}
      <div className="flex items-center gap-2.5">

        {/* Checkbox (always visible when selected, hover otherwise) */}
        <div
          className={`shrink-0 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          onClick={e => { e.stopPropagation(); onToggle(doc.id); }}
        >
          {isSelected
            ? <CheckSquare size={14} className="text-primary" />
            : <Square size={14} className="text-gray-500" />
          }
        </div>

        {/* File icon */}
        <div className={`shrink-0 w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
          <Icon size={16} className={iconColor} />
        </div>

        {/* File name */}
        <p className="flex-1 min-w-0 text-[12.5px] font-semibold text-gray-900 dark:text-white border:border-primary/50 truncate leading-snug" title={name}>
          <HighlightText text={displayName} query={searchQuery} />
        </p>

        {/* Extension badge */}
        <span className={`shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border tracking-widest ${badgeCls}`}>
          {ext}
        </span>
      </div>

      {/* ── Row 2: date · separator · size ── */}
      <div className="flex items-center gap-2 pl-[46px] text-[11px] text-gray-500">
        <CalendarDays size={9} className="shrink-0" />
        <span>{formatDate(doc.created_at || doc.uploaded_at || doc.upload_date)}</span>
        <span className="text-gray-700">·</span>
        <Database size={9} className="shrink-0" />
        <span>{formatBytes(doc.bytes || doc.file_size || doc.size)}</span>
      </div>

      {/* Delete button — bottom-right on hover */}
      <button
        onClick={e => { e.stopPropagation(); onDelete(doc); }}
        disabled={deleting}
        className="absolute bottom-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-all duration-150 w-6 h-6 rounded-lg flex items-center justify-center bg-red-500/10 hover:bg-red-500/25 text-red-400 border border-red-500/20 z-10"
        title="Delete"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
};

// ─── Confirm modal (THEMED VERSION) ─────────────────────────────────────────────

const ConfirmModal = ({ count, docName, onConfirm, onCancel, loading }) => {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      
      {/* Modal card */}
      <div className="glass-card w-full max-w-md p-6 animate-in fade-in zoom-in-95">

        {/* Header */}
        <div className="flex items-start gap-4 mb-5">
          
          {/* Icon */}
          <div className="w-11 h-11 rounded-xl bg-red-500/10 border border-red-400/30 flex items-center justify-center shrink-0">
            <ShieldAlert size={20} className="text-red-500" />
          </div>

          {/* Text */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-base">
              Delete permanently?
            </h3>

            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
              {count > 1 ? (
                <>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {count} documents
                  </span>{" "}
                  will be permanently removed from Cloudinary.
                  This action cannot be undone.
                </>
              ) : (
                <>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    “{docName}”
                  </span>{" "}
                  will be permanently removed from Cloudinary.
                  This action cannot be undone.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent my-4"/>

        {/* Buttons */}
        <div className="flex gap-3">
          
          {/* Cancel */}
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-gray-300/40 dark:border-white/10
                       text-gray-700 dark:text-gray-300
                       hover:bg-gray-100 dark:hover:bg-white/5
                       transition font-medium disabled:opacity-50"
          >
            Cancel
          </button>

          {/* Delete */}
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl font-semibold text-white
                       bg-gradient-to-r from-primary to-[#ff4d6d]
                       hover:opacity-90 active:scale-[0.98]
                       shadow-lg shadow-primary/20
                       transition flex items-center justify-center gap-2
                       disabled:opacity-60"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Delete {count > 1 ? `${count} files` : "file"}
          </button>
        </div>
      </div>
    </div>
  );
};



// ─── Main ────────────────────────────────────────────────────────────────────────
export default function MyDocumentsList() {
  const [documents, setDocuments]         = useState([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [error, setError]                 = useState(null);
  const [search, setSearch]               = useState('');
  const [selected, setSelected]           = useState(new Set());
  const [deletingIds, setDeletingIds]     = useState(new Set());
  const [confirmTarget, setConfirmTarget] = useState(null); // { ids, count, docName }
  const [toast, setToast]                 = useState(null);
  // Delete modal states
const [showDeleteModal, setShowDeleteModal] = useState(false);
const [docToDelete, setDocToDelete] = useState(null);
const [isDeleting, setIsDeleting] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchDocuments = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const data = await documentAPI.listDocuments();
      const list = Array.isArray(data) ? data : (data?.documents ?? []);
      list.sort((a, b) => {
        const da = new Date(a.created_at || a.uploaded_at || a.upload_date || 0);
        const db = new Date(b.created_at || b.uploaded_at || b.upload_date || 0);
        return db - da;
      });
      setDocuments(list);
      setSelected(new Set());
    } catch (err) {
      console.error('fetchDocuments error:', err);
      setError('Could not load documents. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchDocuments(false); }, [fetchDocuments]);

  // ── Filter ───────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter(d => (d.filename || d.name || '').toLowerCase().includes(q));
  }, [documents, search]);

  // ── Selection ────────────────────────────────────────────────────────────────
  const toggleOne = (id) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(
      selected.size === filtered.length
        ? new Set()
        : new Set(filtered.map(d => d.id))
    );

  const allSelected  = filtered.length > 0 && selected.size === filtered.length;
  const someSelected = selected.size > 0;

  // ── Delete ───────────────────────────────────────────────────────────────────
  const requestDelete     = (doc) => setConfirmTarget({ ids: [doc.id], count: 1, docName: doc.filename || doc.name || 'this file' });
  const requestBulkDelete = () => selected.size > 0 && setConfirmTarget({ ids: [...selected], count: selected.size, docName: '' });

  const doDeleteOne = async (id) => {
    try {
      await documentAPI.deleteDocument(id);
    } catch (err) {
      // 403 fallback — retry with explicit token
      const status = err?.response?.status || err?.status;
      if (status === 403) {
        const token = localStorage.getItem('token') || localStorage.getItem('access_token');
        const res = await fetch(`/api/documents/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.detail || `HTTP ${res.status}`);
        }
      } else {
        throw err;
      }
    }
  };

  const executeDelete = async () => {
    if (!confirmTarget) return;
    const { ids, count, docName } = confirmTarget;
    setConfirmTarget(null);
    setDeletingIds(new Set(ids));

    const failed = [];
    await Promise.all(
      ids.map(async (id) => {
        try { await doDeleteOne(id); }
        catch { failed.push(id); }
      })
    );

    const successIds = ids.filter(id => !failed.includes(id));
    if (successIds.length) {
      setDocuments(prev => prev.filter(d => !successIds.includes(d.id)));
      setSelected(prev => {
        const next = new Set(prev);
        successIds.forEach(id => next.delete(id));
        return next;
      });
    }

    setDeletingIds(new Set());

    if (!failed.length) {
      showToast(count > 1 ? `${count} documents deleted.` : `"${docName}" deleted.`, 'success');
    } else if (failed.length < ids.length) {
      showToast(`${successIds.length} deleted, ${failed.length} failed.`, 'error');
    } else {
      showToast('Delete failed. Please try again.', 'error');
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 h-full">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap shrink-0">
        <div>
          <h1 className="text-[17px] font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText size={18} className="text-primary shrink-0" />
            My Documents
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5 pl-6">
            {loading ? 'Loading…' : `${documents.length} file${documents.length !== 1 ? 's' : ''} · sorted by latest`}
          </p>
        </div>

        <button
          onClick={() => fetchDocuments(true)}
          disabled={refreshing || loading}
          className="flex items-center gap-1.5 text-[12px] font-medium text-gray-700  border border-white/[0.08]  px-3 py-1.5 rounded-xl transition-all disabled:opacity-40 bg-white/[0.03] hover:scale-105 dark:bg-white/[0.04] dark:border-white/[0.10] dark:text-gray-300"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin text-primary' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Search */}
      <div className="relative shrink-0 ">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 b text-gray-500 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by filename…"
          className="w-full pl-10 pr-9 py-2.5 text-[13px] bg-white/[0.04] border border-gray-300 dark:border-white/[0.10] rounded-xl text-gray-900 dark:text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/15 transition-all"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
            <X size={13} />
          </button>
        )}
      </div>

      {/* Toolbar */}
      {!loading && filtered.length > 0 && (
        <div className="flex items-center justify-between gap-2 shrink-0">
          <button
            onClick={toggleAll}
            className="flex items-center gap-1.5 text-[12px] font-medium text-gray-500 hover:text-white transition-colors"
          >
            {allSelected
              ? <CheckSquare size={14} className="text-primary" />
              : <Square size={14} />
            }
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>

          <div className="flex items-center gap-2">
            {search && (
              <span className="text-[11px]  text-gray-400">
                {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              </span>
            )}
            {someSelected && (
              <>
                <button
                  onClick={requestBulkDelete}
                  className="flex items-center gap-1.5 text-[12px] font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-xl transition-all"
                >
                  <Trash2 size={12} />
                  Delete {selected.size}
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all"
                  title="Clear selection"
                >
                  <X size={12} />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar -mx-1 px-1 pb-4">

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2  lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center text-gray-900 dark:text-white justify-center py-20 gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center">
              <AlertCircle size={22} className="text-red-400" />
            </div>
            <p className="text-sm text-gray-900 dark:text-white">{error}</p>
            <button
              onClick={() => fetchDocuments(false)}
              className="text-xs text-gray-900 dark:text-white border border-primary/30 px-4 py-1.5 rounded-xl hover:bg-primary/5 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <FileText size={26} className="text-gray-900 dark:text-white" />
            </div>
            <p className="text-[13px] font-semibold text-gray-900 dark:text-white">
              {search ? `No files match "${search}"` : 'No documents yet'}
            </p>
            <p className="text-[12px] text-gray-900 dark:text-white">
              {search ? 'Try a different search term.' : 'Upload a document from the Chat page to get started.'}
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2  lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map(doc => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                isSelected={selected.has(doc.id)}
                onToggle={toggleOne}
                onDelete={requestDelete}
                deleting={deletingIds.has(doc.id)}
                searchQuery={search}
              />
            ))}
          </div>
        )}
      </div>

      {/* Confirm modal */}
      {confirmTarget && (
        <ConfirmModal
          count={confirmTarget.count}
          docName={confirmTarget.docName}
          onConfirm={executeDelete}
          onCancel={() => setConfirmTarget(null)}
          loading={deletingIds.size > 0}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}