from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from firebase_admin import auth as firebase_auth
from app.database import get_firestore
import time

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        try:
            decoded_token = firebase_auth.verify_id_token(token)
        except Exception as skew_err:
            if "too early" in str(skew_err).lower():
                # Small clock skew between machine and Firebase. Wait 2s and retry.
                time.sleep(2)
                decoded_token = firebase_auth.verify_id_token(token)
            else:
                raise skew_err

        uid = decoded_token.get("uid")
        if not uid:
            raise credentials_exception
    except Exception as e:
        print("Token verification error:", e)
        raise credentials_exception

    try:
        db = get_firestore()
        user_ref = db.collection("users").document(uid)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            # Fallback for users not in Firestore yet but valid in Firebase Auth
            user = {"id": uid, "email": decoded_token.get("email")}
        else:
            user = user_doc.to_dict()
            user["id"] = uid
            
        return user
    except Exception as e:
        print("Firestore error:", e)
        # Fallback if firestore client fails due to no credentials
        return {"id": uid, "email": decoded_token.get("email")}
