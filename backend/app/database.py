import firebase_admin
from firebase_admin import credentials, firestore
import os
import logging

logger = logging.getLogger(__name__)

def connect_to_firebase():
    if not firebase_admin._apps:
        service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "./firebase-service-account.json")
        if os.path.exists(service_account_path):
            cred = credentials.Certificate(service_account_path)
            firebase_admin.initialize_app(cred)
            logger.info("✅ Firebase Admin initialized with service account")
        else:
            firebase_admin.initialize_app(options={'projectId': os.getenv("FIREBASE_PROJECT_ID", "nexora-25e8a")})
            logger.warning("⚠️ Firebase Admin initialized WITHOUT service account. Firestore will likely fail. Please provide FIREBASE_SERVICE_ACCOUNT_PATH.")

def get_firestore():
    return firestore.client()