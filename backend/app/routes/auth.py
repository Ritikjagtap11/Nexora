from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from firebase_admin import auth as firebase_auth
from app.database import get_firestore
from datetime import datetime
import time

router = APIRouter(prefix="/auth", tags=["Authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

async def setup_user_drive_folder(uid, display_name):
    from app.database import get_firestore
    from app.services.drive_service import drive_service
    from app.config import settings
    firestore_db = get_firestore()
    
    # Check Firestore if user folder already exists
    user_doc = firestore_db.collection("users").document(uid).get()
    if user_doc.exists and user_doc.to_dict().get("root_folder_id"):
        return  # already setup, skip
    
    root_id = settings.GOOGLE_DRIVE_ROOT_FOLDER_ID
    if not root_id:
        root_id = settings.NEXORA_DRIVE_FOLDER_ID
    
    # Create username folder inside Nexora
    user_folder = drive_service.create_folder(display_name, root_id)
    user_folder_id = user_folder["id"]
    
    # Create Upload folder inside username folder
    upload_folder = drive_service.create_folder("Upload", user_folder_id)
    upload_folder_id = upload_folder["id"]
    
    # Create all 10 subfolders inside username folder
    subfolders = [
        "Research", "Reports", "Presentations", "Spreadsheets",
        "Notes", "Contracts", "Manuals", "Invoices", 
        "Reference", "Archive"
    ]
    folder_ids = {}
    for name in subfolders:
        f = drive_service.create_folder(name, user_folder_id)
        folder_ids[name.lower()] = f["id"]
    
    # Store everything in Firestore users/{uid}
    firestore_db.collection("users").document(uid).set({
        "display_name": display_name,
        "root_folder_id": user_folder_id,
        "upload_folder_id": upload_folder_id,
        "drive_folders": folder_ids
    }, merge=True)

@router.post("/session")
async def create_session(token: str = Depends(oauth2_scheme)):
    try:
        try:
            decoded_token = firebase_auth.verify_id_token(token)
        except Exception as skew_err:
            if "too early" in str(skew_err).lower():
                time.sleep(2)
                decoded_token = firebase_auth.verify_id_token(token)
            else:
                raise skew_err
        uid = decoded_token.get("uid")
        email = decoded_token.get("email")
        name = decoded_token.get("name", "Unknown")
        
        if not uid:
            raise HTTPException(status_code=401, detail="Invalid token")
            
        try:
            db = get_firestore()
            user_ref = db.collection("users").document(uid)
            user_doc = user_ref.get()
            
            if not user_doc.exists:
                user_ref.set({
                    "email": email,
                    "name": name,
                    "created_at": datetime.utcnow()
                })
            else:
                user_ref.update({
                    "last_login": datetime.utcnow()
                })
                
            await setup_user_drive_folder(uid, name)
            
        except Exception as db_err:
            print("Firestore session update error:", db_err)
            import traceback
            traceback.print_exc()
            
        return {"uid": uid, "email": email, "name": name}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
