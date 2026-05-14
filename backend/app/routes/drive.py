from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from app.auth.deps import get_current_user
from app.services.drive_service import (
    scan_nexora_folder,
    list_folder_contents,
    list_nexora_root_folders,
    create_folder,
    delete_drive_item,
    upload_file_to_drive,
    NEXORA_FOLDER_ID,
    UPLOAD_FOLDER_ID,
    drive_service,
    get_drive_service,
)
from app.services.document_processor import DocumentProcessor
from app.services.embeddings import embedding_service
from app.services.llm_service import llm_service
from app.database import get_firestore
from app.config import settings
import logging
import uuid
import os
import io
import re
import json
from datetime import datetime
from googleapiclient.http import MediaIoBaseDownload

logger = logging.getLogger(__name__)

scan_jobs = {}

router = APIRouter(prefix="/api/drive", tags=["drive"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_file_type(filename: str) -> str:
    return filename.lower().rsplit('.', 1)[-1] if '.' in filename else ''


GOOGLE_EXPORT_MAP = {
    # Google Docs → docx
    "application/vnd.google-apps.document": (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".docx",
    ),
    # Google Sheets → xlsx
    "application/vnd.google-apps.spreadsheet": (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".xlsx",
    ),
    # Google Slides → pptx
    "application/vnd.google-apps.presentation": (
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".pptx",
    ),
}

ALLOWED_MIME_PREFIXES = (
    "application/pdf",
    "application/vnd.openxmlformats",
    "application/msword",
    "text/",
    "application/vnd.ms-",
    "application/vnd.google-apps.document",
    "application/vnd.google-apps.spreadsheet",
    "application/vnd.google-apps.presentation",
)


# ── POST /api/drive/scan ──────────────────────────────────────────────────────

@router.post("/scan")
async def start_scan(
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
):
    job_id = str(uuid.uuid4())
    scan_jobs[job_id] = {
        "status": "running",
        "scanned": 0,
        "total": 0,
        "current_file": "",
        "files": [],
        "failed": [],
    }
    background_tasks.add_task(deep_scan_drive, job_id)
    return {"job_id": job_id}


@router.get("/scan/{job_id}")
async def get_scan_status(job_id: str, current_user=Depends(get_current_user)):
    if job_id not in scan_jobs:
        return {"status": "not_found", "scanned": 0, "total": 0}
    return scan_jobs[job_id]


async def deep_scan_drive(job_id: str):
    try:
        db = get_firestore()
        root_id = settings.NEXORA_DRIVE_FOLDER_ID

        def get_files_recursive(folder_id, folder_name, path):
            all_files = []
            try:
                subs = (
                    drive_service.service.files()
                    .list(
                        q=f"'{folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
                        fields="files(id, name)",
                        supportsAllDrives=True,
                    )
                    .execute()
                    .get("files", [])
                )
                for sub in subs:
                    all_files.extend(
                        get_files_recursive(sub["id"], sub["name"], f"{path}/{sub['name']}")
                    )
                files = (
                    drive_service.service.files()
                    .list(
                        q=f"'{folder_id}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'",
                        fields="files(id, name, size, mimeType, modifiedTime, webViewLink)",
                        supportsAllDrives=True,
                    )
                    .execute()
                    .get("files", [])
                )
                for f in files:
                    f["folder_name"] = folder_name
                    f["full_path"] = f"{path}/{f['name']}"
                    all_files.append(f)
            except Exception as e:
                print(f"[SCAN] Folder error: {e}")
            return all_files

        all_files = get_files_recursive(root_id, "NEXORA", "NEXORA")
        scan_jobs[job_id]["total"] = len(all_files)
        print(f"[SCAN] Found {len(all_files)} files")

        for i, file in enumerate(all_files):
            scan_jobs[job_id]["current_file"] = file["name"]
            scan_jobs[job_id]["scanned"] = i + 1

            try:
                db.collection("scanned_files").document(file["id"]).set(
                    {
                        "file_name": file["name"],
                        "folder_name": file.get("folder_name"),
                        "drive_id": file["id"],
                        "drive_web_link": file.get("webViewLink", ""),
                        "full_path": file.get("full_path", ""),
                        "file_size": file.get("size", 0),
                        "mime_type": file.get("mimeType", ""),
                        "scanned_at": datetime.utcnow(),
                    }
                )
            except Exception as e:
                scan_jobs[job_id]["failed"].append(file["name"])

            scan_jobs[job_id]["files"].append(
                {
                    "id": file["id"],
                    "name": file["name"],
                    "folder_name": file.get("folder_name"),
                    "full_path": file.get("full_path"),
                    "drive_web_link": file.get("webViewLink", ""),
                    "size": file.get("size", 0),
                    "mimeType": file.get("mimeType", ""),
                    "modifiedTime": file.get("modifiedTime", ""),
                }
            )

        scan_jobs[job_id]["status"] = "complete"
        print(f"[SCAN] Complete: {len(all_files)} files")

    except Exception as e:
        scan_jobs[job_id]["status"] = "failed"
        print(f"[SCAN] Error: {e}")
        import traceback
        traceback.print_exc()


# ── POST /api/drive/index ─────────────────────────────────────────────────────
# Downloads a Drive file and indexes it into the vector store so the AI
# can answer questions about it — same pipeline as /documents/upload

@router.post("/index")
async def index_drive_file(
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    drive_file_id = body.get("file_id", "").strip()
    if not drive_file_id:
        raise HTTPException(status_code=400, detail="file_id is required")

    # ── 1. Check if already indexed (skip re-work) ────────────────────────
    db = get_firestore()
    existing = (
        db.collection("drive_indexed_files")
        .where("drive_file_id", "==", drive_file_id)
        .where("user_id", "==", current_user["id"])
        .limit(1)
        .stream()
    )
    for _ in existing:
        # Already indexed — return the existing doc_id
        logger.info(f"[DRIVE INDEX] Already indexed: {drive_file_id}")
        return {"success": True, "already_indexed": True, "drive_file_id": drive_file_id}

    # ── 2. Fetch file metadata from Drive ─────────────────────────────────
    try:
        service = get_drive_service()
        meta = (
            service.files()
            .get(
                fileId=drive_file_id,
                fields="name,mimeType,size",
                supportsAllDrives=True,
            )
            .execute()
        )
    except Exception as e:
        logger.error(f"[DRIVE INDEX] Metadata fetch error: {e}")
        raise HTTPException(status_code=404, detail=f"Drive file not found: {e}")

    filename = meta.get("name", "drive_file")
    mime_type = meta.get("mimeType", "")

    # ── 3. Reject unsupported types (images, videos, etc.) ────────────────
    if not any(mime_type.startswith(p) for p in ALLOWED_MIME_PREFIXES):
        raise HTTPException(
            status_code=415,
            detail=f"File type '{mime_type}' is not supported for indexing.",
        )

    # ── 4. Download file bytes from Drive ─────────────────────────────────
    try:
        fh = io.BytesIO()

        if mime_type in GOOGLE_EXPORT_MAP:
            # Google Docs/Sheets/Slides — must export, not download directly
            export_mime, ext = GOOGLE_EXPORT_MAP[mime_type]
            if not filename.endswith(ext):
                filename += ext
            request = service.files().export_media(
                fileId=drive_file_id, mimeType=export_mime
            )
        else:
            request = service.files().get_media(
                fileId=drive_file_id, supportsAllDrives=True
            )

        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()

        file_bytes = fh.getvalue()
    except Exception as e:
        logger.error(f"[DRIVE INDEX] Download error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to download file: {e}")

    # ── 5. Save to temp disk (DocumentProcessor needs a file path) ─────────
    doc_id = str(uuid.uuid4())
    file_path = os.path.join(settings.UPLOAD_DIR, f"{doc_id}_{filename}")

    try:
        with open(file_path, "wb") as f:
            f.write(file_bytes)

        # ── 6. Chunk the document ─────────────────────────────────────────
        chunks = DocumentProcessor.process_document(file_path, filename)
        if not chunks:
            raise HTTPException(
                status_code=422, detail="No content could be extracted from this file."
            )

        # ── 7. Build metadata (same shape as upload route) ────────────────
        user_doc = db.collection("users").document(current_user["id"]).get()
        user_data = user_doc.to_dict() or {}
        email = (
            user_data.get("email")
            or current_user.get("email")
            or str(current_user["id"])
        )

        metadata = {
            "id": doc_id,
            "filename": filename,
            "file_type": _get_file_type(filename),
            "upload_date": datetime.now().isoformat(),
            "file_size": len(file_bytes),
            "user_id": current_user["id"],
            "username": email,
            "drive_file_id": drive_file_id,   # ← tag so we know origin
            "summary": None,
            "suggested_questions": [],
        }

        # ── 8. Generate summary + questions (same as upload route) ────────
        try:
            preview_text = "\n".join([c["text"] for c in chunks[:3]])

            summary = "".join(
                [
                    chunk
                    for chunk, _ in llm_service.generate_response_stream(
                        f"Summarize in 3 lines:\n{preview_text}", []
                    )
                ]
            ).strip()

            q_prompt = f"Generate 3 short questions. Return ONLY JSON array.\n{preview_text}"
            questions_raw = "".join(
                [
                    chunk
                    for chunk, _ in llm_service.generate_response_stream(q_prompt, [])
                ]
            ).strip()

            json_match = re.search(r"\[.*?\]", questions_raw, re.DOTALL)
            questions = json.loads(json_match.group(0)) if json_match else []

            metadata["summary"] = summary
            metadata["suggested_questions"] = questions[:3]
        except Exception as e:
            print(f"[DRIVE INDEX] Summary/Questions error: {e}")

        # ── 9. Embed + store in vector DB ─────────────────────────────────
        num_chunks = embedding_service.add_documents(chunks, metadata)

        # ── 10. Record in Firestore so we don't re-index next time ────────
        db.collection("drive_indexed_files").document(doc_id).set(
            {
                "doc_id": doc_id,
                "drive_file_id": drive_file_id,
                "filename": filename,
                "user_id": current_user["id"],
                "username": email,
                "summary": metadata.get("summary"),
                "suggested_questions": metadata.get("suggested_questions", []),
                "chunk_count": num_chunks,
                "indexed_at": datetime.utcnow(),
            }
        )

        logger.info(f"[DRIVE INDEX] Done: {filename} → {num_chunks} chunks (doc_id={doc_id})")
        return {
            "success": True,
            "doc_id": doc_id,
            "drive_file_id": drive_file_id,
            "filename": filename,
            "chunks": num_chunks,
            "suggested_questions": metadata.get("suggested_questions", []),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[DRIVE INDEX] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Always clean up temp file
        if os.path.exists(file_path):
            os.remove(file_path)


# ── GET /api/drive/index-status ───────────────────────────────────────────────
# Returns whether a Drive file is already indexed and how many chunks it has

@router.get("/index-status")
async def get_index_status(
    file_id: str,
    current_user: dict = Depends(get_current_user),
):
    if not file_id:
        raise HTTPException(status_code=400, detail="file_id query param required")

    db = get_firestore()
    docs = (
        db.collection("drive_indexed_files")
        .where("drive_file_id", "==", file_id)
        .where("user_id", "==", current_user["id"])
        .limit(1)
        .stream()
    )
    for doc in docs:
        data = doc.to_dict()
        return {
            "indexed": True,
            "doc_id": data.get("doc_id"),
            "chunk_count": data.get("chunk_count", 0),
            "filename": data.get("filename"),
            "indexed_at": str(data.get("indexed_at", "")),
        }

    return {"indexed": False, "chunk_count": 0}


# ── GET /api/drive/folders ────────────────────────────────────────────────────

@router.get("/folders")
async def get_nexora_folders(
    folder_id: str = NEXORA_FOLDER_ID,
    current_user=Depends(get_current_user),
):
    try:
        return list_folder_contents(folder_id)
    except Exception as e:
        logger.error(f"Drive Get Folders Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /api/drive/folders/{folder_id}/contents ───────────────────────────────

@router.get("/folders/{folder_id}/contents")
async def get_folder_contents(folder_id: str, current_user=Depends(get_current_user)):
    try:
        return list_folder_contents(folder_id)
    except Exception as e:
        logger.error(f"Folder Contents Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /api/drive/folders ───────────────────────────────────────────────────

@router.post("/folders")
async def create_drive_folder(body: dict, current_user=Depends(get_current_user)):
    folder_name = body.get("name", "").strip()
    parent_id = body.get("parent_id", NEXORA_FOLDER_ID)

    if not folder_name:
        raise HTTPException(status_code=400, detail="Folder name is required")

    try:
        return create_folder(folder_name, parent_id)
    except Exception as e:
        logger.error(f"Create Folder Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── DELETE /api/drive/items/{item_id} ────────────────────────────────────────

@router.delete("/items/{item_id}")
async def delete_item(item_id: str, current_user=Depends(get_current_user)):
    success = delete_drive_item(item_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete item")
    return {"success": True, "deleted_id": item_id}


# ── POST /api/drive/upload ────────────────────────────────────────────────────

@router.post("/upload")
async def upload_to_drive(
    file: UploadFile = File(...),
    folder_id: str = UPLOAD_FOLDER_ID,
    current_user=Depends(get_current_user),
):
    try:
        file_bytes = await file.read()
        return upload_file_to_drive(
            file_bytes=file_bytes,
            filename=file.filename,
            folder_id=folder_id,
        )
    except Exception as e:
        logger.error(f"Upload Route Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /api/drive/recent ─────────────────────────────────────────────────────

@router.get("/recent")
async def get_recent(current_user=Depends(get_current_user)):
    return {"files": []}


# ── GET /api/drive/files/{file_id}/download ───────────────────────────────────

@router.get("/files/{file_id}/download")
async def download_file_proxy(file_id: str, current_user=Depends(get_current_user)):
    try:
        service = get_drive_service()
        meta = (
            service.files()
            .get(fileId=file_id, fields="name,mimeType", supportsAllDrives=True)
            .execute()
        )
        filename = meta.get("name", "download")
        mime = meta.get("mimeType", "application/octet-stream")

        request = service.files().get_media(fileId=file_id, supportsAllDrives=True)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()

        fh.seek(0)
        return StreamingResponse(
            fh,
            media_type=mime,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        logger.error(f"Download Proxy Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /api/drive/search ─────────────────────────────────────────────────────

@router.get("/search")
async def search_drive(
    q: str = "",
    folder: str = "all",
    current_user=Depends(get_current_user),
):
    try:
        service = get_drive_service()
        query_parts = ["trashed=false"]

        if q:
            safe_q = q.replace("'", "\\'")
            query_parts.append(f"name contains '{safe_q}'")

        if folder != "all":
            query_parts.append(f"'{folder}' in parents")
        else:
            query_parts.append(f"'{settings.NEXORA_DRIVE_FOLDER_ID}' in parents")

        results = (
            service.files()
            .list(
                q=" and ".join(query_parts),
                fields="files(id, name, size, mimeType, modifiedTime, webViewLink)",
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
            )
            .execute()
        )
        return {"files": results.get("files", [])}
    except Exception as e:
        logger.error(f"Search Drive Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))