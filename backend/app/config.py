from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    # ── Gemini API Keys (round-robin rotation, up to 5) ────────────────
    # KEY_1 can also be the old single GEMINI_API_KEY for backward compat.
    GEMINI_API_KEY_1: str = ""
    GEMINI_API_KEY_2: str = ""
    GEMINI_API_KEY_3: str = ""
    GEMINI_API_KEY_4: str = ""
    GEMINI_API_KEY_5: str = ""

    # ── Firebase ────────────────────────────────────────────────────────
    FIREBASE_PROJECT_ID: str = "nexora-25e8a"
    FIREBASE_SERVICE_ACCOUNT_PATH: str = "./firebase-service-account.json"

    # ── Application ─────────────────────────────────────────────────────
    UPLOAD_DIR: str = "uploads"
    VECTORSTORE_DIR: str = "vectorstore"
    MAX_UPLOAD_SIZE: int = 10485760
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200

    # ── Google Drive ────────────────────────────────────────────────────
    GOOGLE_SERVICE_ACCOUNT_PATH: str = "nexora-project-495714-1e5319463436.json"
    GOOGLE_DRIVE_ROOT_FOLDER_ID: str = ""
    NEXORA_DRIVE_FOLDER_ID: str = ""
    UPLOAD_FOLDER_ID: str = ""
    GOOGLE_SERVICE_ACCOUNT_EMAIL: str = ""
    NEXORA_UPLOAD_FOLDER_ID: str = ""
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/drive/oauth/callback"

    # ── Cloudinary ──────────────────────────────────────────────────────
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    class Config:
        env_file = ".env"

settings = Settings()


# Create directories if they don't exist
Path(settings.UPLOAD_DIR).mkdir(exist_ok=True)
Path(settings.VECTORSTORE_DIR).mkdir(exist_ok=True)