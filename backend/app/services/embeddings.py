import faiss
import numpy as np
import pickle
import os
from typing import List, Tuple
from app.config import settings

class EmbeddingService:
    def __init__(self):
        self._model = None  # Lazy-loaded to prevent slow backend reload times
        self.dimension = 384
        self.index = None
        self.chunks_store = []
        self.metadata_store = []
        self.load_index()

    @property
    def model(self):
        if self._model is None:
            print("[EMBEDDINGS] Lazy-loading SentenceTransformer('all-MiniLM-L6-v2')...")
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer('all-MiniLM-L6-v2')
            print("[EMBEDDINGS] Model loaded successfully.")
        return self._model
    
    def load_index(self):
        """Load existing FAISS index if available"""
        index_path = os.path.join(settings.VECTORSTORE_DIR, "faiss.index")
        store_path = os.path.join(settings.VECTORSTORE_DIR, "chunks.pkl")
        meta_path = os.path.join(settings.VECTORSTORE_DIR, "metadata.pkl")
        
        if os.path.exists(index_path):
            self.index = faiss.read_index(index_path)
            with open(store_path, 'rb') as f:
                self.chunks_store = pickle.load(f)
            with open(meta_path, 'rb') as f:
                self.metadata_store = pickle.load(f)
        else:
            self.index = faiss.IndexFlatL2(self.dimension)
    
    def save_index(self):
        """Save FAISS index to disk"""
        index_path = os.path.join(settings.VECTORSTORE_DIR, "faiss.index")
        store_path = os.path.join(settings.VECTORSTORE_DIR, "chunks.pkl")
        meta_path = os.path.join(settings.VECTORSTORE_DIR, "metadata.pkl")
        
        faiss.write_index(self.index, index_path)
        with open(store_path, 'wb') as f:
            pickle.dump(self.chunks_store, f)
        with open(meta_path, 'wb') as f:
            pickle.dump(self.metadata_store, f)
    
    def add_documents(self, chunks, metadata: dict) -> int:
        """Add document chunks to vector store.
        
        `chunks` can be:
          - List[dict] with keys {text, page_number, chunk_index}  (new format)
          - List[str]  (legacy format — treated as page 1)
        """
        # Normalise to list-of-dicts
        if chunks and isinstance(chunks[0], str):
            chunks = [{"text": c, "page_number": 1, "chunk_index": i} for i, c in enumerate(chunks)]

        texts = [c["text"] for c in chunks]

        EMBEDDING_BATCH_SIZE = 64
        embeddings = self.model.encode(texts, batch_size=EMBEDDING_BATCH_SIZE)
        embeddings = np.array(embeddings).astype('float32')

        self.index.add(embeddings)
        self.chunks_store.extend(texts)

        for chunk in chunks:
            self.metadata_store.append({
                **metadata,
                'chunk_index': chunk.get('chunk_index', 0),
                'page_number': chunk.get('page_number', 1),
                'source_filename': metadata.get('filename', ''),
                'text': chunk["text"],
            })

        self.save_index()
        return len(chunks)
    
    def search(self, query: str, user_id: str, k: int = 5, doc_ids: List[str] = None) -> List[Tuple[str, dict, float]]:
        """Search for similar chunks, optionally filtering by doc_ids"""
        if self.index.ntotal == 0:
            return []
        
        query_embedding = self.model.encode([query])
        query_embedding = np.array(query_embedding).astype('float32')
        if self.index is None or self.index.ntotal == 0:
            return []
            
        distances, indices = self.index.search(query_embedding, min(max(k*10, 50), self.index.ntotal))
        
        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx < len(self.chunks_store):
                meta = self.metadata_store[idx]
                
                # Check user ownership
                if meta.get('user_id') != user_id:
                    continue
                    
                # Filter by doc_ids if provided
                if doc_ids and meta.get('id') not in doc_ids:
                    continue
                    
                results.append((
                    self.chunks_store[idx],
                    meta,
                    float(dist)
                ))
                if len(results) >= k:
                    break
        
        return results
    
    def get_all_documents(self, user_id: str) -> List[dict]:
        """Get all unique documents for a user"""
        seen = set()
        documents = []
        
        for meta in self.metadata_store:
            # Filter by user
            if meta.get('user_id') != user_id:
                continue
                
            doc_id = meta.get('id')
            if doc_id and doc_id not in seen:
                seen.add(doc_id)
                documents.append({
                    'id': meta.get('id'),
                    'filename': meta.get('filename'),
                    'upload_date': meta.get('upload_date'),
                    'summary': meta.get('summary'),
                    'suggested_questions': meta.get('suggested_questions', []),
                })
        
        return documents
    
    def delete_document(self, doc_id: str, user_id: str):
        """Delete document from vector store"""
        # First verify it belongs to user
        doc_exists = any(m.get('id') == doc_id and m.get('user_id') == user_id for m in self.metadata_store)
        if not doc_exists:
            return False

        # Filter out the document's chunks
        new_chunks = []
        new_metadata = []
        
        for chunk, meta in zip(self.chunks_store, self.metadata_store):
            if meta.get('id') != doc_id:
                new_chunks.append(chunk)
                new_metadata.append(meta)
        
        # Rebuild index
        self.chunks_store = new_chunks
        self.metadata_store = new_metadata
        self.index = faiss.IndexFlatL2(self.dimension)
        
        if new_chunks:
            embeddings = self.model.encode(new_chunks)
            embeddings = np.array(embeddings).astype('float32')
            self.index.add(embeddings)
        
        self.save_index()
        return True

embedding_service = EmbeddingService()