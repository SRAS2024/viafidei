/**
 * Secret redaction for diagnostics and the Developer Audit report.
 *
 * Two boundaries use this module:
 *   1. Before a DiagnosticSnapshot row is written — its `detailsJson`
 *      passes through `redactValue()` so a secret can never be
 *      persisted into the diagnostic history.
 *   2. Before the Developer Audit PDF is generated — every log entry's
 *      free-text and metadata pass through redaction so a downloaded
 *      report can never leak credentials.
 *
 * What gets redacted: passwords, session secrets, API keys, bearer /
 * authorization headers, raw tokens, full database / connection URLs,
 * raw cookies, and the values of keys that name a private secret.
 *
 * What is deliberately KEPT: status, error type / message text,
 * route paths, content types, job kinds, source hosts, worker IDs,
 * timestamps, counts, and one-way HMAC fingerprints / hashes — these
 * are the non-secret diagnostics that make the report useful. Booleans
 * and numbers are never redacted because they cannot carry a secret.
 */

export const REDACTED = "[redacted]";

/** Object keys whose string value is always a secret. */
const SENSITIVE_KEY = new RegExp(
  [
    "password",
    "passwd",
    "pwd",
    "secret",
    "session[_-]?secret",
    "api[_-]?key",
    "apikey",
    "access[_-]?key",
    "auth[_-]?token",
    "accesstoken",
    "refreshtoken",
    "bearer",
    "authorization",
    "cookie",
    "set-cookie",
    "private[_-]?key",
    "client[_-]?secret",
    "database[_-]?url",
    "db[_-]?url",
    "connection[_-]?string",
    "dsn",
  ].join("|"),
  "i",
);

/**
 * Keys that look sensitive but are safe one-way values — a hash or
 * fingerprint is not reversible, and an id is an identifier, not a
 * credential. These are excluded from key-based redaction so the
 * report keeps the diagnostics that make it useful.
 */
const SAFE_KEY_SUFFIX = /(hash|fingerprint|id|count|status|name|host|route|kind|at|type)$/i;

type Pattern = { re: RegExp; replace: string };

/** Value-level scrubbers — catch a secret embedded inside free text. */
const VALUE_PATTERNS: Pattern[] = [
  // Full database / message-broker connection URLs.
  {
    re: /\b(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|rediss|amqps?):\/\/\S+/gi,
    replace: "$1://[redacted]",
  },
  // Authorization headers.
  { re: /\b(Bearer|Basic)\s+[A-Za-z0-9._\-+/=]{6,}/gi, replace: "$1 [redacted]" },
  // JSON Web Tokens.
  {
    re: /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g,
    replace: "[redacted-token]",
  },
  // Common provider key prefixes (Resend, Stripe, GitHub, Slack, …).
  {
    re: /\b(re|sk|rk|pk|ghp|gho|ghu|ghs|xoxb|xoxp)[_-][A-Za-z0-9_-]{12,}/g,
    replace: "[redacted-key]",
  },
  // Inline `secret=…` / `token: …` / `password=…` assignments.
  {
    re: /\b(password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|authorization|cookie)\s*[=:]\s*['"]?[^\s'"&;]+/gi,
    replace: "$1=[redacted]",
  },
];

/** Scrub a single string value of any embedded secret. */
export function redactString(value: string): string {
  let out = value;
  for (const { re, replace } of VALUE_PATTERNS) {
    out = out.replace(re, replace);
  }
  return out;
}

function isSensitiveKey(key: string): boolean {
  if (SAFE_KEY_SUFFIX.test(key)) return false;
  return SENSITIVE_KEY.test(key);
}

/**
 * Deep-redact an arbitrary JSON-ish value. Strings are scrubbed for
 * embedded secrets; the string value of a sensitive key is replaced
 * wholesale. Numbers, booleans, and null pass through untouched.
 */
export function redactValue(value: unknown, key?: string): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (key && isSensitiveKey(key) && value.length > 0) return REDACTED;
    return redactString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactValue(v, k);
    }
    return out;
  }
  return REDACTED;
}

/**
 * Redact a flat `Record` of diagnostic detail values, preserving the
 * primitive shape diagnostics use.
 */
export function redactDetails(
  details: Record<string, string | number | boolean | null | undefined>,
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(details)) {
    if (value === undefined) continue;
    const redacted = redactValue(value, key);
    out[key] =
      typeof redacted === "string" ||
      typeof redacted === "number" ||
      typeof redacted === "boolean" ||
      redacted === null
        ? redacted
        : REDACTED;
  }
  return out;
}
