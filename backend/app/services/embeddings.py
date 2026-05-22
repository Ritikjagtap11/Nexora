import faiss
import numpy as np
import os
from typing import List, Tuple
from app.config import settings

class EmbeddingService:
    def __init__(self):
        self._model = None  # Lazy-loaded to prevent slow backend reload times
        self.dimension = 384
        # In-memory temporary cache: user_id -> list of chunk dicts
        self.chunks_cache = {}

    @property
    def model(self):
        if self._model is None:
            print("[EMBEDDINGS] Lazy-loading SentenceTransformer('all-MiniLM-L6-v2')...")
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer('all-MiniLM-L6-v2')
            print("[EMBEDDINGS] Model loaded successfully.")
        return self._model
    
    def ensure_user_chunks(self, user_id: str) -> List[dict]:
        """Ensure chunks for a user are loaded into the in-memory cache from Firestore"""
        if user_id in self.chunks_cache:
            return self.chunks_cache[user_id]
            
        print(f"[EMBEDDINGS] Cache miss for user {user_id}. Fetching chunks from Firestore...")
        from app.database import get_firestore
        db = get_firestore()
        
        chunks = []
        try:
            chunks_ref = db.collection("users").document(user_id).collection("chunks").stream()
            for doc in chunks_ref:
                chunk_data = doc.to_dict()
                chunks.append(chunk_data)
            print(f"[EMBEDDINGS] Loaded {len(chunks)} chunks from Firestore for user {user_id}.")
        except Exception as e:
            print(f"[EMBEDDINGS] Error loading chunks from Firestore: {e}")
            
        self.chunks_cache[user_id] = chunks
        return chunks

    def add_documents(self, chunks, metadata: dict) -> int:
        """Add document chunks to vector store and Firestore.
        
        `chunks` can be:
          - List[dict] with keys {text, page_number, chunk_index}  (new format)
          - List[str]  (legacy format)
        """
        user_id = metadata.get("user_id")
        if not user_id:
            raise ValueError("user_id is required in metadata to add documents")
            
        # Normalise chunks to list-of-dicts
        if chunks and isinstance(chunks[0], str):
            chunks = [{"text": c, "page_number": 1, "chunk_index": i} for i, c in enumerate(chunks)]

        texts = [c["text"] for c in chunks]

        # Generate embeddings
        EMBEDDING_BATCH_SIZE = 64
        embeddings = self.model.encode(texts, batch_size=EMBEDDING_BATCH_SIZE)
        embeddings = [list(map(float, emb)) for emb in embeddings] # convert numpy floats to python floats

        from app.database import get_firestore
        db = get_firestore()
        
        # Ensure chunks cache for user is initialized
        self.ensure_user_chunks(user_id)
        
        batch = db.batch()
        batch_count = 0
        
        for i, chunk in enumerate(chunks):
            chunk_id = f"{metadata['id']}_{chunk.get('chunk_index', i)}"
            chunk_data = {
                'id': chunk_id,
                'doc_id': metadata['id'],
                'user_id': user_id,
                'text': chunk["text"],
                'page_number': chunk.get('page_number', 1),
                'chunk_index': chunk.get('chunk_index', i),
                'embedding': embeddings[i],
                'filename': metadata.get('filename', ''),
                'upload_date': metadata.get('upload_date', ''),
            }
            
            # Save to Firestore under users/{uid}/chunks/{chunkId}
            chunk_ref = db.collection("users").document(user_id).collection("chunks").document(chunk_id)
            batch.set(chunk_ref, chunk_data)
            batch_count += 1
            
            # Also save to in-memory cache
            self.chunks_cache[user_id].append(chunk_data)
            
            # Firestore batch limit is 500 operations
            if batch_count >= 400:
                batch.commit()
                batch = db.batch()
                batch_count = 0
                
        if batch_count > 0:
            batch.commit()
            
        return len(chunks)
    
    def search(self, query: str, user_id: str, k: int = 5, doc_ids: List[str] = None) -> List[Tuple[str, dict, float]]:
        """Search for similar chunks, optionally filtering by doc_ids"""
        # Ensure user's chunks are in cache
        user_chunks = self.ensure_user_chunks(user_id)
        if not user_chunks:
            return []
            
        # Filter chunks by doc_ids if provided
        valid_chunks = []
        for c in user_chunks:
            if doc_ids and c.get('doc_id') not in doc_ids:
                continue
            valid_chunks.append(c)
            
        if not valid_chunks:
            return []
            
        # Perform in-memory search using temporary FAISS index
        query_embedding = self.model.encode([query])
        query_embedding = np.array(query_embedding).astype('float32') # shape: (1, 384)
        
        # Build temp FAISS index
        index = faiss.IndexFlatL2(self.dimension)
        
        embeddings = np.array([c['embedding'] for c in valid_chunks]).astype('float32')
        index.add(embeddings)
        
        # Search index
        distances, indices = index.search(query_embedding, min(min(k * 10, 50), len(valid_chunks)))
        
        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx >= 0 and idx < len(valid_chunks):
                chunk = valid_chunks[idx]
                
                # Reconstruct metadata dict matching the expected format for chat/llm
                meta = {
                    'id': chunk.get('doc_id'),
                    'user_id': chunk.get('user_id'),
                    'filename': chunk.get('filename'),
                    'page_number': chunk.get('page_number', 1),
                    'chunk_index': chunk.get('chunk_index', 0),
                    'text': chunk.get('text'),
                    'upload_date': chunk.get('upload_date'),
                }
                
                results.append((
                    chunk['text'],
                    meta,
                    float(dist)
                ))
                if len(results) >= k:
                    break
        
        return results
    
    def get_all_documents(self, user_id: str) -> List[dict]:
        """Get all unique documents for a user from Firestore"""
        from app.database import get_firestore
        db = get_firestore()
        
        documents = []
        try:
            docs_ref = db.collection("users").document(user_id).collection("documents").stream()
            for doc in docs_ref:
                data = doc.to_dict()
                documents.append({
                    'id': data.get('id'),
                    'filename': data.get('filename'),
                    'upload_date': data.get('upload_date') or data.get('uploaded_at'),
                    'summary': data.get('summary'),
                    'suggested_questions': data.get('suggested_questions', []),
                    'file_size': data.get('file_size', 0),
                    'cloudinary_url': data.get('cloudinary_url'),
                    'cloudinary_public_id': data.get('cloudinary_public_id'),
                    'drive_file_id': data.get('drive_file_id'),
                    'chunks': data.get('chunks', 0),
                })
        except Exception as e:
            print(f"[EMBEDDINGS] Error listing documents from Firestore: {e}")
            
        return documents
    
    def delete_document(self, doc_id: str, user_id: str) -> bool:
        """Delete document and its chunks from Firestore and cache"""
        from app.database import get_firestore
        db = get_firestore()
        
        # 1. Delete chunks from Firestore users/{uid}/chunks collection
        chunks_ref = db.collection("users").document(user_id).collection("chunks").where("doc_id", "==", doc_id).stream()
        
        batch = db.batch()
        batch_count = 0
        
        for doc in chunks_ref:
            batch.delete(doc.reference)
            batch_count += 1
            if batch_count >= 400:
                batch.commit()
                batch = db.batch()
                batch_count = 0
                
        if batch_count > 0:
            batch.commit()
            
        # 2. Delete from in-memory cache
        if user_id in self.chunks_cache:
            self.chunks_cache[user_id] = [
                c for c in self.chunks_cache[user_id] 
                if c.get("doc_id") != doc_id
            ]
            
        # 3. Delete the document metadata doc from users/{uid}/documents
        doc_ref = db.collection("users").document(user_id).collection("documents").document(doc_id)
        doc_ref.delete()
        
        return True

embedding_service = EmbeddingService()