from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
import json
import asyncio
import re

from app.models import ChatRequest
from app.utils.json_repair import parse_llm_json
from app.services.embeddings import embedding_service
from app.services.llm_service import llm_service
from app.auth.deps import get_current_user

router = APIRouter(prefix="/chat", tags=["chat"])

FIND_DOC_PATTERNS = [
    r"find\s+(the\s+)?document\s+(with|that\s+has|containing|about|where)",
    r"which\s+(document|file)\s+(has|contains|mentions|talks about)",
    r"search\s+(across\s+)?(all\s+)?(documents?|files?)\s+(for|about|with)",
    r"(locate|look for)\s+.{0,30}\s+in\s+(the\s+)?(documents?|files?)",
]

# Vague queries that need broader retrieval — mapped to better search terms
QUERY_EXPANSION = {
    "summarize the key points": "summary overview introduction abstract purpose objective",
    "summarize key points":     "summary overview introduction abstract purpose objective",
    "key points":               "summary overview introduction abstract purpose objective",
    "what is this document about": "title introduction overview purpose abstract summary",
    "what is the title":        "title project report name heading cover",
    "title of the document":    "title project report name heading cover",
    "title of the project":     "title project report name heading cover",
    "what is the conclusion":   "conclusion result findings outcome recommendation",
    "list the important sections": "chapter section contents table introduction",
    "what are the main topics": "chapter section contents table introduction overview",
}

def expand_query(question: str) -> str:
    """Return an enriched query for vague questions to improve FAISS retrieval."""
    key = question.strip().lower().rstrip("?\"'")
    return QUERY_EXPANSION.get(key, question)

def is_find_document_query(question: str) -> bool:
    return any(re.search(p, question.lower()) for p in FIND_DOC_PATTERNS)


@router.post("/")
async def chat(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user)
):
    async def event_generator():
        try:
            print("Chat request received")
            question = request.question

            # ── FIND-IN-DOCS mode ──────────────────────────────────────
            if is_find_document_query(question):
                try:
                    search_results = embedding_service.search(
                        question, current_user["id"], k=20,
                        doc_ids=request.doc_ids if request.doc_ids else None
                    )
                except Exception as e:
                    print("Embedding search error (find mode):", e)
                    search_results = []

                doc_hits = {}
                for _, metadata, score in search_results:
                    doc_id = metadata.get("id")
                    filename = metadata.get("filename", "Unknown")
                    if doc_id:
                        if doc_id not in doc_hits:
                            doc_hits[doc_id] = {"filename": filename, "best_score": float(score)}
                        elif float(score) > doc_hits[doc_id]["best_score"]:
                            doc_hits[doc_id]["best_score"] = float(score)

                sorted_hits = sorted(doc_hits.items(), key=lambda x: x[1]["best_score"], reverse=True)

                if sorted_hits:
                    lines = [f"Found matching content in **{len(sorted_hits)}** document(s):\n"]
                    for _, info in sorted_hits:
                        pct = round(info["best_score"] * 100)
                        lines.append(f"- **{info['filename']}** — {pct}% match")
                    answer_text = "\n".join(lines)
                else:
                    answer_text = "No matching content found in the selected documents."

                metadata_payload = {
                    "answer_type": "find_document",
                    "source_pages": [],
                    "confidence": sorted_hits[0][1]["best_score"] if sorted_hits else 0.0,
                    "confidence_low": len(sorted_hits) == 0,
                    "suggestions": [],
                    "provider": "search",
                    "doc_id": sorted_hits[0][0] if sorted_hits else None,
                }
                yield f"event: metadata\ndata: {json.dumps(metadata_payload)}\n\n"
                for token in re.split(r'(\s+)', answer_text):
                    if token:
                        yield f"event: token\ndata: {json.dumps({'token': token})}\n\n"
                        await asyncio.sleep(0.02)
                yield f"event: done\ndata: {{}}\n\n"
                return

            # ── NORMAL CHAT mode ───────────────────────────────────────
            # Expand vague queries so FAISS retrieves more relevant chunks
            search_query = expand_query(question)

            try:
                search_results = embedding_service.search(
                    search_query, current_user["id"], k=10,
                    doc_ids=request.doc_ids if request.doc_ids else None
                )
            except Exception as e:
                print("Embedding search error:", e)
                search_results = []

            print(f"DEBUG query='{search_query}' | chunks={len(search_results)} | doc_ids={request.doc_ids}")

            # Collect full LLM response ONCE — prevents duplicate streaming
            full_response = ""
            provider_used = "unknown"
            try:
                for chunk, provider in llm_service.generate_response_stream(
                    question, search_results, request.conversation_history
                ):
                    full_response += chunk
                    provider_used = provider
            except Exception as e:
                print("LLM error:", e)
                full_response = json.dumps({
                    "answer": "Unable to generate a response. Please try again.",
                    "answer_type": "not_found",
                    "source_pages": [],
                    "confidence": 0.0,
                    "confidence_low": True,
                    "suggestions": []
                })
                provider_used = "error"

            # First doc id
            first_doc_id = None
            for _, meta, _ in (search_results or []):
                did = meta.get("id")
                if did:
                    first_doc_id = did
                    break

            # Parse response — goes through parse_llm_json.
            # Returns None when LLM returned plain markdown instead of JSON.
            parsed = parse_llm_json(full_response)
            if parsed is None or not parsed.get("answer"):
                parsed = {
                    "answer": full_response.strip(),
                    "answer_type": "direct",
                    "source_pages": [],
                    "confidence": 0.75,
                    "confidence_low": False,
                    "suggestions": []
                }

            # Strip [Page X] refs and "Sources:" footer from answer text
            answer_text = parsed.get("answer", "")
            answer_text = re.sub(r'\s*\[Page\s*[\d,\s]+\]', '', answer_text)
            answer_text = re.sub(r'\*\*Sources?:.*', '', answer_text, flags=re.IGNORECASE | re.MULTILINE)
            answer_text = answer_text.strip()

            metadata_payload = {
                "answer_type": parsed.get("answer_type", "not_found"),
                "source_pages": [],
                "confidence": parsed.get("confidence", 0.0),
                "confidence_low": parsed.get("confidence_low", True),
                "suggestions": parsed.get("suggestions", []),
                "provider": provider_used,
                "doc_id": first_doc_id,
            }
            yield f"event: metadata\ndata: {json.dumps(metadata_payload)}\n\n"

            for token in re.split(r'(\s+)', answer_text):
                if not token:
                    continue
                yield f"event: token\ndata: {json.dumps({'token': token})}\n\n"
                await asyncio.sleep(0.03)

            yield f"event: done\ndata: {{}}\n\n"
            print(f"Response done — provider: {provider_used}")

        except Exception as e:
            print("Chat error:", e)
            yield f"event: error\ndata: {json.dumps({'content': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )


@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "documents_indexed": (
            embedding_service.index.ntotal if embedding_service.index else 0
        ),
        "llm_status": llm_service.get_status()
    }