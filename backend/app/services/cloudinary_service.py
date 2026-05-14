import cloudinary
import cloudinary.uploader
import cloudinary.search
import cloudinary.utils
import time
from app.config import settings

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET
)


def get_clean_email_folder(email: str) -> str:
    """Strictly use email as folder name"""
    if not email or "@" not in email:
        return "user"
    
    # Take part before @ and clean it
    local_part = email.split("@")[0]
    clean = "".join(c for c in local_part if c.isalnum() or c in "_-")
    return clean.strip() or "user"


def upload_file(file_bytes: bytes, filename: str, email: str) -> dict:
    """Upload using email as folder"""
    folder_name = get_clean_email_folder(email)
    folder = f"nexora/{folder_name}"
    public_id = f"{folder_name}/{filename}"

    try:
        result = cloudinary.uploader.upload(
            file_bytes,
            folder=folder,
            public_id=public_id,
            resource_type="raw",
            use_filename=True,
            unique_filename=False,
            overwrite=True,
        )

        print(f"[CLOUDINARY] Uploaded to folder: nexora/{folder_name}")
        print(f"[CLOUDINARY] Full Path: {result.get('public_id')}")

        return {
            "public_id": result.get("public_id"),
            "url": result.get("secure_url"),
            "cloudinary_url": result.get("secure_url"),
            "cloudinary_public_id": result.get("public_id")
        }
    except Exception as e:
        print(f"[CLOUDINARY UPLOAD ERROR] {e}")
        raise


def list_files(email: str) -> list:
    """STRICTLY list only from this email's folder"""
    folder_name = get_clean_email_folder(email)
    
    try:
        result = cloudinary.search.Search()\
            .expression(f"folder:nexora/{folder_name}/*")\
            .max_results(500)\
            .execute()
        
        resources = result.get("resources", [])
        
        if not resources:
            result = cloudinary.search.Search()\
                .expression(f"public_id:nexora/{folder_name}*")\
                .max_results(500)\
                .execute()
            resources = result.get("resources", [])

        print(f"[CLOUDINARY] Found {len(resources)} files in folder: nexora/{folder_name}")
        return resources
    except Exception as e:
        print(f"[CLOUDINARY LIST ERROR] {e}")
        return []


def delete_file(public_id: str):
    try:
        cloudinary.uploader.destroy(public_id, resource_type="raw")
        print(f"[CLOUDINARY] Deleted: {public_id}")
    except Exception as e:
        print(f"[CLOUDINARY DELETE ERROR] {e}")