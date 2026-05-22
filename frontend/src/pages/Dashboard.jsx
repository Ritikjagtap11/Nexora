import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  LogOut, Sun, Moon, User, Search, UploadCloud, FileText, FileType2,
  MessageSquare, ChevronDown, Folder, Clock, CheckCircle2,
  HardDrive, TrendingUp, Cpu, Sparkles, Send
} from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { chatAPI, driveAPI, documentAPI } from '../services/api';
import FilePreviewDrawer from '../components/FilePreviewDrawer';
import SharedNavbar from '../components/SharedNavbar';
import DocumentUpload from '../components/DocumentUpload';
import { useBackgroundTasks } from '../context/BackgroundTasksContext';




const getFolderFileCount = (folder) => {
  if (!folder) return 0;
  if (folder.file_count !== undefined) return folder.file_count;
  if (folder.total_files !== undefined) return folder.total_files;
  if (Array.isArray(folder.files)) return folder.files.length;
  if (Array.isArray(folder.documents)) return folder.documents.length;
  if (Array.isArray(folder.items)) return folder.items.length;
  return 0;
};


function PlusIcon(props) {
  return <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
}

const colorMap = {
  indigo: 'text-indigo-500 bg-indigo-50 border-indigo-100 dark:bg-indigo-500/10 dark:border-indigo-500/20',
  emerald: 'text-emerald-500 bg-emerald-50 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20',
  amber: 'text-amber-500 bg-amber-50 border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20',
  blue: 'text-blue-500 bg-blue-50 border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/20',
  purple: 'text-purple-500 bg-purple-50 border-purple-100 dark:bg-purple-500/10 dark:border-purple-500/20',
};


export default function Dashboard() {
  const { logout, user } = useAuth();
  const { isDarkMode, toggleTheme, getLogo } = useTheme();
  const navigate = useNavigate();
  const [llmStatus, setLlmStatus] = useState(null);
  const [quickChatInput, setQuickChatInput] = useState('');
  const [quickChatLoading, setQuickChatLoading] = useState(false);
  const [quickChatMessages, setQuickChatMessages] = useState([
    { role: 'assistant', content: 'Hi there! I am your NEXORA AI. Ask me anything about your indexed documents.' }
  ]);

  const [recentDocs, setRecentDocs] = useState([]);
  const [totalDocsCount, setTotalDocsCount] = useState(0);
  const quickChatAccumulatorRef = useRef('');
  const [previewFile, setPreviewFile] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [docsLoading, setDocsLoading] = useState(false);
  const hasLoadedDocs = useRef(false);
  const hasLoadedFolders = useRef(false);
  const {
    driveConnected,
    deepScanState,
    myDriveFolders,
    myDriveFiles,
    myDriveLoading,
    loadMyDrive,
    indexedDriveFileIds,
  } = useBackgroundTasks();
  const [connectLoading, setConnectLoading] = useState(false);

  const handleConnectDrive = async () => {
    setConnectLoading(true);
    try {
      const res = await api.get('/api/drive/oauth/auth-url');
      if (res.data?.auth_url) {
        window.location.href = res.data.auth_url;
      }
    } catch (err) {
      console.error("Failed to connect Drive:", err);
    } finally {
      setConnectLoading(false);
    }
  };
  // Γ£à Dashboard cache expiry = 5 minutes
  const CACHE_EXPIRY = 5 * 60 * 1000;

  // Global Search
  const [globalSearch, setGlobalSearch] = useState('');
  const [debouncedGlobalSearch, setDebouncedGlobalSearch] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  const fetchFolders = async (isManual = false) => {
    if (driveConnected) {
      try {
        await loadMyDrive('root');
      } catch (err) {
        console.error("Failed to fetch folders in dashboard:", err);
      }
    }
  };

  const fetchDashboardData = async (isManual = false) => {

    // Try cache first
    if (!isManual) {
      const cachedDocs = loadCache("recent_docs");

      if (cachedDocs) {
        console.log("Using cached recent docs");
        setRecentDocs(cachedDocs);
        try {
          const docs = await documentAPI.listDocuments();
          const filteredDocs = docs.filter(doc => doc.filename || doc.id);
          setTotalDocsCount(filteredDocs.length);
        } catch {}
        fetchFolders(false); // folders also from cache
        return;
      }
    }

    setDocsLoading(true);

    try {
      const docs = await documentAPI.listDocuments();

      const filteredDocs = docs.filter(doc => doc.filename || doc.id);
      setTotalDocsCount(filteredDocs.length);

      // Sort by most recent timestamp ΓÇö newest uploaded always first
      filteredDocs.sort((a, b) => {
        const getTime = (doc) => {
          const raw =
            doc.created_at ||
            doc.uploaded_at ||
            doc.upload_date ||
            doc.modifiedTime ||
            doc.timestamp ||
            null;

          if (!raw) return 0;

          const t = new Date(raw).getTime();
          return isNaN(t) ? 0 : t;
        };

        return getTime(b) - getTime(a); // descending: latest first
      });

const latestDocs = filteredDocs.slice(0, 3);

      setRecentDocs(latestDocs);

      // ≡ƒÆ╛ SAVE CACHE
      saveCache("recent_docs", latestDocs);

      await fetchFolders(isManual);

    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setDocsLoading(false);
    }
  };
  // ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const health = await chatAPI.healthCheck();
        setLlmStatus(health.llm_status);
      } catch (error) {
        console.error("Failed to fetch LLM status:", error);
      }
    };

    fetchStatus();

    // ≡ƒºá LOAD FROM CACHE OR API
    fetchDashboardData(false);

    // Background silent sync every 60 sec (NO loader)
    const interval = setInterval(async () => {
      try {
        const docs = await documentAPI.listDocuments();
        const filteredDocs = docs.filter(doc => doc.filename || doc.id);
        setTotalDocsCount(filteredDocs.length);

        // Sort by most recent timestamp ΓÇö newest uploaded always first
        filteredDocs.sort((a, b) => {
          const getTime = (doc) => {
            const raw =
              doc.created_at ||
              doc.uploaded_at ||
              doc.upload_date ||
              doc.modifiedTime ||
              doc.timestamp ||
              null;

            if (!raw) return 0;

            const t = new Date(raw).getTime();
            return isNaN(t) ? 0 : t;
          };

          return getTime(b) - getTime(a); // descending: latest first
        });

        const latestDocs = filteredDocs.slice(0, 3);
        setRecentDocs(latestDocs);
        saveCache("recent_docs", latestDocs);
      } catch (err) {
        console.error("Silent sync failed:", err);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (driveConnected === true) {
      fetchDashboardData(true);
    }
  }, [driveConnected]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedGlobalSearch(globalSearch), 400);
    return () => clearTimeout(timer);
  }, [globalSearch]);

  useEffect(() => {
    if (!debouncedGlobalSearch) {
      setGlobalSearchResults(null);
      return;
    }
    const search = async () => {
      setIsSearching(true);
      try {
        const res = await driveAPI.searchDrive(debouncedGlobalSearch, 'all');
        setGlobalSearchResults(res);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    };
    search();
  }, [debouncedGlobalSearch]);

  const handleQuickChatSubmit = async (e) => {
    e.preventDefault();
    const userMessage = quickChatInput.trim();
    if (!userMessage || quickChatLoading) return;

    setQuickChatInput('');
    setQuickChatLoading(true);

    const history = quickChatMessages.map(msg => ({ role: msg.role, content: msg.content }));

    // Add user message and empty assistant message
    setQuickChatMessages(prev => [
      ...prev,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: '', sources: [], provider: null, streaming: true }
    ]);
    quickChatAccumulatorRef.current = '';

    try {
      await chatAPI.sendMessage(
        userMessage,
        history,
        [], // Empty array for all docs instead of null

        // onChunk
        (chunk) => {
          setQuickChatLoading(false);
          quickChatAccumulatorRef.current += chunk;
          const currentText = quickChatAccumulatorRef.current;
          setQuickChatMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === 'assistant') {
              updated[updated.length - 1] = { ...last, content: currentText, streaming: true };
            }
            return updated;
          });
        },

        // onMetadata
        (metadata) => {
          setQuickChatMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === 'assistant') {
              updated[updated.length - 1] = { ...last, metadata: metadata, provider: metadata.provider };
            }
            return updated;
          });
        },

        // onError
        (error) => {
          setQuickChatLoading(false);
          setQuickChatMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === 'assistant') {
              updated[updated.length - 1] = { ...last, content: last.content || 'Response was interrupted. Please try again.', error: true, streaming: false };
            }
            return updated;
          });
        }
      );
    } catch (err) {
      console.error('Stream error:', err);
      setQuickChatLoading(false);
      setQuickChatMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === 'assistant') {
          updated[updated.length - 1] = {
            ...last,
            content: 'Something went wrong. Please try again.',
            error: true,
            streaming: false,
            metadata: { answer_type: 'not_found', source_pages: [], confidence: 0, confidence_low: false, suggestions: [] }
          };
        }
        return updated;
      });
    } finally {
      setQuickChatLoading(false);
      setQuickChatMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === 'assistant') {
          updated[updated.length - 1] = { ...last, streaming: false };
        }
        return updated;
      });
    }
  };


  const getActiveAIProvider = () => {
    if (llmStatus?.gemini?.configured_keys > 0) return { name: 'Gemini 1.5 Pro', icon: <Sparkles size={12} className="text-white" />, color: 'bg-emerald-500' };
    if (llmStatus?.ollama?.available) return { name: 'Ollama Active', icon: <Cpu size={12} className="text-white" />, color: 'bg-emerald-500' };
    return { name: 'AI Standby', icon: <CheckCircle2 size={12} className="text-white" />, color: 'bg-gray-400' };
  };

  const activeAI = getActiveAIProvider();

  // ≡ƒöÑ DASHBOARD SESSION CACHE
  const DASHBOARD_CACHE_KEY = "nexora_dashboard_cache";

  const getDashboardCache = () => {
    try {
      const cached = sessionStorage.getItem(DASHBOARD_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  };

  const setDashboardCache = (data) => {
    try {
      sessionStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(data));
    } catch { }
  };

  // Save cache helper
  const saveCache = (key, data) => {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        data,
        timestamp: Date.now(),
      })
    );
  };

  // Read cache helper
  const loadCache = (key) => {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;

    const cache = JSON.parse(raw);

    // check expiry
    if (Date.now() - cache.timestamp > CACHE_EXPIRY) {
      sessionStorage.removeItem(key);
      return null;
    }

    return cache.data;
  };

 const getGreetingData = () => {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return {
      text: "Good morning",
      emoji: "🌅",
      sub: "Let's make today productive"
    };
  }

  if (hour >= 12 && hour < 17) {
    return {
      text: "Good afternoon",
      emoji: "☀️",
      sub: "Hope your day is going great"
    };
  }

  if (hour >= 17 && hour < 21) {
    return {
      text: "Good evening",
      emoji: "🌆",
      sub: "Time to wrap up some tasks"
    };
  }

  return {
    text: "Good night",
    emoji: "🌙",
    sub: "Take a break and recharge"
  };
};
const greeting = getGreetingData();

  return (
    <div className="app-background min-h-screen text-gray-900 dark:text-white transition-colors duration-300 font-sans flex flex-col">
      <SharedNavbar />

      {/* ΓöüΓöüΓöü MAIN CONTENT ΓöüΓöüΓöü */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6" style={{ paddingTop: "88px" }}>

        {/* SECTION 1 ΓÇö Welcome Banner */}
        <section className="glass-card w-full p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute top-[-50%] right-[-10%] w-[300px] h-[300px] rounded-full bg-primary/10 blur-[80px] pointer-events-none" />
          <div className="relative z-10">
            <div className="mb-1">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white leading-tight">
                {greeting.emoji}{greeting.text},{" "}
                <span className="text-gradient">
                  {user?.displayName || "User"}
                </span>
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400 text-lg">
                {greeting.sub}
              </p>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base max-w-xl leading-relaxed">
              You have <b>{totalDocsCount}</b> documents indexed. Ask anything across your knowledge base.
            </p>
          </div>
          <button onClick={() => setUploadOpen(true)} className="relative z-10 group flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm sm:text-base bg-primary hover:bg-primary-light text-white transition-all shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/35 hover:-translate-y-0.5 whitespace-nowrap">
            <UploadCloud className="w-5 h-5" />
            Upload Document
          </button>
        </section>

        {/* SECTION 2 — Stats Row */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {(() => {
            const uniqueScannedFolders = new Set(
              (deepScanState?.scannedFiles || [])
                .map(file => file.folder_name || file.full_path?.split('/')[0])
                .filter(Boolean)
            );

            const totalDriveFolders = deepScanState?.scanStatus === 'complete' && uniqueScannedFolders.size > 0
              ? uniqueScannedFolders.size
              : myDriveFolders.length;

            const totalDriveFiles = deepScanState?.scanStatus === 'complete' && deepScanState?.scannedFiles?.length > 0
              ? deepScanState.scannedFiles.length
              : myDriveFiles.length;

            const stats = [
              {
                label: 'Total Indexed Files',
                value: totalDocsCount.toString(),
                icon: <FileText className="w-5 h-5 text-[#F95F9E]" />,
                change: 'Active index',
              },
              {
                label: 'Total Drive Folders',
                value: totalDriveFolders.toString(),
                icon: <Folder className="w-5 h-5 text-[#F95F9E]" />,
                change: 'Synced',
              },
              {
                label: 'Total Drive Files',
                value: totalDriveFiles.toString(),
                icon: <HardDrive className="w-5 h-5 text-[#F95F9E]" />,
                change: 'Discovered',
              },
              {
                label: 'Queries Answered',
                value: '148',
                icon: <MessageSquare className="w-5 h-5 text-[#F95F9E]" />,
                change: 'Instant answers',
              },
            ];

            return stats.map((stat, i) => (
              <div key={i} className="glass-card p-5 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 border border-gray-200/50 dark:border-white/5 hover:border-[#F95F9E]/40 dark:hover:border-[#F95F9E]/40 hover:shadow-[0_0_20px_rgba(249,95,158,0.15)] dark:hover:shadow-[0_0_20px_rgba(249,95,158,0.25)]">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#F95F9E]/5 to-transparent rounded-bl-full -z-10 opacity-30 group-hover:opacity-80 transition-opacity" />
                <div className="w-10 h-10 rounded-xl bg-white/40 dark:bg-white/5 border border-gray-100 dark:border-white/5 shadow-sm flex items-center justify-center mb-4 text-[#F95F9E]">
                  {stat.icon}
                </div>
                <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{stat.value}</h3>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">{stat.label}</p>
                <div className="text-xs font-semibold text-[#F95F9E]/90 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#F95F9E]" /> {stat.change}
                </div>
              </div>
            ));
          })()}
        </section>



        {/* SECTION 4 ΓÇö Two Column Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* LEFT: Recent Documents (60% -> col-span-3) */}
          <div className="lg:col-span-3 glass-card flex flex-col">
            <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center">
              <h2 className="font-bold text-lg text-gray-900 dark:text-white">Recent documents</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => fetchDashboardData(true)}
                  disabled={docsLoading}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-white/5 transition-colors disabled:opacity-40"
                  title="Refresh"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 ${docsLoading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
                </button>
                <button
                  onClick={() => navigate('/app/documents')}
                  className="text-sm font-medium text-primary hover:text-primary-light transition-colors"
                >
                  View all
                </button>
              </div>
            </div>
            <div className="flex-1 p-2 sm:p-4 flex flex-col gap-1">
              {docsLoading ? (
                [1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-4 p-3 sm:p-4 rounded-xl animate-pulse">
                    <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-white/10 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-2/3" />
                      <div className="h-2 bg-gray-100 dark:bg-white/5 rounded w-1/3" />
                    </div>
                  </div>
                ))
              ) : recentDocs.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">No scanned documents found.</div>
              ) : recentDocs.slice(0, 3).map((doc, i) => {
                const id = doc.id || doc.public_id;
                const name = doc.filename || doc.name || (doc.public_id ? doc.public_id.split('/').pop() : "");
                const type = doc.format || doc.resource_type || doc.mimeType || doc.file_type || "";
                const docSize = doc.bytes || doc.size || doc.file_size;
                const docDate = doc.created_at || doc.uploaded_at || doc.upload_date || doc.modifiedTime || new Date().toISOString();

                let icon = FileText;
                let colorClass = 'text-gray-500 bg-gray-50 dark:bg-gray-500/10 border-gray-100 dark:border-gray-500/20';
                const ext = name.split('.').pop().toLowerCase();
                if (ext === 'pdf') colorClass = 'text-red-500 bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20';
                else if (ext === 'docx' || ext === 'doc') { icon = FileType2; colorClass = 'text-blue-500 bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20'; }
                else if (ext === 'pptx' || ext === 'ppt') colorClass = 'text-orange-500 bg-orange-50 dark:bg-orange-500/10 border-orange-100 dark:border-orange-500/20';
                else if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') colorClass = 'text-green-500 bg-green-50 dark:bg-green-500/10 border-green-100 dark:border-green-500/20';

                return (
                  <div key={id || i} className="flex items-center justify-between p-3 sm:p-4 rounded-xl hover:bg-white/60 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-gray-100 dark:hover:border-white/5 group cursor-pointer" onClick={() => setPreviewFile({ ...doc, id, name, summary: doc.summary || doc.ai_summary })}>
                    <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                      <div className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center border ${colorClass}`}>
                        {React.createElement(icon, { className: "w-5 h-5" })}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-sm text-gray-900 dark:text-white truncate">{name}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          {docSize ? `${(parseInt(docSize) / 1024 / 1024).toFixed(2)} MB` : 'Scanned'} • {new Date(docDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pl-3">
                      <span className="hidden sm:inline-flex px-2 py-1 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider rounded-md border border-emerald-100 dark:border-emerald-500/20">
                        Indexed
                      </span>
                      <button onClick={(e) => { e.stopPropagation(); navigate('/app/chat', { state: { autoAskFile: { ...doc, id, name } } }); }} className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-background-dark border border-gray-200 dark:border-white/10 hover:border-primary dark:hover:border-primary text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary rounded-lg text-xs font-semibold shadow-sm transition-all whitespace-nowrap">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Ask AI</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* RIGHT: Quick Chat (40% -> col-span-2) */}
          <div className="lg:col-span-2 glass-card flex flex-col overflow-hidden h-[450px] lg:h-auto">
            <div className="p-5 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-white/40 dark:bg-white/5">
              <h2 className="font-bold text-lg text-gray-900 dark:text-white">Meet Nexora AI</h2>
              <button onClick={() => navigate('/app/chat')} className="text-xs font-medium text-primary hover:text-primary-light transition-colors flex items-center gap-1">
                Open full chat
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 custom-scrollbar">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-1">Your personal document intelligence assistant</span>
              {/* Intro Chat Bubble */}
              <div className="self-start max-w-md bg-gradient-to-br from-primary/20 to-purple-500/10 
                                      border border-primary/20 rounded-2xl px-4 py-3 backdrop-blur-sm">

                <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                  Hi 👋 I'm <span className="font-semibold text-primary">Nexora AI</span>.
                  I understand your uploaded documents and help you find information instantly.
                </p>
              </div>

              {/* Features list */}
              <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300 p-4 rounded-xl 
                bg-gradient-to-r from-primary/10 via-purple-500/10 to-pink-500/10
                border border-primary/20 dark:border-white/10">

                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0"></span>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Ask questions from PDFs, DOCX & TXT
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0"></span>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Get instant summaries & insights
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-pink-500 shrink-0"></span>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Find files using natural language
                  </p>
                </div>

              </div>
            </div>
          </div>

        </section>

        {/* SECTION 5 ── Drive Folders Grid */}
        <section className="glass-card flex flex-col overflow-hidden mb-8">
          <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-white/40 dark:bg-white/5">
            <h2 className="font-bold text-lg text-gray-900 dark:text-white">Drive folders</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchFolders(true)}
                disabled={myDriveLoading}
                className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-white/5 transition-colors disabled:opacity-40"
                title="Refresh"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 ${myDriveLoading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
              </button>
              <Link to="/app/drive" className="text-sm font-medium text-primary hover:text-primary-light transition-colors">
                Open Drive
              </Link>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {driveConnected === false ? (
              <div className="relative w-full overflow-hidden p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#F95F9E]/10 to-transparent border border-[#F95F9E]/20 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-6 shadow-[0_4px_30px_rgba(249,95,158,0.05)]">
                <div className="absolute top-[-20%] right-[-5%] w-[180px] h-[180px] rounded-full bg-[#F95F9E]/10 blur-[40px] pointer-events-none" />
                <div className="flex items-center gap-4">
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-white/10 border border-[#F95F9E]/20 flex items-center justify-center text-[#F95F9E] shadow-lg shadow-[#F95F9E]/5 animate-pulse">
                    <Folder className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Connect Your Google Drive</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-lg leading-relaxed">
                      Link your Google Drive account dynamically to Nexora to browse, search, and instant-ask questions across your personal folders.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleConnectDrive}
                  disabled={connectLoading}
                  className="group flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-primary hover:bg-primary-light text-white transition-all shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/35 hover:-translate-y-0.5 whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {connectLoading ? 'Connecting...' : 'Connect Google Drive'}
                </button>
              </div>
            ) : myDriveLoading && myDriveFolders.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="bg-white/60 dark:bg-background-dark/40 border border-gray-200/60 dark:border-white/10 rounded-xl p-4 animate-pulse">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-white/10" />
                      <div className="flex-1 space-y-2 pt-1">
                        <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-3/4" />
                        <div className="h-2 bg-gray-100 dark:bg-white/5 rounded w-1/2" />
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-white/5 rounded w-full mt-2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {/* Unified Google Drive Session Card */}
                <div className="relative w-full overflow-hidden p-6 rounded-2xl bg-gradient-to-br from-[#F95F9E]/10 to-transparent border border-[#F95F9E]/20 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-6 shadow-[0_4px_30px_rgba(249,95,158,0.05)] col-span-full mb-2">
                  <div className="absolute top-[-20%] right-[-5%] w-[180px] h-[180px] rounded-full bg-[#F95F9E]/10 blur-[40px] pointer-events-none" />
                  <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left w-full sm:w-auto">
                    <div className="shrink-0 w-12 h-12 rounded-xl bg-white/10 border border-[#F95F9E]/20 flex items-center justify-center text-[#F95F9E] shadow-lg shadow-[#F95F9E]/5">
                      <HardDrive className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center justify-center sm:justify-start gap-2 font-sans">
                        Google Drive Status
                        <span className="px-2 py-0.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10 rounded-full border border-emerald-200 dark:border-emerald-800">
                          Connected
                        </span>
                      </h3>
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-2 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1.5 px-3 py-1 bg-white/50 dark:bg-white/5 border border-gray-200/50 dark:border-white/5 rounded-full text-xs font-medium shadow-sm">
                          Folders: <strong className="text-primary">{myDriveFolders.length}</strong>
                        </span>
                        <span className="flex items-center gap-1.5 px-3 py-1 bg-white/50 dark:bg-white/5 border border-gray-200/50 dark:border-white/5 rounded-full text-xs font-medium shadow-sm">
                          Files: <strong className="text-primary">{myDriveFiles.length}</strong>
                        </span>
                        <span className="flex items-center gap-1.5 px-3 py-1 bg-white/50 dark:bg-white/5 border border-gray-200/50 dark:border-white/5 rounded-full text-xs font-medium shadow-sm">
                          Indexed: <strong className="text-primary">{indexedDriveFileIds.size}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                  <Link
                    to="/app/drive"
                    className="group flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-primary hover:bg-primary-light text-white transition-all shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/35 hover:-translate-y-0.5 whitespace-nowrap cursor-pointer"
                  >
                    Browse My Drive
                  </Link>
                </div>

                {myDriveFolders.length === 0 ? (
                  <div className="text-sm text-gray-500 p-4 col-span-full">No folders found in your Google Drive.</div>
                ) : (
                  myDriveFolders.map((folder) => {
                    const colorClass = 'text-[#F95F9E] bg-[#F95F9E]/5 border-[#F95F9E]/10 dark:bg-[#F95F9E]/10 dark:border-[#F95F9E]/20';
                    const fileCount = getFolderFileCount(folder);
                    const updatedAt = folder.updatedTime || folder.modifiedTime || folder.updated_at || folder.modified_at || folder.created_at;
                    return (
                      <div key={folder.id} className="bg-white/60 dark:bg-background-dark/40 border border-gray-200/60 dark:border-white/10 rounded-xl p-4 hover:-translate-y-1 hover:shadow-md hover:border-[#F95F9E]/30 dark:hover:border-[#F95F9E]/30 transition-all group cursor-pointer" onClick={() => navigate('/app/drive')}>
                        <div className="flex items-start gap-3 mb-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${colorClass}`}>
                            <Folder className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-gray-900 dark:text-white group-hover:text-primary transition-colors truncate">{folder.name}</h4>
                            {updatedAt && (
                              <p className="text-xs text-gray-400 mt-0.5">{new Date(updatedAt).toLocaleDateString()}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-t-gray-100 dark:border-t-white/5">
                          <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <FileText className="w-3.5 h-3.5" />
                            {fileCount} {fileCount === 1 ? 'file' : 'files'}
                          </span>
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/5 text-gray-400">
                            Drive
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </section>

      </main>
      <FilePreviewDrawer
        isOpen={!!previewFile}
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        onAskAI={(file) => {
          setPreviewFile(null);
          navigate('/app/chat', { state: { autoAskFile: file } });
        }}
      />
      <DocumentUpload
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploadComplete={() => {
          // Re-fetch documents
          documentAPI.listDocuments().then(docs => {
            const filteredDocs = docs.filter(doc => doc.filename || doc.id);
            setRecentDocs(filteredDocs.slice(0, 3));
          }).catch(console.error);
        }}
      />
    </div>
  );
}
