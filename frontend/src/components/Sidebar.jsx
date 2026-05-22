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
import DriveChatDocumentList from './Drivechatdocumentlist';
import ChatHistory from './Chathistory';
import { Sparkles, CheckCircle, HardDrive, FileText, History } from 'lucide-react';
import { chatAPI } from '../services/api';
import { useChatContext } from '../context/ChatContext';

const TABS = [
  { id: 'docs',    label: 'Docs',    Icon: FileText  },
  { id: 'drive',   label: 'Drive',   Icon: HardDrive },
  { id: 'history', label: 'History', Icon: History   },
];

export default function Sidebar({ className, onSuggestedQuestion, onLoadHistory, onNewChat }) {
  const navigate = useNavigate();
  const { currentSessionId } = useChatContext();

  const [activeTab, setActiveTab]     = useState('docs');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const handleUploadSuccess = () => setRefreshTrigger(prev => prev + 1);

  return (
    <div className={`flex flex-col p-4 h-full gap-3 ${className}`}>

      {/* Upload (only on Docs tab) */}
      {activeTab === 'docs' && (
        <div>
          <DocumentUpload onUploadSuccess={handleUploadSuccess} />
        </div>
      )}

      {/* Tab bar */}
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

      {/* Tab content */}
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
