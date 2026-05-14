import json
import re
import logging
import json_repair

logger = logging.getLogger(__name__)


def parse_llm_json(raw: str) -> dict | None:
    """
    Parse a JSON string from LLM output.
    Returns a valid dict on success, or None on failure.
    Caller is responsible for handling the None case.
    """
    if not raw or not raw.strip():
        return None

    raw = raw.strip()

    # Strip markdown fences (```json ... ``` or ``` ... ```)
    raw = re.sub(r'^```(?:json)?\s*', '', raw, flags=re.MULTILINE)
    raw = re.sub(r'\s*```\s*$', '', raw, flags=re.MULTILINE)
    raw = raw.strip()

    # Extract the first {...} block in case there's prose before/after
    json_match = re.search(r'\{.*\}', raw, re.DOTALL)
    if json_match:
        raw = json_match.group(0)

    parsed = None

    # 1. Standard json.loads
    try:
        parsed = json.loads(raw)
    except Exception:
        pass

    # 2. json-repair (handles trailing commas, missing quotes, etc.)
    if parsed is None:
        try:
            logger.warning(
                f"Failed to parse JSON natively, trying json-repair. "
                f"Raw (first 200 chars): {raw[:200]}"
            )
            result = json_repair.repair_json(raw, return_objects=True)
            # repair_json returns a string when it can't make a dict
            if isinstance(result, dict):
                parsed = result
        except Exception:
            pass

    # 3. Return None if we still don't have a dict — caller will use raw text
    if not isinstance(parsed, dict):
        logger.warning(
            f"json-repair could not produce a dict. "
            f"Raw (first 200 chars): {raw[:200]}"
        )
        return None

    # 4. Enforce schema — fill in any missing keys with safe defaults
    if "answer" not in parsed or not isinstance(parsed.get("answer"), str):
        parsed["answer"] = ""
    if "answer_type" not in parsed:
        parsed["answer_type"] = "not_found"
    if "source_pages" not in parsed or not isinstance(parsed.get("source_pages"), list):
        parsed["source_pages"] = []
    if "confidence" not in parsed:
        parsed["confidence"] = 0.0
    if "confidence_low" not in parsed:
        parsed["confidence_low"] = True
    if "suggestions" not in parsed or not isinstance(parsed.get("suggestions"), list):
        parsed["suggestions"] = []

    return parsed