from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class DocumentUploadResponse(BaseModel):
    id: str
    filename: str
    chunks: int
    message: str

class ChatRequest(BaseModel):
    question: str
    doc_ids: Optional[List[str]] = []
    conversation_history: Optional[List[dict]] = []

class ChatResponse(BaseModel):
    answer: str
    sources: List[dict]
    provider: str  # Which LLM was used
    
class Document(BaseModel):
    id: str
    filename: str
    upload_date: str
    chunks: int
    file_size: int
    summary: Optional[str] = None
    suggested_questions: Optional[List[str]] = []
    drive_file_id: Optional[str] = None
    cloudinary_url: Optional[str] = None
    cloudinary_public_id: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    id: Optional[str] = None

class UserCreate(BaseModel):
    name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str
