/**
 * Sidebar.jsx
 * Three tabs:
 *   1. Documents  — uploaded docs (existing ChatDocumentList)
 *   2. Drive      — Google Drive files (new DriveChatDocumentList)
 *   3. History    — Firebase chat history (new ChatHistory)
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DocumentUpload from './DocumentUpload';
import ChatDocumentList from './DocumentList';
import DriveChatDocumentList from './DriveChatDocumentList';
import ChatHistory from './ChatHistory';
import { Sparkles, Cpu, CheckCircle, HardDrive, FileText, History } from 'lucide-react';
import { chatAPI } from '../services/api';
import { useChatContext } from '../context/ChatContext';

const TABS = [
  { id: 'docs', label: 'Docs', Icon: FileText },
  { id: 'drive', label: 'Drive', Icon: HardDrive },
  { id: 'history', label: 'History', Icon: History },
];

export default function Sidebar({ className, onSuggestedQuestion, onLoadHistory, onNewChat }) {
  const navigate = useNavigate();
  const { currentSessionId } = useChatContext();

  const [activeTab, setActiveTab] = useState('docs');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [llmStatus, setLlmStatus] = useState(null);

  const handleUploadSuccess = () => setRefreshTrigger(prev => prev + 1);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const health = await chatAPI.healthCheck();
        setLlmStatus(health.llm_status);
      } catch (error) {
        console.error('Failed to fetch LLM status:', error);
      }
    };
    fetchStatus();
  }, []);

  const getProviderIcon = (provider) => {
    switch (provider) {
      case 'gemini': return <Sparkles size={14} className="text-blue-500 dark:text-blue-400" />;
      case 'ollama': return <Cpu size={14} className="text-emerald-500 dark:text-emerald-400" />;
      default: return <CheckCircle size={14} className="text-gray-500 dark:text-gray-400" />;
    }
  };

  return (
    <div className={`flex flex-col p-4 h-full gap-3 ${className}`}>

      {/* ── AI Engine Status ─────────────────────────────────────────────── */}
      {llmStatus && (
        <div className="p-3.5 bg-white/90 border border-primary/12 rounded-xl shadow-sm dark:bg-white/5 dark:border-white/10">
          <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-gray-800 dark:text-white/90">
            <Cpu className="w-4 h-4 text-primary" />
            AI Engine Status
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1 flex-wrap">
            <span className="font-bold text-gray-800 dark:text-white/90">Gemini</span>
            <span className="mx-1">→</span>
            <span className="font-bold text-gray-800 dark:text-white/90">Ollama</span>
            <span className="text-gray-400">(fallback)</span>
          </div>
          <div className="flex flex-col gap-1 text-xs">
            {['gemini', 'ollama'].map(provider => (
              <div key={provider} className="flex items-center justify-between bg-white dark:bg-background-dark px-2 py-1 rounded border border-gray-200 dark:border-white/5 shadow-sm">
                <div className="flex items-center gap-1">
                  {getProviderIcon(provider)}
                  <span className="text-gray-700 dark:text-gray-300 capitalize">{provider}</span>
                </div>
                {provider === 'gemini' ? (
                  <span className={llmStatus.gemini?.configured_keys > 0 ? 'text-green-500' : 'text-red-500'}>
                    {llmStatus.gemini?.configured_keys > 0 ? `${llmStatus.gemini.configured_keys} key(s)` : 'Off'}
                  </span>
                ) : (
                  <span className={llmStatus.ollama?.available ? 'text-green-500' : 'text-gray-400'}>
                    {llmStatus.ollama?.available ? 'Ready' : 'Unavailable'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Drive Explorer button ────────────────────────────────────────── */}
      <button
        onClick={() => navigate('/app/drive')}
        className="flex items-center justify-center gap-2 py-2.5 w-full rounded-xl text-white text-[13px] font-semibold transition-all"
        style={{
          background: 'linear-gradient(135deg, #F95F9E, #FC9CBF)',
          boxShadow: '0 3px 12px rgba(249,95,158,0.30)',
        }}
      >
        <HardDrive size={16} />
        Drive Explorer
      </button>




      {/* ── Upload (only on Docs tab) ────────────────────────────────────── */}
      {activeTab === 'docs' && (
        <div>
          <DocumentUpload onUploadSuccess={handleUploadSuccess} />
        </div>
      )}

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center bg-gray-100 dark:bg-white/5 rounded-xl p-0.5 gap-0.5">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all
              ${activeTab === id
                ? 'bg-white dark:bg-white/10 text-primary shadow-sm border border-primary/15'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab content ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-0.5">

        {/* Docs tab */}
        {activeTab === 'docs' && (
          <ChatDocumentList
            refreshTrigger={refreshTrigger}
            onSuggestedQuestion={onSuggestedQuestion}
          />
        )}

        {/* Drive tab */}
        {activeTab === 'drive' && (
          <DriveChatDocumentList
            onSuggestedQuestion={onSuggestedQuestion}
          />
        )}

        {/* History tab */}
        {activeTab === 'history' && (
          <ChatHistory
            currentSessionId={currentSessionId}
            onSelectSession={(session) => {
              onLoadHistory?.(session);
            }}
          />
        )}
      </div>
    </div>
  );
}