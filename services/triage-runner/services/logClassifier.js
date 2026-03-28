const ACTIONABLE_PATTERNS = [
  /\b(error|fatal|exception|traceback|panic)\b/i,
  /\b5\d{2}\b/,
  /\bunhandled\b/i,
  /\bfailed\b/i,
];

const NOISE_PATTERNS = [
  /\bdeprecated\b/i,
  /\bwarning\b/i,
];

export function classifyLogSnippet(logSnippet) {
  const text = String(logSnippet || "").trim();

  if (!text) {
    return {
      shouldInvestigate: false,
      matchedPatterns: [],
      reason: "empty_logs",
    };
  }

  const matchedPatterns = ACTIONABLE_PATTERNS
    .filter((pattern) => pattern.test(text))
    .map((pattern) => pattern.source);

  if (!matchedPatterns.length) {
    return {
      shouldInvestigate: false,
      matchedPatterns: [],
      reason: NOISE_PATTERNS.some((pattern) => pattern.test(text))
        ? "warnings_only"
        : "no_actionable_signal",
    };
  }

  return {
    shouldInvestigate: true,
    matchedPatterns,
    reason: "actionable_error_detected",
  };
}
