from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from fastapi.responses import Response
from app.models import DocumentUploadResponse, Document
from app.services.document_processor import DocumentProcessor
from app.services.embeddings import embedding_service
from app.config import settings
from app.auth.deps import get_current_user
from typing import List
import os
import uuid
from datetime import datetime
import json
import re
import time
from app.services.llm_service import llm_service
from app.database import get_firestore
from app.services.cloudinary_service import (
    upload_file as cloudinary_upload, 
    list_files as cloudinary_list_files,
    delete_file as cloudinary_delete_file,
)


router = APIRouter(prefix="/documents", tags=["documents"])

MAX_FILE_SIZE = 75 * 1024 * 1024
ALLOWED_EXTENSIONS = ('.pdf', '.docx', '.txt', '.md', '.csv', '.pptx', '.xlsx')


def _get_file_type(filename: str) -> str:
    return filename.lower().rsplit('.', 1)[-1] if '.' in filename else ''


def _clean_suggested_questions(questions):
    if not questions:
        return []
    if isinstance(questions, list):
        cleaned = []
        for q in questions:
            if isinstance(q, str):
                cleaned.append(q)
            elif isinstance(q, dict):
                cleaned.append(q.get('question') or str(q))
            else:
                cleaned.append(str(q))
        return cleaned[:3]
    return []


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    start_page: int = Form(1),
    end_page: int = Form(500),
    current_user: dict = Depends(get_current_user)
):
    if not file.filename.lower().endswith(ALLOWED_EXTENSIONS):
        raise HTTPException(status_code=400, detail="Unsupported file type.")

    doc_id = str(uuid.uuid4())
    file_path = os.path.join(settings.UPLOAD_DIR, f"{doc_id}_{file.filename}")

    try:
        file_bytes = await file.read()
        file_size = len(file_bytes)

        if file_size > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="File too large.")

        with open(file_path, 'wb') as f:
            f.write(file_bytes)

        file_type = _get_file_type(file.filename)
        chunks = DocumentProcessor.process_document(file_path, file.filename)

        metadata = {
            'id': doc_id,
            'filename': file.filename,
            'file_type': file_type,
            'upload_date': datetime.now().isoformat(),
            'file_size': file_size,
            'user_id': current_user["id"],
            'summary': None,
            'suggested_questions': []
        }

        filtered_chunks = [c for c in chunks if start_page <= c.get("page_number", 1) <= end_page]

        if not filtered_chunks:
            raise HTTPException(status_code=400, detail="No content found in page range.")

        # Summary & Questions (unchanged)
        try:
            preview_text = "\n".join([c["text"] for c in filtered_chunks[:3]])
            summary = "".join([chunk for chunk, _ in llm_service.generate_response_stream(f"Summarize in 3 lines:\n{preview_text}", [])]).strip()
            
            q_prompt = f"Generate 3 short questions. Return ONLY JSON array.\n{preview_text}"
            questions_raw = "".join([chunk for chunk, _ in llm_service.generate_response_stream(q_prompt, [])]).strip()
            
            json_match = re.search(r'\[.*?\]', questions_raw, re.DOTALL)
            questions = json.loads(json_match.group(0)) if json_match else []

            metadata['summary'] = summary
            metadata['suggested_questions'] = questions[:3]
        except Exception as e:
            print("Summary/Questions error:", e)

        # ================== STRICT EMAIL AS FOLDER ==================
        db = get_firestore()
        user_doc = db.collection("users").document(current_user["id"]).get()
        user_data = user_doc.to_dict() or {}

        email = (
            user_data.get("email") or 
            current_user.get("email") or 
            str(current_user["id"])
        )

        print(f"[EMAIL FOLDER DEBUG] Using email folder: {email}")

        # Cloudinary Upload
        cloudinary_url = None
        cloudinary_public_id = None
        try:
            cloud_result = cloudinary_upload(file_bytes, file.filename, email)
            cloudinary_url = cloud_result["url"]
            cloudinary_public_id = cloud_result["public_id"]
        except Exception as e:
            print(f"[CLOUDINARY] Failed: {e}")

        metadata['cloudinary_url'] = cloudinary_url
        metadata['cloudinary_public_id'] = cloudinary_public_id
        metadata['username'] = email   # Store email as reference

        num_chunks = embedding_service.add_documents(filtered_chunks, metadata)

        db.collection("documents").document(doc_id).set({
            "id": doc_id,
            "filename": file.filename,
            "user_id": current_user["id"],
            "cloudinary_url": cloudinary_url,
            "cloudinary_public_id": cloudinary_public_id,
            "username": email,
            "summary": metadata.get('summary'),
            "suggested_questions": metadata.get('suggested_questions', []),
            "uploaded_at": datetime.utcnow()
        })

        if os.path.exists(file_path):
            os.remove(file_path)

        return DocumentUploadResponse(id=doc_id, filename=file.filename, chunks=num_chunks, message="Success")

    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=List[Document])
async def list_documents(current_user: dict = Depends(get_current_user)):
    try:
        # Get current user's email
        db = get_firestore()
        user_doc = db.collection("users").document(current_user["id"]).get()
        user_data = user_doc.to_dict() or {}

        user_email = (
            user_data.get("email") or 
            current_user.get("email") or 
            str(current_user["id"])
        )

        print(f"[LIST DEBUG] Showing only documents from email folder: {user_email}")

        vs_docs = embedding_service.get_all_documents(current_user["id"])
        result = []

        for doc in vs_docs:
            doc_id = doc.get('id')
            meta = next((m for m in getattr(embedding_service, 'metadata_store', []) if m.get('id') == doc_id), {})
            chunk_count = sum(1 for m in getattr(embedding_service, 'metadata_store', []) if m.get('id') == doc_id)

            result.append(Document(
                id=doc_id,
                filename=doc.get('filename'),
                upload_date=doc.get('upload_date', meta.get('upload_date')),
                chunks=chunk_count,
                file_size=meta.get('file_size', 0),
                summary=doc.get('summary'),
                suggested_questions=_clean_suggested_questions(doc.get('suggested_questions') or meta.get('suggested_questions')),
                cloudinary_url=meta.get('cloudinary_url'),
                cloudinary_public_id=meta.get('cloudinary_public_id'),
            ))

        # STRICT: Only list from this user's email folder
        try:
            time.sleep(2)
            cloud_files = cloudinary_list_files(user_email)
            indexed_filenames = {d.filename for d in result}

            for cf in cloud_files:
                full_id = cf.get("public_id", "")
                fname = full_id.split("/")[-1] if "/" in full_id else full_id
                if fname and fname not in indexed_filenames:
                    result.append(Document(
                        id=cf.get("asset_id", full_id),
                        filename=fname,
                        upload_date=cf.get("created_at", datetime.utcnow().isoformat()),
                        chunks=0,
                        file_size=cf.get("bytes", 0),
                        summary="Not yet indexed",
                        suggested_questions=[]
                    ))
        except Exception as e:
            print(f"[CLOUDINARY LIST] Failed: {e}")

        return result

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to load documents")


@router.delete("/{doc_id}")
async def delete_document(doc_id: str, current_user: dict = Depends(get_current_user)):
    try:
        embedding_service.delete_document(doc_id, current_user["id"])

        try:
            db = get_firestore()
            doc = db.collection("documents").document(doc_id).get()
            if doc.exists:
                pid = doc.to_dict().get("cloudinary_public_id")
                if pid:
                    cloudinary_delete_file(pid)
        except:
            pass

        try:
            db.collection("documents").document(doc_id).delete()
        except:
            pass

        for f in os.listdir(settings.UPLOAD_DIR):
            if f.startswith(doc_id):
                os.remove(os.path.join(settings.UPLOAD_DIR, f))

        return {"message": "Deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))