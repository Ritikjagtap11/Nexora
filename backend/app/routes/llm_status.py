from fastapi import APIRouter
from app.services.llm_service import llm_service

router = APIRouter(prefix="/api/llm", tags=["llm"])

@router.get("/status")
async def get_status():
    """Get detailed LLM provider status"""
    return llm_service.get_status()
