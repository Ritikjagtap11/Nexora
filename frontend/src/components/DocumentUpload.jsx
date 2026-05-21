import { useState, useRef, useEffect } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, X } from 'lucide-react';
import { useDialog } from '../context/DialogContext';
import { useBackgroundTasks } from '../context/BackgroundTasksContext';

const ACCEPTED_EXTENSIONS = '.pdf,.docx,.txt,.md,.csv,.pptx,.xlsx';

const ACCEPTED_MIMES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const FORMAT_PILLS = [
  { ext: 'PDF',  color: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' },
  { ext: 'DOCX', color: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' },
  { ext: 'TXT',  color: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400' },
  { ext: 'MD',   color: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400' },
  { ext: 'CSV',  color: 'bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400' },
  { ext: 'PPTX', color: 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400' },
  { ext: 'XLSX', color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' },
];

function isValidFile(file) {
  // Check by MIME type first, then fallback to extension
  if (ACCEPTED_MIMES.includes(file.type)) return true;
  const ext = file.name.toLowerCase().split('.').pop();
  return ['pdf', 'docx', 'txt', 'md', 'csv', 'pptx', 'xlsx'].includes(ext);
}

export default function DocumentUpload({ isOpen, onClose, onUploadComplete, folderId }) {
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isDragging, setIsDragging] = useState(false);
  const { alert } = useDialog();
  const { uploadAndIndexDocument } = useBackgroundTasks();
  const dropRef = useRef(null);

  // Clear state when opened
  useEffect(() => {
    if (isOpen) {
      setFiles([]);
      setMessage({ type: '', text: '' });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    processFiles(Array.from(e.target.files));
  };

  const processFiles = (selectedFiles) => {
    const validFiles = selectedFiles.filter(isValidFile);

    if (validFiles.length > 0) {
      setFiles(validFiles);
      if (validFiles.length !== selectedFiles.length) {
        setMessage({ type: 'error', text: 'Some files were skipped. Unsupported file type.' });
      } else {
        setMessage({ type: '', text: '' });
      }
    } else if (selectedFiles.length > 0) {
      setMessage({
        type: 'error',
        text: 'Unsupported file type. Please upload: PDF, DOCX, TXT, MD, CSV, PPTX, or XLSX.'
      });
      setFiles([]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files?.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleUpload = () => {
    if (files.length === 0) return;

    for (const file of files) {
      uploadAndIndexDocument(file, folderId);
    }
    setFiles([]);
    if (onUploadComplete) onUploadComplete();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-cards-dark w-full max-w-md rounded-2xl shadow-xl border border-gray-100 dark:border-white/10 p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
          <X size={20} />
        </button>
        
        <h2 className="flex items-center gap-2 font-semibold text-lg mb-4 text-gray-900 dark:text-white pr-8">
          <Upload size={18} className="text-primary" /> Upload Document
        </h2>
      
      <div
        ref={dropRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-colors ${
          isDragging
            ? 'border-primary bg-primary/10 dark:bg-primary/20'
            : 'border-primary/30 dark:border-white/20 bg-primary/5 hover:bg-primary/10 dark:bg-white/5 dark:hover:bg-white/10'
        }`}
      >
        <label htmlFor="file-input" className="cursor-pointer flex flex-col items-center w-full">
          <FileText size={40} className="text-primary/70 dark:text-gray-400 mb-3" />
          <span className="text-sm font-semibold text-primary dark:text-gray-300 mb-1">
            {files.length > 0 ? `${files.length} file(s) selected` : 'Drag & drop or click to browse'}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-500 mb-3">Max 75 MB per file (up to 500 pages)</span>
          <input
            id="file-input"
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        {/* Format pill badges */}
        <div className="flex flex-wrap justify-center gap-1.5 mt-1">
          {FORMAT_PILLS.map(({ ext, color }) => (
            <span
              key={ext}
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${color}`}
            >
              .{ext}
            </span>
          ))}
        </div>
        
        <button 
          onClick={handleUpload} 
          disabled={files.length === 0}
          className="mt-4 px-6 py-2.5 bg-primary hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white text-sm font-semibold transition-colors w-full shadow-sm"
        >
          Upload
        </button>
      </div>

      {message.text && (
        <div className={`mt-4 p-3 rounded-xl text-sm flex items-start gap-2 border ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400' : 'bg-red-50 border-red-200 text-red-600 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-400'}`}>
          {message.type === 'success' ? <CheckCircle size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}
      </div>
    </div>
  );
}