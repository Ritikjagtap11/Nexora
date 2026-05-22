import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { documentAPI, driveAPI } from '../services/api';
import { useAuth } from './AuthContext';

const BackgroundTasksContext = createContext(null);

const showNativeNotification = (title, options = {}) => {
  if (!('Notification' in window)) return;
  
  const defaultOptions = {
    icon: '/assets/google-drive.png',
    ...options
  };

  if (Notification.permission === 'granted') {
    new Notification(title, defaultOptions);
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification(title, defaultOptions);
      }
    });
  }
};

export function useBackgroundTasks() {
  const context = useContext(BackgroundTasksContext);
  if (!context) {
    throw new Error('useBackgroundTasks must be used within a BackgroundTasksProvider');
  }
  return context;
}

export function BackgroundTasksProvider({ children }) {
  // --- States ---
  const [backgroundDocuments, setBackgroundDocuments] = useState(() => {
    try {
      const cached = sessionStorage.getItem('nexora_background_docs');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [indexedDriveFileIds, setIndexedDriveFileIds] = useState(new Set());
  const [isPreloadingIndexedIds, setIsPreloadingIndexedIds] = useState(false);

  // Deep Scan state (persistent across tabs/pages)
  const [deepScanState, setDeepScanState] = useState(() => {
    try {
      const cached = sessionStorage.getItem('nexora_deep_scan_state');
      return cached ? JSON.parse(cached) : {
        scanStatus: 'idle', // idle | running | complete | failed
        scanProgress: { scanned: 0, total: 0, current_file: '' },
        scannedFiles: [],
        scanJobId: null
      };
    } catch {
      return {
        scanStatus: 'idle',
        scanProgress: { scanned: 0, total: 0, current_file: '' },
        scannedFiles: [],
        scanJobId: null
      };
    }
  });

  // Global Toast list for live searchable alerts
  const [toasts, setToasts] = useState([]);

  // Connection status cache
  const [driveConnected, setDriveConnected] = useState(false);

  // Centralized My Drive browser state
  const [myDriveFolders, setMyDriveFolders] = useState([]);
  const [myDriveFiles, setMyDriveFiles] = useState([]);
  const [myDriveLoading, setMyDriveLoading] = useState(false);
  const [myDriveError, setMyDriveError] = useState(null);
  const [currentFolderId, setCurrentFolderId] = useState('root');
  const [folderBreadcrumb, setFolderBreadcrumb] = useState([{ id: 'root', name: 'My Drive' }]);

  const pollRef = useRef(null);
  const abortControllerRef = useRef(null);
  const activePollingJobIdRef = useRef(null);

  // Keep backgroundDocuments in sessionStorage
  useEffect(() => {
    try {
      // Serialize backgroundDocuments without fileObject (which is a File and cannot be serialized)
      const serializableDocs = backgroundDocuments.map(doc => {
        const { fileObject, ...rest } = doc;
        return rest;
      });
      sessionStorage.setItem('nexora_background_docs', JSON.stringify(serializableDocs));
    } catch (e) {
      console.error('Failed to cache background docs', e);
    }
  }, [backgroundDocuments]);

  // Keep deepScanState in sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem('nexora_deep_scan_state', JSON.stringify(deepScanState));
    } catch (e) {
      console.error('Failed to cache deep scan state', e);
    }
  }, [deepScanState]);

  // Request browser Notification permissions on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Preload already indexed documents at startup to populate indexedDriveFileIds Set
  const fetchIndexedDriveFileIds = async () => {
    setIsPreloadingIndexedIds(true);
    try {
      const docs = await documentAPI.listDocuments();
      const ids = new Set(
        docs.map(doc => doc.drive_file_id).filter(Boolean)
      );
      setIndexedDriveFileIds(ids);
    } catch (err) {
      console.error('Failed to load indexed file list', err);
    } finally {
      setIsPreloadingIndexedIds(false);
    }
  };
  const { user } = useAuth();

  const checkDriveConnection = async () => {
    try {
      const res = await driveAPI.getConnectionStatus();
      const connected = !!res.connected;
      setDriveConnected(connected);
      if (connected) {
        loadMyDrive('root', 'My Drive');
      } else {
        setMyDriveFolders([]);
        setMyDriveFiles([]);
      }
    } catch (err) {
      setDriveConnected(false);
      setMyDriveFolders([]);
      setMyDriveFiles([]);
    }
  };

  useEffect(() => {
    fetchIndexedDriveFileIds();
  }, []);

  useEffect(() => {
    if (!user) {
      setDriveConnected(false);
      setMyDriveFolders([]);
      setMyDriveFiles([]);
      setCurrentFolderId('root');
      setFolderBreadcrumb([{ id: 'root', name: 'My Drive' }]);
      setMyDriveLoading(false);
      setMyDriveError(null);
      stopDeepScanPolling();
      setDeepScanState({
        scanStatus: 'idle',
        scanProgress: { scanned: 0, total: 0, current_file: '' },
        scannedFiles: [],
        scanJobId: null
      });
    } else {
      checkDriveConnection();
    }
  }, [user]);

  const prioritizeScanFolder = async (jobId, folderId, folderName) => {
    try {
      await driveAPI.prioritizeFolder(jobId, folderId, folderName);
    } catch (err) {
      console.error('[PRIORITIZE] Failed to prioritize folder:', err);
    }
  };

  const loadMyDrive = async (folderId = 'root', folderName = 'My Drive') => {
    setMyDriveLoading(true);
    setMyDriveError(null);
    try {
      const data = await driveAPI.listMyDrive(folderId);
      setMyDriveFolders(data.folders || []);
      setMyDriveFiles(data.files || []);
      setCurrentFolderId(folderId);
      
      // Prioritize this navigated folder in background deep scan if active
      if (deepScanState.scanStatus === 'running' && deepScanState.scanJobId) {
        prioritizeScanFolder(deepScanState.scanJobId, folderId, folderName);
      }
    } catch (err) {
      console.error('My Drive load error in context:', err);
      const errMsg = err.response?.data?.detail || err.message || 'Failed to load Google Drive files. Please try again.';
      setMyDriveError(errMsg);
    } finally {
      setMyDriveLoading(false);
    }
  };

  const handleFolderClick = (folder) => {
    setFolderBreadcrumb(prev => [...prev, { id: folder.id, name: folder.name }]);
    loadMyDrive(folder.id, folder.name);
  };

  const handleBreadcrumbClick = (crumb, index) => {
    setFolderBreadcrumb(prev => prev.slice(0, index + 1));
    loadMyDrive(crumb.id, crumb.name);
  };

  // --- Helper: Toast Notification Trigger ---
  const addToast = (message, type = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);

    // Native Web Notification
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Nexora Update', {
          body: message,
          icon: '/assets/google-drive.png'
        });
      } catch (e) {}
    }

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // --- Async upload executor ---
  const executeDocumentUpload = async (tempId, file, folderId) => {
    // 1. Simulate short "Pending" phase
    await new Promise(resolve => setTimeout(resolve, 600));

    // 2. Set status to "Scanning"
    setBackgroundDocuments(prev =>
      prev.map(d => (d.id === tempId ? { ...d, status: 'Scanning' } : d))
    );

    try {
      // 3. Trigger backend upload and index
      await documentAPI.uploadDocument(file, null, null, folderId);

      // 4. Update state to "Indexed"
      setBackgroundDocuments(prev =>
        prev.map(d => (d.id === tempId ? { ...d, status: 'Indexed' } : d))
      );
      addToast(`🎉 Document "${file.name}" is now searchable!`);
      fetchIndexedDriveFileIds(); // reload
    } catch (err) {
      console.error(`Background upload failed for ${file.name}:`, err);
      const errMsg = err.response?.data?.detail || err.message || 'Upload and indexing failed';
      setBackgroundDocuments(prev =>
        prev.map(d => (d.id === tempId ? { ...d, status: 'Failed', error: errMsg } : d))
      );
      addToast(`❌ Failed to index "${file.name}".`, 'error');
    }
  };

  // --- Async Drive file index executor ---
  const executeDriveFileIndex = async (driveFileId, filename) => {
    // 1. Set status to "Scanning"
    await new Promise(resolve => setTimeout(resolve, 500));
    setBackgroundDocuments(prev =>
      prev.map(d => (d.id === driveFileId ? { ...d, status: 'Scanning' } : d))
    );

    try {
      // 2. Index file
      await driveAPI.indexFile(driveFileId);

      // 3. Success
      setBackgroundDocuments(prev =>
        prev.map(d => (d.id === driveFileId ? { ...d, status: 'Indexed' } : d))
      );
      setIndexedDriveFileIds(prev => {
        const next = new Set(prev);
        next.add(driveFileId);
        return next;
      });
      addToast(`🎉 Google Drive file "${filename}" is now searchable!`);
    } catch (err) {
      console.error(`Selective indexing failed for drive file ${filename}:`, err);
      const errMsg = err.response?.data?.detail || err.message || 'Indexing failed';
      setBackgroundDocuments(prev =>
        prev.map(d => (d.id === driveFileId ? { ...d, status: 'Failed', error: errMsg } : d))
      );
      addToast(`❌ Indexing failed for "${filename}".`, 'error');
    }
  };

  // --- Public Action: Upload Local Document in Background ---
  const uploadAndIndexDocument = (file, folderId = null) => {
    const tempId = 'local_' + Math.random().toString(36).substr(2, 9);
    const newDoc = {
      id: tempId,
      filename: file.name,
      status: 'Pending',
      file_size: file.size,
      upload_date: new Date().toISOString(),
      fileObject: file, // kept in-memory
      folderId: folderId,
      isDriveFile: false
    };

    setBackgroundDocuments(prev => [newDoc, ...prev]);
    executeDocumentUpload(tempId, file, folderId);
  };

  // --- Public Action: Retry Failed Local Upload ---
  const retryUpload = (tempId) => {
    const doc = backgroundDocuments.find(d => d.id === tempId);
    if (!doc) return;

    setBackgroundDocuments(prev =>
      prev.map(d => (d.id === tempId ? { ...d, status: 'Pending', error: undefined } : d))
    );

    // If fileObject is lost (due to page reload), we prompt or throw
    if (!doc.fileObject) {
      const fallbackMsg = 'Upload file context lost after browser refresh. Please re-upload.';
      setBackgroundDocuments(prev =>
        prev.map(d => (d.id === tempId ? { ...d, status: 'Failed', error: fallbackMsg } : d))
      );
      addToast('Cannot retry upload: File content lost. Please re-upload.', 'error');
      return;
    }

    executeDocumentUpload(tempId, doc.fileObject, doc.folderId);
  };

  // --- Public Action: Index Google Drive File Manually ---
  const indexDriveFile = (driveFileId, filename, fileSize) => {
    // Avoid double trigger
    const existing = backgroundDocuments.find(d => d.id === driveFileId);
    if (existing && (existing.status === 'Pending' || existing.status === 'Scanning' || existing.status === 'Indexed')) {
      return;
    }

    const newDoc = {
      id: driveFileId,
      filename: filename,
      status: 'Pending',
      file_size: fileSize || 0,
      upload_date: new Date().toISOString(),
      isDriveFile: true,
      drive_file_id: driveFileId
    };

    setBackgroundDocuments(prev => [newDoc, ...prev]);
    executeDriveFileIndex(driveFileId, filename);
  };

  // --- Public Action: Retry Failed Drive File Indexing ---
  const retryDriveFileIndex = (driveFileId, filename) => {
    setBackgroundDocuments(prev =>
      prev.map(d => (d.id === driveFileId ? { ...d, status: 'Pending', error: undefined } : d))
    );
    executeDriveFileIndex(driveFileId, filename);
  };

  // --- Public Action: Index Entire Google Drive Folder progressively ---
  const indexDriveFolder = async (folder) => {
    // Avoid duplicate
    const existing = backgroundDocuments.find(d => d.id === folder.id);
    if (existing && (existing.status === 'Pending' || existing.status === 'Scanning')) return;

    const newFolderDoc = {
      id: folder.id,
      filename: folder.name,
      status: 'Pending',
      isFolder: true,
      scanned: 0,
      total: 0,
      current_file: '',
      upload_date: new Date().toISOString()
    };

    setBackgroundDocuments(prev => [newFolderDoc, ...prev]);

    try {
      // 1. Fetch files in folder
      const contents = await driveAPI.listMyDrive(folder.id);
      const files = contents.files || [];

      // Filter for indexable files only (exclude folders, media unless supported)
      const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'txt', 'md', 'csv', 'pptx', 'xlsx'];
      const indexableFiles = files.filter(f => {
        const ext = f.name?.split('.').pop()?.toLowerCase();
        return ALLOWED_EXTENSIONS.includes(ext);
      });

      if (indexableFiles.length === 0) {
        setBackgroundDocuments(prev =>
          prev.map(d => (d.id === folder.id ? { ...d, status: 'Indexed', error: 'No indexable documents inside this folder.' } : d))
        );
        addToast(`ℹ️ Folder "${folder.name}" contains no indexable files.`);
        return;
      }

      // 2. Set to Scanning, update total count
      setBackgroundDocuments(prev =>
        prev.map(d => (d.id === folder.id ? { ...d, status: 'Scanning', total: indexableFiles.length } : d))
      );

      let successCount = 0;
      for (let i = 0; i < indexableFiles.length; i++) {
        const file = indexableFiles[i];

        // Update progress inside the folder task
        setBackgroundDocuments(prev =>
          prev.map(d => (d.id === folder.id ? { ...d, scanned: i + 1, current_file: file.name } : d))
        );

        try {
          await driveAPI.indexFile(file.id);
          successCount++;
          setIndexedDriveFileIds(prev => {
            const next = new Set(prev);
            next.add(file.id);
            return next;
          });
        } catch (e) {
          console.error(`Folder item index failed for ${file.name}:`, e);
        }
      }

      // 3. Finish folder indexing
      setBackgroundDocuments(prev =>
        prev.map(d => (d.id === folder.id ? { ...d, status: 'Indexed', scanned: successCount } : d))
      );
      addToast(`🎉 Indexed ${successCount} files inside "${folder.name}" successfully!`);
    } catch (err) {
      console.error(`Folder indexing failed:`, err);
      setBackgroundDocuments(prev =>
        prev.map(d => (d.id === folder.id ? { ...d, status: 'Failed', error: err.message || 'Folder read failed' } : d))
      );
      addToast(`❌ Indexing folder "${folder.name}" failed.`, 'error');
    }
  };

  // --- Public Action: Persistent Deep Scan control ---
  const stopDeepScanPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    activePollingJobIdRef.current = null;
  };

  const startPersistentDeepScan = async () => {
    if (deepScanState.scanStatus === 'running') return;

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    setDeepScanState(prev => ({
      ...prev,
      scanStatus: 'running',
      scanProgress: { scanned: 0, total: 0, current_file: '' },
      scannedFiles: []
    }));

    try {
      const res = await driveAPI.startMyScan();
      const { job_id } = res;

      setDeepScanState(prev => ({
        ...prev,
        scanJobId: job_id
      }));

      // Setup Polling
      setupDeepScanPolling(job_id);
    } catch (e) {
      setDeepScanState(prev => ({
        ...prev,
        scanStatus: 'failed'
      }));
      addToast('❌ Google Drive deep scan failed to start.', 'error');
    }
  };

  const setupDeepScanPolling = (jobId) => {
    if (!jobId) return;
    if (activePollingJobIdRef.current === jobId) {
      return; // Already polling this jobId, prevent overlapping loops
    }

    stopDeepScanPolling(); // stop any active first
    activePollingJobIdRef.current = jobId;

    // Initialize offset to the length of currently loaded scanned files (e.g. from sessionStorage recovery)
    let offset = 0;
    setDeepScanState(prev => {
      if (prev.scanJobId === jobId) {
        offset = prev.scannedFiles ? prev.scannedFiles.length : 0;
      }
      return prev;
    });

    const runPoll = async () => {
      // Ensure we only proceed if this is still the active job being polled
      if (activePollingJobIdRef.current !== jobId) return;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        const data = await driveAPI.getScanStatus(jobId, {
          params: { offset },
          signal: abortControllerRef.current.signal
        });
        
        // Check once more after the async call completes
        if (activePollingJobIdRef.current !== jobId) return;

        const newFiles = data.files || [];

        // Map backend statuses: queued | connecting | fetching | scanning | indexing | completed | failed | cancelled
        let status = 'running';
        if (data.status === 'completed' || data.status === 'complete') {
          status = 'complete';
        } else if (data.status === 'failed') {
          status = 'failed';
        } else if (data.status === 'cancelled') {
          status = 'cancelled';
        } else if (data.status === 'idle') {
          status = 'idle';
        }

        setDeepScanState(prev => {
          if (prev.scanJobId !== jobId) return prev;
          
          const updatedScannedFiles = [...prev.scannedFiles, ...newFiles];
          offset += newFiles.length;

          // If complete, save to session storage
          if (status === 'complete') {
            try {
              sessionStorage.setItem('nexora_my_scan_files', JSON.stringify(updatedScannedFiles));
              sessionStorage.setItem('nexora_my_scan_status', 'complete');
            } catch (e) {}
          }

          return {
            ...prev,
            scanProgress: {
              scanned: data.scanned || 0,
              total: data.total || 0,
              current_file: data.current_file || '',
              folder_count: data.folder_count || 0,
              file_count: data.file_count || 0,
              supported_files_count: data.supported_files_count || 0,
              indexed_files_count: data.indexed_files_count || 0,
              progress: data.progress || 0
            },
            scannedFiles: updatedScannedFiles,
            scanStatus: status,
            backendStatus: data.status
          };
        });

        if (data.status === 'completed' || data.status === 'complete' || data.status === 'failed' || data.status === 'cancelled') {
          stopDeepScanPolling();

          if (data.status === 'completed' || data.status === 'complete') {
            addToast(`🔍 Deep scan finished! Indexed ${data.indexed_files_count || newFiles.length} files.`, 'success');
            showNativeNotification('Nexora Update', {
              body: `🔍 Deep scan finished! Indexed ${data.indexed_files_count || newFiles.length} files.`
            });
          } else if (data.status === 'cancelled') {
            addToast('⚠️ Deep scan was interrupted/cancelled.', 'error');
            showNativeNotification('Nexora Update', {
              body: '⚠️ Deep scan was interrupted/cancelled.'
            });
          } else {
            addToast('❌ Deep scan failed.', 'error');
            showNativeNotification('Nexora Update', {
              body: '❌ Deep scan failed.'
            });
          }
        }
      } catch (err) {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
          console.error('Polling error:', err);
          stopDeepScanPolling();
          setDeepScanState(prev => ({
            ...prev,
            scanStatus: 'failed'
          }));
          addToast('❌ Deep scan failed.', 'error');
          showNativeNotification('Nexora Update', {
            body: '❌ Deep scan failed.'
          });
        }
      }
    };

    // Execute immediately on the first tick to prevent delay
    runPoll();

    // Set up the interval
    pollRef.current = setInterval(runPoll, 2000);
  };

  // Re-establish deep scan polling if app is refreshed while scanning
  useEffect(() => {
    if (deepScanState.scanStatus === 'running' && deepScanState.scanJobId) {
      setupDeepScanPolling(deepScanState.scanJobId);
    }
    return () => {
      stopDeepScanPolling();
    };
  }, [deepScanState.scanJobId]);

  return (
    <BackgroundTasksContext.Provider value={{
      backgroundDocuments,
      indexedDriveFileIds,
      isPreloadingIndexedIds,
      deepScanState,
      toasts,
      driveConnected,
      setDriveConnected,
      myDriveFolders,
      setMyDriveFolders,
      myDriveFiles,
      setMyDriveFiles,
      myDriveLoading,
      myDriveError,
      currentFolderId,
      setCurrentFolderId,
      folderBreadcrumb,
      setFolderBreadcrumb,
      loadMyDrive,
      handleFolderClick,
      handleBreadcrumbClick,
      checkDriveConnection,
      uploadAndIndexDocument,
      retryUpload,
      indexDriveFile,
      retryDriveFileIndex,
      indexDriveFolder,
      startPersistentDeepScan,
      stopDeepScanPolling,
      prioritizeScanFolder,
      fetchIndexedDriveFileIds
    }}>
      {children}

      {/* Render Toast popups */}
      <div style={{
        position: 'fixed', bottom: '24px', right: '24px', zIndex: 99999,
        display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none'
      }}>
        {toasts.map(toast => (
          <div key={toast.id} style={{
            pointerEvents: 'auto',
            background: toast.type === 'error' ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'linear-gradient(135deg,#7c3aed,#ec4899)',
            color: 'white', fontWeight: 600, fontSize: '13px',
            padding: '12px 20px', borderRadius: '14px',
            boxShadow: '0 8px 30px rgba(124,58,237,0.25)',
            border: '1px solid rgba(255,255,255,0.1)',
            minWidth: '220px', maxWidth: '360px',
            display: 'flex', alignItems: 'center', gap: '8px',
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            animation: 'fadeUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) both'
          }}>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </BackgroundTasksContext.Provider>
  );
}
