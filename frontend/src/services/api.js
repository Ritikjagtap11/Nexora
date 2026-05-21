import axios from 'axios';
import { getAuth } from 'firebase/auth';

const API_BASE_URL = 'http://localhost:8000';

const getValidToken = async () => {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken(true);
      localStorage.setItem('nexora_token', token);
      return token;
    }
  } catch (e) {
    console.error('getValidToken error:', e);
  }
  return localStorage.getItem('nexora_token');
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const token = await getValidToken();
  if (token) {
    if (config.headers.set) {
      config.headers.set('Authorization', `Bearer ${token}`);
    } else {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export const documentAPI = {
  uploadDocument: async (file, startPage = 1, endPage = 500, driveFolderId = null) => {
    const formData = new FormData();
    formData.append('file', file);
    if (startPage) formData.append('start_page', startPage);
    if (endPage) formData.append('end_page', endPage);
    if (driveFolderId) formData.append('drive_folder_id', driveFolderId);

    const response = await api.post('/documents/upload', formData, {
      headers: { 'Content-Type': undefined },
    });
    return response.data;
  },

  listDocuments: async () => {
    const response = await api.get('/documents/');
    return response.data;
  },

  deleteDocument: async (docId) => {
    const response = await api.delete(`/documents/${docId}`);
    return response.data;
  },
};

export const chatAPI = {
  getSuggestedQuestions: async (documentIds) => {
    try {
      const token = await getValidToken();
      const response = await fetch(`${API_BASE_URL}/api/chat/suggested-questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ document_ids: documentIds }),
      });

      if (!response.ok) {
        console.warn('getSuggestedQuestions: non-200 response', response.status);
        return { questions: [] };
      }

      return await response.json();
    } catch (err) {
      console.warn('getSuggestedQuestions failed silently:', err);
      return { questions: [] };
    }
  },

  healthCheck: async () => {
    const response = await api.get('/chat/health');
    return response.data;
  },

  sendMessage: async (question, conversationHistory = [], docIds = null, onChunk, onMetadata, onError) => {
    const token = await getValidToken();

    try {
      const response = await fetch(`${API_BASE_URL}/chat/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          question,
          conversation_history: conversationHistory,
          ...(docIds ? { doc_ids: docIds } : {}),
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('No response from server');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let parts = buffer.split('\n\n');
        buffer = parts.pop();

        for (let part of parts) {
          const lines = part.split('\n');
          let currentEvent = null;

          for (const line of lines) {
            if (line.startsWith('event:')) {
              currentEvent = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              try {
                const jsonStr = line.slice(5).trim();
                if (!jsonStr) continue;
                const data = JSON.parse(jsonStr);

                if (currentEvent === 'metadata' && onMetadata) onMetadata(data);
                if (currentEvent === 'token' && onChunk) onChunk(data.token);
                if (currentEvent === 'error' && onError) onError(new Error(data.content || 'An error occurred'));
              } catch (err) {
                console.log('SSE parse error:', err, '| line:', line);
              }
            }
          }
        }
      }
    } catch (err) {
      if (onError) onError(err);
    }
  },
};

export const driveAPI = {
  listFolders: async () => {
    const response = await api.get('/api/drive/folders');
    return response.data;
  },

  createFolder: async (name, parent_id = null) => {
    const response = await api.post('/api/drive/folders', { name, parent_id });
    return response.data;
  },

  deleteFolder: async (folderId) => {
    const response = await api.delete(`/api/drive/items/${folderId}`);
    return response.data;
  },

  deleteDriveItem: async (itemId) => {
    const response = await api.delete(`/api/drive/items/${itemId}`);
    return response.data;
  },

  scanDrive: async () => {
    const response = await api.get('/api/drive/scan');
    return response.data;
  },

  getRecent: async () => {
    const response = await api.get('/api/drive/recent');
    return response.data;
  },

  getRootFolder: async () => {
    const response = await api.get('/api/drive/root-folder');
    return response.data;
  },

  listFolderContents: async (folderId) => {
    const response = await api.get(`/api/drive/folders/${folderId}/contents`);
    return response.data;
  },

  listFiles: async (folderId) => {
    const response = await api.get(`/api/drive/folders/${folderId}/files`);
    return response.data;
  },

  getFilePreview: async (fileId) => {
    const response = await api.get(`/api/drive/files/${fileId}/preview`);
    return response.data;
  },

  deleteFile: async (fileId) => {
    const response = await api.delete(`/api/drive/files/${fileId}`);
    return response.data;
  },

  startScan: async () => {
    const response = await api.post('/api/drive/scan');
    return response.data;
  },

  getScanStatus: async (jobId) => {
    const response = await api.get(`/api/drive/scan/${jobId}`);
    return response.data;
  },

  searchDrive: async (q, folder = 'all') => {
    const response = await api.get('/api/drive/search', { params: { q, folder } });
    return response.data;
  },

  // ── NEW: Download a Drive file and index it into the vector store ──────────
  // Calls POST /api/drive/index  { file_id: string }
  // Backend must: fetch file from Drive → chunk → embed → store with file_id
  indexFile: async (driveFileId) => {
    const response = await api.post('/api/drive/index', { file_id: driveFileId });
    return response.data;
  },

  // ── NEW: Check if a Drive file is already indexed ─────────────────────────
  // Calls GET /api/drive/index-status?file_id=xxx
  // Backend returns { indexed: true/false, chunk_count: number }
  getIndexStatus: async (driveFileId) => {
    const response = await api.get('/api/drive/index-status', {
      params: { file_id: driveFileId },
    });
    return response.data;
  },

  // ── NEW: Get Google Drive connection status for current user ─────────────
  getConnectionStatus: async () => {
    const response = await api.get('/api/drive/status');
    return response.data;
  },

  // ── NEW: List files & folders from the user's personal Google Drive ──────
  listMyDrive: async (folderId = 'root') => {
    const response = await api.get('/api/drive/my-drive', {
      params: { folder_id: folderId },
    });
    return response.data;
  },
};

export default api;