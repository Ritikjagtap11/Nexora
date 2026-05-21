import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { documentAPI, driveAPI } from '../services/api';

const BackgroundTasksContext = createContext(null);

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

  const pollRef = useRef(null);

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

  useEffect(() => {
    fetchIndexedDriveFileIds();
    // Also fetch connection status
    driveAPI.getConnectionStatus()
      .then(res => setDriveConnected(!!res.connected))
      .catch(() => setDriveConnected(false));
  }, []);

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
  const startPersistentDeepScan = async () => {
    if (deepScanState.scanStatus === 'running') return;

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
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const data = await driveAPI.getScanStatus(jobId);
        const newFiles = data.files || [];

        setDeepScanState(prev => ({
          ...prev,
          scanProgress: {
            scanned: data.scanned || 0,
            total: data.total || 0,
            current_file: data.current_file || ''
          },
          scannedFiles: newFiles,
          scanStatus: data.status // complete | failed | running
        }));

        if (data.status === 'complete' || data.status === 'failed') {
          clearInterval(pollRef.current);
          pollRef.current = null;

          if (data.status === 'complete') {
            try {
              sessionStorage.setItem('nexora_my_scan_files', JSON.stringify(newFiles));
              sessionStorage.setItem('nexora_my_scan_status', 'complete');
            } catch (e) {}
            addToast(`🔍 Deep scan finished! Discovered ${newFiles.length} files.`, 'success');
          } else {
            addToast('❌ Deep scan was interrupted.', 'error');
          }
        }
      } catch (err) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setDeepScanState(prev => ({
          ...prev,
          scanStatus: 'failed'
        }));
      }
    }, 1500);
  };

  // Re-establish deep scan polling if app is refreshed while scanning
  useEffect(() => {
    if (deepScanState.scanStatus === 'running' && deepScanState.scanJobId) {
      setupDeepScanPolling(deepScanState.scanJobId);
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
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
      uploadAndIndexDocument,
      retryUpload,
      indexDriveFile,
      retryDriveFileIndex,
      indexDriveFolder,
      startPersistentDeepScan,
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
