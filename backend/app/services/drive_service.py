import os
import logging
from typing import List, Dict, Any
from google.oauth2 import service_account
from googleapiclient.discovery import build
from app.config import settings

logger = logging.getLogger(__name__)

# ════════════════════════════════════════════════
# CONFIGURATION — SIMPLE SERVICE ACCOUNT APPROACH
# ════════════════════════════════════════════════

NEXORA_FOLDER_ID = settings.NEXORA_DRIVE_FOLDER_ID or "16kJpKKiHw32PWNi75C6Qoh0QclakBACi"
UPLOAD_FOLDER_ID = settings.UPLOAD_FOLDER_ID or "1gx4fOiYkAcC800MmjwJTlyK-F1kK1jck"

# ──────────────────────────────────────────────
# FUNCTION 1 — Get Drive service (service account)
# ──────────────────────────────────────────────
def get_drive_service():
    """
    Builds Drive API client using either per-user OAuth credentials from Firestore
    or falls back to service account credentials.
    """
    from app.auth.deps import current_user_id_ctx
    from app.database import get_firestore
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request as GoogleRequest

    uid = current_user_id_ctx.get()
    if uid:
        try:
            db = get_firestore()
            doc = db.collection("users").document(uid).get()
            if doc.exists:
                data = doc.to_dict().get("google_oauth")
                if data:
                    creds = Credentials(
                        token=data["access_token"],
                        refresh_token=data.get("refresh_token"),
                        token_uri=data.get("token_uri", "https://oauth2.googleapis.com/token"),
                        client_id=settings.GOOGLE_CLIENT_ID,
                        client_secret=settings.GOOGLE_CLIENT_SECRET,
                        scopes=["https://www.googleapis.com/auth/drive.readonly"] if "readonly" in data.get("token_uri", "") or not data.get("refresh_token") else ["https://www.googleapis.com/auth/drive"],
                    )
                    if creds.expired and creds.refresh_token:
                        try:
                            creds.refresh(GoogleRequest())
                            db.collection("users").document(uid).set({
                                "google_oauth": {
                                    "access_token": creds.token,
                                    "refresh_token": creds.refresh_token,
                                    "token_uri": creds.token_uri,
                                    "expires_at": creds.expiry.timestamp() if creds.expiry else None,
                                }
                            }, merge=True)
                        except Exception as refresh_err:
                            logger.error(f"Failed to refresh Google OAuth token: {refresh_err}")
                    
                    logger.info(f"🔑 Drive user OAuth active for user: {uid}")
                    return build('drive', 'v3', credentials=creds, static_discovery=True)
        except Exception as oauth_err:
            logger.error(f"Error loading user Google Drive OAuth credentials: {oauth_err}. Falling back to service account.")

    # Fallback to service account
    sa_path = settings.GOOGLE_SERVICE_ACCOUNT_PATH
    if not os.path.exists(sa_path):
        cwd_path = os.path.join(os.getcwd(), sa_path)
        if os.path.exists(cwd_path):
            sa_path = cwd_path
            
    credentials = service_account.Credentials.from_service_account_file(
        sa_path,
        scopes=['https://www.googleapis.com/auth/drive']
    )
    
    # Log service account email on startup / call
    logger.info(f"🔑 Drive service account: {credentials.service_account_email}")
    
    return build('drive', 'v3', credentials=credentials, static_discovery=True)

# ──────────────────────────────────────────────
# FUNCTION 2 — Deep scan NEXORA folder (FIXED)
# ──────────────────────────────────────────────
def scan_nexora_folder(
    folder_id: str = NEXORA_FOLDER_ID,
    folder_path: str = "Nexora"
) -> list:
    service = get_drive_service()
    all_files = []
    
    try:
        results = service.files().list(
            q=f"'{folder_id}' in parents and trashed=false",
            fields="files(id, name, size, mimeType, modifiedTime, webViewLink)",
            pageSize=1000
        ).execute()
        
        items = results.get('files', [])
        logger.info(f"📂 Scanning '{folder_path}': found {len(items)} items")
        
        for item in items:
            if item['mimeType'] == 'application/vnd.google-apps.folder':
                sub_path = f"{folder_path} / {item['name']}"
                logger.info(f"  📁 Entering subfolder: {item['name']}")
                # Recurse
                sub_files = scan_nexora_folder(item['id'], sub_path)
                all_files.extend(sub_files)
            else:
                logger.info(f"  📄 Found file: {item['name']} in {folder_path}")
                all_files.append({
                    'id': item['id'],
                    'name': item['name'],
                    'size': item.get('size', '0'),
                    'mimeType': item.get('mimeType', ''),
                    'modifiedTime': item.get('modifiedTime', ''),
                    'webViewLink': item.get('webViewLink', '#'),
                    'folderPath': folder_path
                })
    
    except Exception as e:
        logger.error(f"❌ Scan error at '{folder_path}': {e}")
    
    return all_files

# ──────────────────────────────────────────────
# NEW FUNCTION — List Nexora Root Folders (FIXED)
# ──────────────────────────────────────────────
def list_nexora_root_folders() -> list:
    """
    Queries ONLY the actual subfolders present inside NEXORA folder on Google Drive.
    """
    service = get_drive_service()
    results = service.files().list(
        q=(
            f"'{NEXORA_FOLDER_ID}' in parents "
            f"and mimeType='application/vnd.google-apps.folder' "
            f"and trashed=false"
        ),
        fields="files(id, name, modifiedTime)",
        orderBy="name",
        pageSize=100
    ).execute()
    return results.get('files', [])

# ──────────────────────────────────────────────
# FUNCTION 3 — List direct children of a folder
# ──────────────────────────────────────────────
def list_folder_contents(folder_id: str) -> dict:
    """
    Returns direct folders and files inside any arbitrary folder.
    """
    service = get_drive_service()
    
    results = service.files().list(
        q=f"'{folder_id}' in parents and trashed=false",
        fields="files(id, name, size, mimeType, modifiedTime, webViewLink)",
        orderBy="folder,name",
        pageSize=500
    ).execute()
    
    items = results.get('files', [])
    folders = [i for i in items if i['mimeType'] == 'application/vnd.google-apps.folder']
    files = [i for i in items if i['mimeType'] != 'application/vnd.google-apps.folder']
    
    return {
        "folders": folders,
        "files": files,
        "folder_count": len(folders),
        "file_count": len(files)
    }

# ──────────────────────────────────────────────
# FUNCTION 4 — Create folder inside parent
# ──────────────────────────────────────────────
def create_folder(
    folder_name: str,
    parent_id: str = NEXORA_FOLDER_ID
) -> dict:
    service = get_drive_service()
    
    folder = service.files().create(
        body={
            'name': folder_name,
            'mimeType': 'application/vnd.google-apps.folder',
            'parents': [parent_id]
        },
        fields='id, name, webViewLink'
    ).execute()
    
    logger.info(f"✅ Created folder: {folder_name}")
    return folder

# ──────────────────────────────────────────────
# FUNCTION 5 — Delete item from Drive (trash it)
# ──────────────────────────────────────────────
def delete_drive_item(item_id: str) -> bool:
    service = get_drive_service()
    try:
        service.files().update(
            fileId=item_id,
            body={'trashed': True}
        ).execute()
        logger.info(f"✅ Deleted item: {item_id}")
        return True
    except Exception as e:
        logger.error(f"❌ Delete failed: {e}")
        return False

# ──────────────────────────────────────────────
# FUNCTION 6 — Upload file to Drive folder
# ──────────────────────────────────────────────
def upload_file_to_drive(
    file_bytes: bytes,
    filename: str,
    folder_id: str = UPLOAD_FOLDER_ID
) -> dict:
    import io, mimetypes
    from googleapiclient.http import MediaIoBaseUpload
    
    service = get_drive_service()
    mime_type = (
        mimetypes.guess_type(filename)[0]
        or 'application/octet-stream'
    )
    
    file_metadata = {
        'name': filename,
        'parents': [folder_id]
    }
    media = MediaIoBaseUpload(
        io.BytesIO(file_bytes),
        mimetype=mime_type,
        resumable=True
    )
    uploaded = service.files().create(
        body=file_metadata,
        media_body=media,
        fields='id, name, webViewLink'
    ).execute()
    
    logger.info(f"✅ Uploaded: {filename}")
    return {
        'drive_file_id': uploaded.get('id'),
        'drive_link': uploaded.get('webViewLink'),
        'filename': filename
    }

# ──────────────────────────────────────────────
# COMPATIBILITY LAYER FOR BACKEND MODULES
# ──────────────────────────────────────────────
def download_drive_file(file_id: str, dest_path: str):
    from googleapiclient.http import MediaIoBaseDownload
    service = get_drive_service()
    request = service.files().get_media(fileId=file_id)
    with open(dest_path, 'wb') as fh:
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            status, done = downloader.next_chunk()

class LegacyDriveService:
    @property
    def service(self):
        try: return get_drive_service()
        except: return None
    def init_drive(self): 
        self.service
    def list_folders(self, parent_id=NEXORA_FOLDER_ID):
        if parent_id == NEXORA_FOLDER_ID:
            return list_nexora_root_folders()
        return list_folder_contents(parent_id).get('folders', [])
    def list_files(self, folder_id):
        return list_folder_contents(folder_id).get('files', [])
    def upload_file(self, file_bytes, filename, mimetype, folder_id):
        actual_folder = folder_id if folder_id else UPLOAD_FOLDER_ID
        res = upload_file_to_drive(file_bytes, filename, actual_folder)
        return {'id': res['drive_file_id'], 'webViewLink': res['drive_link']}
    def download_file(self, file_id, dest_path):
        download_drive_file(file_id, dest_path)
    def get_or_create_upload_folder(self, user_id=None, root_id=None):
        return UPLOAD_FOLDER_ID

drive_service = LegacyDriveService()
