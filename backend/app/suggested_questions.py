"""
app/suggested_questions.py

POST /api/chat/suggested-questions
Body: { "document_ids": ["id1", "id2"] }
Returns: { "questions": ["Q1", "Q2", "Q3", "Q4"] }

Registered in main.py:
    from app.suggested_questions import router as suggested_questions_router
    app.include_router(suggested_questions_router, prefix="/api/chat", tags=["chat"])
"""

import json
import logging
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List

from app.services.embeddings import embedding_service
from app.auth.deps import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

FALLBACK_QUESTIONS = [
    "What is this document about?",
    "Summarize the key points",
    "What are the main topics covered?",
    "List the important sections",
]


class SuggestedQuestionsRequest(BaseModel):
    document_ids: List[str]


@router.post("/suggested-questions")
async def get_suggested_questions(
    body: SuggestedQuestionsRequest,
    current_user: dict = Depends(get_current_user),   # auth required
):
    if not body.document_ids:
        return {"questions": FALLBACK_QUESTIONS}

    try:
        # Pull chunks directly from FAISS using the same embedding_service
        # that the chat endpoint uses — guarantees same doc_id field ('id')
        all_chunks: List[str] = []

        for doc_id in body.document_ids[:2]:
            results = embedding_service.search(
                query="main topic overview summary purpose",
                user_id=current_user["id"],
                k=5,
                doc_ids=[doc_id],
            )
            for text, meta, score in results:
                all_chunks.append(text[:400])

        if not all_chunks:
            logger.warning(
                f"suggested_questions: no chunks found for docs "
                f"{body.document_ids} / user {current_user['id']}"
            )
            return {"questions": FALLBACK_QUESTIONS}

        context = "\n\n".join(all_chunks)[:2000]
        questions = await _generate_questions(context)
        return {"questions": questions}

    except Exception as e:
        logger.error(f"suggested_questions error: {e}")
        return {"questions": FALLBACK_QUESTIONS}


async def _generate_questions(context: str) -> List[str]:
    """Generate 4 short questions. Tries Gemini, then Ollama, then fallback."""

    SYSTEM = (
        "You generate exactly 4 short questions a user would naturally ask about a document. "
        "Questions must be directly answerable from the provided text. "
        "Each question must be under 10 words. "
        "Return ONLY valid JSON — no markdown fences, no explanation. "
        'Format: {"questions": ["Q1?", "Q2?", "Q3?", "Q4?"]}'
    )
    PROMPT = f"Document excerpts:\n{context}\n\nGenerate 4 questions:"

    # Try Gemini first
    try:
        from app.services.llm_service import llm_service
        import google.generativeai as genai

        key = llm_service.rotator.get_available_key()
        if key:
            genai.configure(api_key=key)
            model = genai.GenerativeModel(
                "gemini-2.5-flash",
                system_instruction=SYSTEM,
            )
            response = model.generate_content(PROMPT)
            raw = response.text.strip().replace("```json", "").replace("```", "").strip()
            data = json.loads(raw)
            questions = data.get("questions", [])
            if isinstance(questions, list) and len(questions) >= 1:
                return [str(q) for q in questions[:4]]
    except Exception as e:
        logger.warning(f"Gemini question generation failed: {e}")

    # Ollama fallback
    try:
        import httpx

        payload = {
            "model": "llama3.2:1b",
            "messages": [
                {"role": "system", "content": SYSTEM},
                {"role": "user",   "content": PROMPT},
            ],
            "stream": False,
            "options": {"temperature": 0.2, "num_predict": 256},
        }
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                "http://localhost:11434/api/chat",
                json=payload,
            )
        if resp.status_code == 200:
            raw = resp.json()["message"]["content"].strip()
            raw = raw.replace("```json", "").replace("```", "").strip()
            data = json.loads(raw)
            questions = data.get("questions", [])
            if isinstance(questions, list) and len(questions) >= 1:
                return [str(q) for q in questions[:4]]
    except Exception as e:
        logger.warning(f"Ollama question generation failed: {e}")

    return FALLBACK_QUESTIONS