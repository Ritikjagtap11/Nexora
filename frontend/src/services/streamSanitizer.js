/**
 * streamSanitizer.js
 * Sanitizes streaming text to fix token duplication issues (e.g., "the the",
 * "propertiesproperties", "defineddefined") common in SSE streams or double-renders.
 */

export function sanitizeStreamingText(text) {
  if (!text || typeof text !== 'string') return text;

  let sanitized = text;

  // 1. Fix adjacent joined duplicated words (e.g., "propertiesproperties" -> "properties", "defineddefined" -> "defined")
  // Matches any word boundary, followed by a sequence of 3 or more letters, followed immediately by the exact same sequence.
  sanitized = sanitized.replace(/\b([a-zA-Z]{3,})\1\b/g, '$1');

  // 2. Fix consecutive duplicated words separated by spaces (e.g., "the the" -> "the", "defined  defined" -> "defined")
  // Matches a word of 2 or more letters, followed by one or more whitespace characters, followed by the exact same word.
  // Performs a case-insensitive match and handles multiple occurrences.
  sanitized = sanitized.replace(/\b([a-zA-Z]{2,})\s+\1\b/gi, '$1');

  return sanitized;
}
