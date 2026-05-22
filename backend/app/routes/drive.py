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
from googleapiclient.discovery import build as gdrive_build

logger = logging.getLogger(__name__)

import asyncio
import threading

class ScanManager:
    def __init__(self):
        self.lock = threading.Lock()
        self._jobs = {}

    def get_job(self, job_id: str) -> dict:
        with self.lock:
            # Try memory cache first
            if job_id in self._jobs:
                return self._jobs[job_id].copy()
        
        # Fallback to Firestore (outside lock to avoid blocking other threads)
        try:
            db = get_firestore()
            doc = db.collection("scan_jobs").document(job_id).get()
            if doc.exists:
                data = doc.to_dict()
                with self.lock:
                    self._jobs[job_id] = data
                return data
        except Exception as e:
            logger.error(f"[ScanManager] Error loading job {job_id} from Firestore: {e}")
        return None

    def create_job(self, job_id: str, initial_state: dict):
        with self.lock:
            self._jobs[job_id] = initial_state.copy()
        
        # Save to Firestore
        try:
            db = get_firestore()
            db.collection("scan_jobs").document(job_id).set(initial_state)
        except Exception as e:
            logger.error(f"[ScanManager] Error creating job {job_id} in Firestore: {e}")

    def update_job(self, job_id: str, updates: dict):
        with self.lock:
            if job_id not in self._jobs:
                # Attempt to load first
                job = self.get_job(job_id)
                if not job:
                    self._jobs[job_id] = {}
            self._jobs[job_id].update(updates)
            current_state = self._jobs[job_id].copy()
        
        # Save to Firestore
        try:
            db = get_firestore()
            db.collection("scan_jobs").document(job_id).set(current_state, merge=True)
        except Exception as e:
            logger.error(f"[ScanManager] Error updating job {job_id} in Firestore: {e}")

    def finalize_job(self, job_id: str, status: str, error_msg: str = None, progress: int = None):
        updates = {"status": status}
        if error_msg is not None:
            updates["current_file"] = error_msg
            updates["error"] = error_msg
        if progress is not None:
            updates["progress"] = progress
            
        self.update_job(job_id, updates)

    def mark_all_active_as_cancelled(self):
        """Marks any active scan jobs in memory or Firestore as cancelled."""
        with self.lock:
            for jid, job in self._jobs.items():
                if job.get("status") in ["queued", "connecting", "fetching", "scanning", "indexing", "running"]:
                    job["status"] = "cancelled"
                    job["current_file"] = "Scan interrupted due to server reload/restart."
                    job["error"] = "Scan interrupted due to server reload/restart."
        
        try:
            db = get_firestore()
            active_jobs = db.collection("scan_jobs").where("status", "in", ["queued", "connecting", "fetching", "scanning", "indexing", "running"]).stream()
            for doc in active_jobs:
                logger.info(f"[ScanManager] Cleanup: Marking active job {doc.id} as cancelled.")
                db.collection("scan_jobs").document(doc.id).update({
                    "status": "cancelled",
                    "current_file": "Scan interrupted due to server reload/restart.",
                    "error": "Scan interrupted due to server reload/restart."
                })
        except Exception as e:
            logger.error(f"[ScanManager] Error cleaning up active jobs: {e}")

scan_manager = ScanManager()

router = APIRouter(prefix="/api/drive", tags=["drive"])


from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from fastapi.responses import RedirectResponse

DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]

def _build_oauth_flow():
    return Flow.from_client_config(
        {
            "web": {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=DRIVE_SCOPES,
        redirect_uri=settings.GOOGLE_REDIRECT_URI,
    )


def _get_user_oauth_credentials(uid: str):
    """Load user OAuth credentials from Firestore. Returns None if not connected."""
    try:
        db = get_firestore()
        doc = db.collection("users").document(uid).get()
        if not doc.exists:
            return None
        data = doc.to_dict().get("google_oauth")
        if not data or not data.get("access_token"):
            return None
        expiry = None
        if data.get("expires_at"):
            try:
                expiry = datetime.utcfromtimestamp(data["expires_at"])
            except Exception:
                pass

        creds = Credentials(
            token=data["access_token"],
            refresh_token=data.get("refresh_token"),
            token_uri=data.get("token_uri", "https://oauth2.googleapis.com/token"),
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            scopes=DRIVE_SCOPES,
            expiry=expiry,
        )
        if creds.expired and creds.refresh_token:
            creds.refresh(GoogleRequest())
            db.collection("users").document(uid).set({
                "google_oauth": {
                    "access_token": creds.token,
                    "refresh_token": creds.refresh_token,
                    "token_uri": creds.token_uri,
                    "expires_at": creds.expiry.timestamp() if creds.expiry else None,
                }
            }, merge=True)
        return creds
    except Exception as e:
        logger.error(f"[OAUTH] Credential load error: {e}")
        return None


@router.get("/oauth/auth-url")
async def get_drive_oauth_url(current_user: dict = Depends(get_current_user)):
    """Returns Google OAuth consent URL for the user to connect their Drive."""
    flow = _build_oauth_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=current_user["id"],
    )
    # Store PKCE verifier to avoid invalid_grant/missing code verifier error
    uid = current_user["id"]
    db = get_firestore()
    db.collection("users").document(uid).set({
        "google_oauth_code_verifier": flow.code_verifier
    }, merge=True)
    return {"auth_url": auth_url}


@router.get("/oauth/callback")
async def drive_oauth_callback(code: str, state: str):
    """Handles Google OAuth callback — saves tokens to Firestore, redirects to frontend."""
    try:
        flow = _build_oauth_flow()
        uid = state
        db = get_firestore()
        user_doc = db.collection("users").document(uid).get()
        code_verifier = None
        if user_doc.exists:
            code_verifier = user_doc.to_dict().get("google_oauth_code_verifier")

        flow.fetch_token(code=code, code_verifier=code_verifier)
        creds = flow.credentials
        db.collection("users").document(uid).set({
            "google_oauth": {
                "access_token": creds.token,
                "refresh_token": creds.refresh_token,
                "token_uri": creds.token_uri,
                "expires_at": creds.expiry.timestamp() if creds.expiry else None,
            },
            "google_oauth_code_verifier": None # Clean up
        }, merge=True)
        logger.info(f"[OAUTH] Drive connected for user: {uid}")
        # Redirect user back to frontend Drive page
        frontend_url = settings.FRONTEND_URL
        if not frontend_url:
            frontend_url = settings.GOOGLE_REDIRECT_URI.split("/api/")[0]
            if "127.0.0.1:8000" in frontend_url:
                frontend_url = frontend_url.replace("127.0.0.1:8000", "localhost:5173")
            elif "localhost:8000" in frontend_url:
                frontend_url = frontend_url.replace("localhost:8000", "localhost:5173")
        return RedirectResponse(url=f"{frontend_url.rstrip('/')}/app/drive?connected=true")
    except Exception as e:
        logger.error(f"[OAUTH] Callback error: {e}")
        raise HTTPException(status_code=400, detail=f"OAuth failed: {str(e)}")


@router.get("/status")
async def get_drive_connection_status(current_user: dict = Depends(get_current_user)):
    """Returns whether the current user has connected their Google Drive."""
    creds = _get_user_oauth_credentials(current_user["id"])
    connected = creds is not None and creds.valid
    logger.info(f"[OAUTH] Drive status for {current_user['id']}: connected={connected}")
    return {"connected": connected}


@router.delete("/disconnect")
async def disconnect_user_drive(current_user: dict = Depends(get_current_user)):
    """Removes the user's Google Drive OAuth tokens from Firestore."""
    db = get_firestore()
    db.collection("users").document(current_user["id"]).set(
        {"google_oauth": None}, merge=True
    )
    logger.info(f"[OAUTH] Drive disconnected for user: {current_user['id']}")
    return {"disconnected": True}


@router.get("/my-drive")
async def list_user_my_drive(
    folder_id: str = "root",
    current_user: dict = Depends(get_current_user),
):
    """
    Lists files and folders from the authenticated user's OWN Google Drive.
    Uses their personal OAuth token — NOT the service account.
    """
    creds = _get_user_oauth_credentials(current_user["id"])
    if not creds or not creds.valid:
        raise HTTPException(
            status_code=403,
            detail="Google Drive not connected. Please connect your Drive first."
        )
    try:
        service = gdrive_build("drive", "v3", credentials=creds, static_discovery=True)
        results = service.files().list(
            q=f"'{folder_id}' in parents and trashed=false",
            fields="files(id, name, mimeType, size, modifiedTime, webViewLink, parents)",
            orderBy="folder,name",
            pageSize=200,
        ).execute()
        items = results.get("files", [])
        folders = [i for i in items if i["mimeType"] == "application/vnd.google-apps.folder"]
        files = [i for i in items if i["mimeType"] != "application/vnd.google-apps.folder"]
        return {
            "connected": True,
            "folder_id": folder_id,
            "folders": folders,
            "files": files,
            "folder_count": len(folders),
            "file_count": len(files),
        }
    except Exception as e:
        logger.error(f"[MY DRIVE] Error listing drive for {current_user['id']}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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


def _get_user_oauth_creds(uid: str):
    """Load user OAuth creds from Firestore. Returns None if not connected."""
    return _get_user_oauth_credentials(uid)


def is_supported_indexable_file(name: str, mime_type: str) -> bool:
    """Returns True if the file type is a supported indexable format (PDF, DOCX, TXT)."""
    name_lower = name.lower()
    if mime_type == "application/pdf" or name_lower.endswith(".pdf"):
        return True
    if mime_type in [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword"
    ] or name_lower.endswith((".docx", ".doc")):
        return True
    if mime_type in ["text/plain", "text/markdown"] or name_lower.endswith((".txt", ".md")):
        return True
    if mime_type == "application/vnd.google-apps.document":
        return True
    return False


def index_single_user_file_helper(service, db, drive_file_id: str, filename: str, mime_type: str, uid: str, email: str) -> dict:
    """
    Downloads, chunks, and indexes a single user-owned Google Drive file securely.
    Ensures absolute privacy and isolated user storage in the vector DB.
    """
    # ── 1. Check if already indexed ───────────────────────────────────────────
    existing = (
        db.collection("drive_indexed_files")
        .where("drive_file_id", "==", drive_file_id)
        .where("user_id", "==", uid)
        .limit(1)
        .stream()
    )
    for doc in existing:
        logger.info(f"[DRIVE INDEX] Helper already indexed: {drive_file_id}")
        data = doc.to_dict()
        return {"success": True, "already_indexed": True, "doc_id": data.get("doc_id"), "chunks": data.get("chunk_count", 0)}

    # ── 2. Download file bytes from Drive ────────────────────────────────────
    fh = io.BytesIO()
    if mime_type in GOOGLE_EXPORT_MAP:
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

    # ── 3. Save to temp disk ─────────────────────────────────────────────────
    doc_id = str(uuid.uuid4())
    file_path = os.path.join(settings.UPLOAD_DIR, f"{doc_id}_{filename}")
    try:
        with open(file_path, "wb") as f:
            f.write(file_bytes)

        # ── 4. Chunk document ────────────────────────────────────────────────
        chunks = DocumentProcessor.process_document(file_path, filename)
        if not chunks:
            raise ValueError("No content could be extracted from this file.")

        page_count = max([c.get("page_number", 1) for c in chunks]) if chunks else 1
        full_text = "\n".join([c["text"] for c in chunks])
        content_preview = full_text[:300]

        # ── 5. Build metadata ────────────────────────────────────────────────
        metadata = {
            "id": doc_id,
            "filename": filename,
            "file_type": _get_file_type(filename),
            "upload_date": datetime.now().isoformat(),
            "file_size": len(file_bytes),
            "user_id": uid,
            "username": email,
            "drive_file_id": drive_file_id,
            "summary": None,
            "suggested_questions": [],
        }

        # ── 6. Generate summary + questions using LLM ─────────────────────────
        summary = ""
        questions = []
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
        except Exception as llm_err:
            logger.warning(f"[DRIVE INDEX] LLM summary creation failed for {filename}: {llm_err}")

        # ── 7. Embed and add to FAISS ────────────────────────────────────────
        num_chunks = embedding_service.add_documents(chunks, metadata)

        # ── 8. Record in Firestore drive_indexed_files ───────────────────────
        db_record = {
            "doc_id": doc_id,
            "drive_file_id": drive_file_id,
            "filename": filename,
            "user_id": uid,
            "username": email,
            "summary": summary,
            "suggested_questions": questions[:3],
            "chunk_count": num_chunks,
            "indexed_at": datetime.utcnow(),
            "content_preview": content_preview,
            "page_count": page_count,
            "language": "English",
            "full_path": f"My Drive/{filename}",
        }
        db.collection("drive_indexed_files").document(doc_id).set(db_record)

        logger.info(f"[DRIVE INDEX] Successfully indexed: {filename} (chunks={num_chunks})")
        return {"success": True, "doc_id": doc_id, "chunks": num_chunks}
    finally:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass


# ── POST /api/drive/my-scan ───────────────────────────────────────────────────
@router.post("/my-scan")
async def start_my_drive_scan(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """
    Starts a deep scan of the user's OWN Google Drive (root + all subfolders).
    Uses their personal OAuth token — NOT the service account.
    """
    creds = _get_user_oauth_creds(current_user["id"])
    if not creds or not creds.valid:
        raise HTTPException(status_code=403, detail="Drive not connected.")

    # Prevent duplicate scans from auto-reconnects/multiple triggers
    db = get_firestore()
    try:
        existing_active = db.collection("scan_jobs")\
            .where("user_id", "==", current_user["id"])\
            .where("status", "in", ["queued", "connecting", "fetching", "scanning", "indexing"])\
            .limit(1)\
            .stream()
        
        for doc in existing_active:
            logger.info(f"[MY SCAN] User {current_user['id']} already has active scan job {doc.id}, returning existing ID.")
            return {"job_id": doc.id}
    except Exception as e:
        logger.warning(f"[MY SCAN] Error checking existing scan jobs: {e}")

    job_id = str(uuid.uuid4())
    initial_job_state = {
        "status": "queued",
        "user_id": current_user["id"],
        "scanned": 0,
        "total": 0,
        "current_file": "Initializing scan traversal...",
        "files": [],
        "failed": [],
        "folder_count": 0,
        "file_count": 0,
        "supported_files_count": 0,
        "indexed_files_count": 0,
        "progress": 0
    }
    
    # Store initial state in our thread-safe manager
    scan_manager.create_job(job_id, initial_job_state)

    background_tasks.add_task(deep_scan_user_drive, job_id, current_user["id"])
    return {"job_id": job_id}


async def deep_scan_user_drive(job_id: str, uid: str):
    """
    Recursively scans ALL folders and files in the user's My Drive.
    Updates counts live, and updates the scan status in both memory and Firestore.
    """
    logger.info(f"[MY SCAN] Starting deep scan background task for user {uid}, job {job_id}")
    try:
        # Step 1: Connecting
        scan_manager.update_job(job_id, {
            "status": "connecting",
            "current_file": "Connecting to Google Drive..."
        })
        
        creds = await asyncio.to_thread(_get_user_oauth_creds, uid)
        if not creds or not creds.valid:
            scan_manager.finalize_job(job_id, "failed", "Google Drive not connected.")
            return

        service = await asyncio.to_thread(gdrive_build, "drive", "v3", credentials=creds, static_discovery=True)

        db = get_firestore()
        user_doc = await asyncio.to_thread(db.collection("users").document(uid).get)
        user_data = user_doc.to_dict() or {}
        email = user_data.get("email") or str(uid)

        # Step 2: Fetching
        scan_manager.update_job(job_id, {
            "status": "fetching",
            "current_file": "Initializing My Drive scan..."
        })
        
        # Step 3: Scanning (traversal)
        scan_manager.update_job(job_id, {
            "status": "scanning",
            "current_file": "Scanning folders and files..."
        })

        folders_to_visit = [("root", "My Drive")]
        visited_folders = set()
        total_folders = 0
        total_files_scanned = 0

        while folders_to_visit:
            # Yield control for cancellation checks
            await asyncio.sleep(0.01)

            # Check prioritized queue from the ScanManager state
            prioritized = []
            with scan_manager.lock:
                job_data = scan_manager._jobs.get(job_id)
                if job_data and job_data.get("prioritized_queue"):
                    prioritized = job_data["prioritized_queue"].copy()
                    job_data["prioritized_queue"] = []  # Clear after reading
            
            # If there are prioritized folders, insert them at the front of BFS queue
            for p_fid, p_path in reversed(prioritized):
                if p_fid not in visited_folders:
                    folders_to_visit.insert(0, (p_fid, p_path))
            
            if not folders_to_visit:
                break

            current_fid, folder_path = folders_to_visit.pop(0)
            if current_fid in visited_folders:
                continue
            visited_folders.add(current_fid)
            total_folders += 1

            page_token = None
            while True:
                await asyncio.sleep(0.01)
                
                # Execute blocking file listing in a thread pool
                results = await asyncio.to_thread(
                    lambda: service.files().list(
                        q=f"'{current_fid}' in parents and trashed=false",
                        fields="nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink)",
                        pageSize=150,
                        pageToken=page_token
                    ).execute()
                )

                items = results.get("files", [])
                new_files_this_page = []
                for item in items:
                    total_files_scanned += 1
                    item_name = item.get("name", "")
                    item_mime = item.get("mimeType", "")

                    if item_mime == "application/vnd.google-apps.folder":
                        folders_to_visit.append((item["id"], f"{folder_path}/{item_name}"))
                    elif item_mime != "application/vnd.google-apps.folder":
                        file_entry = {
                            "id": item["id"],
                            "name": item_name,
                            "folder_name": folder_path.split("/")[-1],
                            "full_path": f"{folder_path}/{item_name}",
                            "drive_web_link": item.get("webViewLink", ""),
                            "size": int(item.get("size", 0)) if item.get("size") else 0,
                            "mimeType": item_mime,
                            "modifiedTime": item.get("modifiedTime", ""),
                        }
                        new_files_this_page.append(file_entry)

                if new_files_this_page:
                    # Append new files to the job's files list immediately
                    with scan_manager.lock:
                        job_data = scan_manager._jobs.get(job_id)
                        if job_data:
                            files_list = job_data.get("files", [])
                            existing_ids = {f["id"] for f in files_list}
                            for nf in new_files_this_page:
                                if nf["id"] not in existing_ids:
                                    files_list.append(nf)
                            scan_manager._jobs[job_id]["files"] = files_list
                    
                    # Persist immediately to trigger UI update
                    job_data = scan_manager.get_job(job_id)
                    if job_data:
                        scan_manager.update_job(job_id, {"files": job_data["files"]})

                # Keep live progress counts updated
                progress_pct = 0
                if total_folders + len(folders_to_visit) > 0:
                    progress_pct = min(99, int((total_folders / (total_folders + len(folders_to_visit))) * 100))

                scan_manager.update_job(job_id, {
                    "folder_count": total_folders,
                    "file_count": total_files_scanned,
                    "scanned": total_files_scanned,
                    "current_file": f"Scanning: Discovered {total_folders} folders, {total_files_scanned} files...",
                    "progress": progress_pct
                })

                page_token = results.get("nextPageToken")
                if not page_token:
                    break

        # Step 4: Completed State
        scan_manager.update_job(job_id, {
            "status": "completed",
            "current_file": "Scanning complete!",
            "progress": 100
        })
        logger.info(f"[MY SCAN] Deep scan completed successfully for user {uid}. Discovered {total_files_scanned} files across {total_folders} folders.")

    except asyncio.CancelledError:
        logger.warning(f"[MY SCAN] Task {job_id} cancelled (server reload/shutdown). Marking state as cancelled.")
        scan_manager.finalize_job(job_id, "cancelled", "Scan interrupted due to server reload/restart.")
    except Exception as e:
        logger.error(f"[MY SCAN] Fatal error in deep scan job {job_id}: {e}", exc_info=True)
        scan_manager.finalize_job(job_id, "failed", f"Fatal scan failure: {str(e)}")


@router.get("/scan/{job_id}")
async def get_scan_status(job_id: str, offset: int = 0, current_user=Depends(get_current_user)):
    """Fetches real-time scanning status from high-speed memory or Firestore with offset support."""
    job_data = scan_manager.get_job(job_id)
    if not job_data:
        return {"status": "not_found", "scanned": 0, "total": 0}
        
    all_files = job_data.get("files", [])
    sliced_files = all_files[offset:]
    
    result = job_data.copy()
    result["files"] = sliced_files
    result["total_discovered_files"] = len(all_files)
    return result


@router.post("/scan/{job_id}/prioritize")
async def prioritize_folder(job_id: str, body: dict, current_user=Depends(get_current_user)):
    folder_id = body.get("folder_id")
    folder_name = body.get("folder_name", "Prioritized Folder")
    if not folder_id:
        raise HTTPException(status_code=400, detail="folder_id is required")
        
    job_data = scan_manager.get_job(job_id)
    if not job_data:
        raise HTTPException(status_code=404, detail="Scan job not found")
        
    with scan_manager.lock:
        if job_id not in scan_manager._jobs:
            scan_manager._jobs[job_id] = {}
        if "prioritized_queue" not in scan_manager._jobs[job_id]:
            scan_manager._jobs[job_id]["prioritized_queue"] = []
            
        p_q = scan_manager._jobs[job_id]["prioritized_queue"]
        if folder_id not in [f[0] for f in p_q]:
            p_q.append((folder_id, folder_name))
            
    logger.info(f"[MY SCAN] Prioritized folder {folder_id} ({folder_name}) for job {job_id}")
    return {"success": True}


# ── POST /api/drive/index ─────────────────────────────────────────────────────
@router.post("/index")
async def index_drive_file(
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """Secure OAuth-based single-file indexing wrapper."""
    drive_file_id = body.get("file_id", "").strip()
    if not drive_file_id:
        raise HTTPException(status_code=400, detail="file_id is required")

    creds = _get_user_oauth_credentials(current_user["id"])
    if not creds or not creds.valid:
        raise HTTPException(status_code=403, detail="Google Drive not connected.")

    try:
        service = gdrive_build("drive", "v3", credentials=creds, static_discovery=True)
        meta = service.files().get(
            fileId=drive_file_id,
            fields="name,mimeType",
            supportsAllDrives=True
        ).execute()

        filename = meta.get("name", "drive_file")
        mime_type = meta.get("mimeType", "")

        if not any(mime_type.startswith(p) for p in ALLOWED_MIME_PREFIXES):
            raise HTTPException(
                status_code=415,
                detail=f"File type '{mime_type}' is not supported for indexing."
            )

        db = get_firestore()
        user_doc = db.collection("users").document(current_user["id"]).get()
        user_data = user_doc.to_dict() or {}
        email = user_data.get("email") or current_user.get("email") or str(current_user["id"])

        res = index_single_user_file_helper(service, db, drive_file_id, filename, mime_type, current_user["id"], email)
        return {
            "success": True,
            "doc_id": res.get("doc_id"),
            "drive_file_id": drive_file_id,
            "filename": filename,
            "chunks": res.get("chunks", 0),
        }
    except Exception as e:
        logger.error(f"[DRIVE INDEX] Route error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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


# ── GET /api/drive/files/{file_id}/preview ─────────────────────────────────────
@router.get("/files/{file_id}/preview")
async def get_file_preview(
    file_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Returns AI-generated index summary, key terms, language, and preview from Firestore."""
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
            "doc_id": data.get("doc_id"),
            "drive_file_id": data.get("drive_file_id"),
            "filename": data.get("filename"),
            "summary": data.get("summary", "This document has been indexed and is fully searchable."),
            "key_topics": data.get("key_topics", []),
            "important_entities": data.get("important_entities", []),
            "content_preview": data.get("content_preview", "") or (data.get("summary", "")[:300] if data.get("summary") else ""),
            "page_count": data.get("page_count", "N/A"),
            "language": data.get("language", "English"),
            "full_path": data.get("full_path") or f"My Drive/{data.get('filename')}",
        }
    raise HTTPException(status_code=404, detail="File preview not found or not indexed yet.")


# ── GET /api/drive/folders ────────────────────────────────────────────────────
@router.get("/folders")
async def get_nexora_folders(
    folder_id: str = NEXORA_FOLDER_ID,
    current_user=Depends(get_current_user),
):
    """Get folder listings — strictly validated to logged-in user credentials."""
    creds = _get_user_oauth_credentials(current_user["id"])
    if not creds or not creds.valid:
        raise HTTPException(status_code=403, detail="Drive not connected.")
    try:
        return list_folder_contents(folder_id)
    except Exception as e:
        logger.error(f"Drive Get Folders Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /api/drive/folders/{folder_id}/contents ───────────────────────────────
@router.get("/folders/{folder_id}/contents")
async def get_folder_contents(folder_id: str, current_user=Depends(get_current_user)):
    """Retrieve subfolders/files lists — strictly authenticated."""
    creds = _get_user_oauth_credentials(current_user["id"])
    if not creds or not creds.valid:
        raise HTTPException(status_code=403, detail="Drive not connected.")
    try:
        return list_folder_contents(folder_id)
    except Exception as e:
        logger.error(f"Folder Contents Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /api/drive/folders ───────────────────────────────────────────────────
@router.post("/folders")
async def create_drive_folder(body: dict, current_user=Depends(get_current_user)):
    creds = _get_user_oauth_credentials(current_user["id"])
    if not creds or not creds.valid:
        raise HTTPException(status_code=403, detail="Drive not connected.")
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
    creds = _get_user_oauth_credentials(current_user["id"])
    if not creds or not creds.valid:
        raise HTTPException(status_code=403, detail="Drive not connected.")
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
    creds = _get_user_oauth_credentials(current_user["id"])
    if not creds or not creds.valid:
        raise HTTPException(status_code=403, detail="Drive not connected.")
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
    """Downloads user-specific Drive documents directly via proxy stream — 100% OAuth."""
    try:
        creds = _get_user_oauth_credentials(current_user["id"])
        if not creds or not creds.valid:
            raise HTTPException(status_code=403, detail="Drive not connected.")
            
        service = gdrive_build("drive", "v3", credentials=creds, static_discovery=True)
        meta = (
            service.files()
            .get(fileId=file_id, fields="name,mimeType")
            .execute()
        )
        filename = meta.get("name", "download")
        mime = meta.get("mimeType", "application/octet-stream")

        request = service.files().get_media(fileId=file_id)
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
    """Searches files in the active user's actual connected Google Drive My Drive."""
    try:
        creds = _get_user_oauth_credentials(current_user["id"])
        if not creds or not creds.valid:
            raise HTTPException(status_code=403, detail="Drive not connected.")
            
        service = gdrive_build("drive", "v3", credentials=creds, static_discovery=True)
        query_parts = ["trashed=false"]

        if q:
            safe_q = q.replace("'", "\\'")
            query_parts.append(f"name contains '{safe_q}'")

        if folder != "all":
            query_parts.append(f"'{folder}' in parents")

        results = (
            service.files()
            .list(
                q=" and ".join(query_parts),
                fields="files(id, name, size, mimeType, modifiedTime, webViewLink)",
                pageSize=150
            )
            .execute()
        )
        return {"files": results.get("files", [])}
    except Exception as e:
        logger.error(f"Search Drive Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))