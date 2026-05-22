import React, { useState, useEffect, useRef } from 'react';
import { X, File, FileText, Download, MessageSquare, ExternalLink } from 'lucide-react';
import { driveAPI } from '../services/api';

export default function FilePreviewDrawer({ isOpen, onClose, file, onAskAI }) {
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && file) {
      const fetchPreview = async () => {
        setLoading(true);
        try {
          const data = await driveAPI.getFilePreview(file.id);
          setPreviewData(data);
        } catch (error) {
          console.error("Failed to load preview", error);
        } finally {
          setLoading(false);
        }
      };
      fetchPreview();
    }
  }, [isOpen, file]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !file) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/20 z-40" 
        onClick={onClose} 
      />
      <div className="fixed inset-y-0 right-0 w-96 bg-white dark:bg-background-dark shadow-2xl border-l border-gray-200 dark:border-white/10 z-50 transform transition-transform flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/10">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white truncate" title={file.name}>
          {file.name}
        </h2>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors">
          <X size={20} className="text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : previewData ? (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Path</p>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 break-all">{previewData.full_path || `Nexora/${file.folder_name}/${file.name}`}</p>
            </div>

            <div className="flex gap-4 border-y border-gray-100 dark:border-white/5 py-3">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Size</p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {file.size ? (parseInt(file.size) / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Pages</p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{previewData.page_count || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Language</p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{previewData.language || 'N/A'}</p>
              </div>
            </div>

            {previewData.summary && (
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                  <FileText size={16} className="text-primary" /> AI Description
                </h3>
                <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-lg text-sm text-gray-700 dark:text-gray-300 leading-relaxed border border-gray-100 dark:border-white/5">
                  {previewData.summary}
                </div>
              </div>
            )}

            {previewData.key_topics && previewData.key_topics.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-2">Key Topics</h3>
                <div className="flex flex-wrap gap-2">
                  {previewData.key_topics.map((topic, i) => (
                    <span key={i} className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full border border-blue-200 dark:border-blue-800/50">
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {previewData.important_entities && previewData.important_entities.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-2">Important Entities</h3>
                <div className="flex flex-wrap gap-2">
                  {previewData.important_entities.map((entity, i) => (
                    <span key={i} className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-full border border-purple-200 dark:border-purple-800/50">
                      {entity}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {previewData.content_preview && (
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-2">Content Preview</h3>
                <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-lg text-xs text-gray-600 dark:text-gray-400 font-mono whitespace-pre-wrap border border-gray-100 dark:border-white/5">
                  {previewData.content_preview}...
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            <File size={48} className="mx-auto mb-4 opacity-50" />
            <p>This file hasn't been scanned yet.</p>
            <p className="text-sm mt-1">Run a deep scan to generate AI insights.</p>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-white/10 space-y-2 bg-gray-50 dark:bg-background-dark">
        <a 
          href={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/drive/files/${file.id}/download`} 
          className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-white dark:bg-white/10 border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-white/20 transition-colors font-medium text-sm"
        >
          <Download size={16} /> Download
        </a>
        <button 
          onClick={() => onAskAI(file)}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors font-medium text-sm"
        >
          <MessageSquare size={16} /> Ask AI
        </button>
        {file.webViewLink && (
          <a 
            href={file.webViewLink} 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-2 px-4 text-primary hover:text-primary-dark transition-colors font-medium text-sm"
          >
            <ExternalLink size={16} /> Open in Drive
          </a>
        )}
      </div>
      </div>
    </>
  );
}
