import time
import json
import logging
import google.generativeai as genai

from app.config import settings
from typing import List, Dict, Optional, Generator, Tuple

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class GeminiKeyRotator:
    COOLDOWN_SECONDS = 60

    def __init__(self, keys: List[str]):
        self._keys = [k for k in keys if k]
        self._current_idx = 0
        self._state: List[Dict] = [
            {"requests": 0, "errors": 0, "cooldown_until": 0.0, "status": "ACTIVE"}
            for _ in self._keys
        ]

    @property
    def total_keys(self) -> int:
        return len(self._keys)

    def get_available_key(self) -> Optional[str]:
        if not self._keys:
            return None
        now = time.time()
        for _ in range(len(self._keys)):
            idx = self._current_idx % len(self._keys)
            state = self._state[idx]
            if state.get("status") == "DEAD_LEAKED":
                self._current_idx += 1
                continue
            if state["cooldown_until"] <= now:
                return self._keys[idx]
            self._current_idx += 1
        logger.warning("All Gemini keys cooling — no fallback available.")
        return None

    def mark_used(self):
        if not self._keys:
            return
        self._state[self._current_idx % len(self._keys)]["requests"] += 1
        self._current_idx += 1

    def mark_quota_error(self):
        if not self._keys:
            return
        idx = self._current_idx % len(self._keys)
        self._state[idx]["errors"] += 1
        self._state[idx]["cooldown_until"] = time.time() + self.COOLDOWN_SECONDS
        logger.warning(f"Gemini key #{idx+1} quota hit — cooling {self.COOLDOWN_SECONDS}s.")
        self._current_idx += 1

    def mark_leaked_error(self):
        if not self._keys:
            return
        idx = self._current_idx % len(self._keys)
        self._state[idx]["status"] = "DEAD_LEAKED"
        logger.error(f"Gemini key #{idx+1} leaked — disabled.")
        self._current_idx += 1

    def get_status(self) -> List[Dict]:
        now = time.time()
        return [
            {
                "key_label": f"key_{i+1}",
                "requests": s["requests"],
                "errors": s["errors"],
                "cooling_down": s["cooldown_until"] > now and s.get("status") != "DEAD_LEAKED",
                "status": s.get("status", "ACTIVE"),
                "cooldown_remaining_s": max(0.0, round(s["cooldown_until"] - now, 1)) if s["cooldown_until"] > now else 0.0,
            }
            for i, s in enumerate(self._state)
        ]


class LLMService:
    GEMINI_MODEL = "gemini-2.5-flash"

    def __init__(self):
        self.last_used_provider: Optional[str] = None
        self.last_switch_reason: Optional[str] = None

        keys = [
            settings.GEMINI_API_KEY_1,
            settings.GEMINI_API_KEY_2,
            settings.GEMINI_API_KEY_3,
            settings.GEMINI_API_KEY_4,
            settings.GEMINI_API_KEY_5,
        ]
        self.rotator = GeminiKeyRotator(keys)
        if self.rotator.total_keys > 0:
            logger.info(f"✓ Gemini ready — {self.rotator.total_keys} key(s).")
        else:
            logger.warning("✗ No Gemini keys — Ollama only.")

    # ── Public: generate_response_stream ───────────────────────────────
    def generate_response_stream(
        self,
        query: str,
        search_results: List[Tuple[str, dict, float]],
        conversation_history: List[dict] = None,
    ) -> Generator[Tuple[str, str], None, None]:
        """Yields (chunk, provider). Gemini first, Ollama fallback."""

        from collections import defaultdict
        doc_chunks: dict = defaultdict(list)
        for text, meta, score in search_results:
            filename = meta.get("filename", "Unknown")
            page_num = meta.get("page_number", 1)
            chunk_idx = meta.get("chunk_index", 0)
            doc_chunks[filename].append(
                f"  [Page {page_num} | Chunk {chunk_idx}]\n  {text}"
            )

        context_sections = []
        for filename, chunk_list in doc_chunks.items():
            section = f"=== DOCUMENT: {filename} ===\n" + "\n\n".join(chunk_list)
            context_sections.append(section)
        context_text = "\n\n".join(context_sections)

        doc_names = list(doc_chunks.keys())
        is_multi_doc = len(doc_names) > 1

        # ── Try Gemini ─────────────────────────────────────────────────
        if self.rotator.total_keys > 0:
            for _ in range(self.rotator.total_keys + 1):
                key = self.rotator.get_available_key()
                if not key:
                    logger.warning("No Gemini key available — going to Ollama.")
                    break
                try:
                    gen = self._generate_gemini_stream(
                        query, context_text, doc_names, is_multi_doc, conversation_history, key
                    )
                    first = next(gen)
                    self.rotator.mark_used()
                    self.last_used_provider = "gemini"
                    logger.info("✅ Responding via Gemini")
                    yield first, "gemini"
                    for chunk in gen:
                        yield chunk, "gemini"
                    return

                except Exception as e:
                    err = str(e).lower()
                    if "leaked" in err or "403" in err or "permission_denied" in err:
                        self.rotator.mark_leaked_error()
                        self.last_switch_reason = f"Gemini leaked: {e}"
                        continue
                    elif any(k in err for k in ("quota", "429", "resource_exhausted", "resourceexhausted")):
                        self.rotator.mark_quota_error()
                        self.last_switch_reason = f"Gemini quota: {e}"
                        continue
                    else:
                        self.last_switch_reason = f"Gemini error: {e}"
                        logger.warning(f"⚠️ Gemini failed ({e}) — switching to Ollama.")
                        break

        raise Exception(
            "No Gemini keys are currently available. All keys are on cooldown or exhausted. "
            "Please try again in a moment or contact support."
        )

    # ── Professional system prompt ──────────────────────────────────────
    @staticmethod
    def _build_system_prompt(context_text: str, doc_names: List[str], is_multi_doc: bool) -> str:
        if is_multi_doc:
            doc_scope = (
                f"You are answering from {len(doc_names)} selected documents: "
                f"{', '.join(chr(34) + n + chr(34) for n in doc_names)}."
            )
            multi_rules = (
                "- Attribute each piece of information to its source document using the format: *(Source: filename)*\n"
                "- If different documents provide conflicting information, present both perspectives clearly and note the discrepancy.\n"
                "- If only one document is relevant to the question, state which document the answer comes from.\n"
            )
        else:
            doc_scope = (
                f'You are answering exclusively from the document: '
                f'"{doc_names[0] if doc_names else "the selected document"}".'
            )
            multi_rules = ""

        return f"""You are NEXORA — an expert document intelligence assistant built for professionals.
Your role is to provide accurate, well-structured, and insightful answers drawn exclusively from the provided document excerpts.

SCOPE
{doc_scope}

═══════════════════════════════════════════════
STRICT GROUNDING RULES
═══════════════════════════════════════════════
1. Answer ONLY from the document excerpts below. No exceptions.
2. Never use external knowledge, assumptions, or general world facts.
3. If the answer is not present in the excerpts, respond with exactly:
   "This information is not found in the selected document(s)."
4. Never repeat a prior response verbatim. Every answer must be freshly derived from the excerpts.
5. Do not reference page numbers, chunk indices, or internal metadata labels in your answer.
{multi_rules}
═══════════════════════════════════════════════
RESPONSE QUALITY STANDARDS
═══════════════════════════════════════════════
Your answers must meet professional document analysis standards:

• CLARITY     — Use precise language. Avoid vague terms like "some", "things", "stuff".
• STRUCTURE   — Organise complex answers with headers, bullets, or numbered steps as appropriate.
• DEPTH       — Synthesise across excerpts when needed. Surface non-obvious connections.
• CONCISENESS — No filler, padding, or repetition. Every sentence must add value.
• TONE        — Professional and neutral. Never casual, never opinionated.

FORMATTING GUIDE:
- **Bold** key terms, proper nouns, and critical values on first use.
- Use bullet points ( • ) for unordered lists of 3 or more items.
- Use numbered lists (1. 2. 3.) for sequential steps or ranked items.
- Use a ## heading when the answer covers multiple distinct sub-topics.
- Keep paragraphs to 3–4 lines maximum.
- For definitions: **Term** — explanation.
- For comparisons: use a short two-column format or clearly separated bullets.

═══════════════════════════════════════════════
DOCUMENT EXCERPTS
═══════════════════════════════════════════════
{context_text}

═══════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════
You MUST return ONLY a single valid JSON object. No markdown fences, no prose outside the JSON.

Answer classification — choose the most accurate:
  "direct"    → answer is stated explicitly in the document
  "inferred"  → answer requires synthesising 2 or more excerpts
  "partial"   → document partially addresses the question; note what is missing
  "not_found" → answer is genuinely absent from all excerpts

Confidence scoring:
  0.9–1.0 → answer is unambiguous and fully supported
  0.7–0.9 → answer is well-supported but requires minor inference
  0.5–0.7 → partial support; some gaps remain
  0.0–0.5 → very limited support; set confidence_low to true

If confidence < 0.6, populate suggestions[] with 1–2 refined follow-up questions
that would help the user get a more complete answer.

{{
  "answer": "Your professional, well-formatted answer here.",
  "answer_type": "direct | inferred | partial | not_found",
  "source_pages": [],
  "confidence": 0.85,
  "confidence_low": false,
  "suggestions": []
}}"""

    # ── Gemini streaming ────────────────────────────────────────────────
    def _generate_gemini_stream(
        self,
        query: str,
        context_text: str,
        doc_names: List[str],
        is_multi_doc: bool,
        conversation_history: Optional[List[dict]],
        api_key: str,
    ) -> Generator[str, None, None]:
        genai.configure(api_key=api_key)
        system_prompt = self._build_system_prompt(context_text, doc_names, is_multi_doc)
        model = genai.GenerativeModel(self.GEMINI_MODEL, system_instruction=system_prompt)

        history = []
        if conversation_history:
            for msg in conversation_history[-6:]:
                role = "user" if msg["role"] == "user" else "model"
                history.append({"role": role, "parts": [msg["content"]]})

        # Hard JSON enforcement appended to every user query
        enforced_query = (
            f"{query}\n\n"
            "CRITICAL INSTRUCTION: Your entire response must be a single valid JSON object "
            "and nothing else — no markdown fences, no prose before or after, no explanation. "
            "Follow the output format specified in your instructions exactly:\n"
            '{"answer":"...","answer_type":"direct|inferred|partial|not_found",'
            '"source_pages":[],"confidence":0.0,"confidence_low":false,"suggestions":[]}'
        )

        chat_session = model.start_chat(history=history)
        response = chat_session.send_message(enforced_query, stream=True)
        for chunk in response:
            text = chunk.text if hasattr(chunk, "text") else ""
            if text:
                yield text

    def get_status(self) -> Dict:
        return {
            "gemini": {
                "configured_keys": self.rotator.total_keys,
                "model": self.GEMINI_MODEL,
                "key_states": self.rotator.get_status(),
            },
            "last_used_provider": self.last_used_provider,
            "last_switch_reason": self.last_switch_reason,
            "primary_provider": "gemini" if self.rotator.total_keys > 0 else "none",
            "available_providers": (
                ["gemini"] if self.rotator.total_keys > 0 else []
            ),
            "model": self.GEMINI_MODEL,
        }


class _QuotaError(Exception):
    pass


llm_service = LLMService()