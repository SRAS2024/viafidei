/**
 * Payload scanner for admin content fields. Detects obvious
 * script-injection / executable-payload / SQL-injection patterns
 * so they can be blocked at the API boundary and logged as a
 * Security Breach attempt.
 *
 * The scanner is a defense-in-depth layer — content fields are
 * already escaped by React on render, but blocking malicious
 * payloads *before* they reach the DB prevents stored-XSS and
 * keeps the audit log clean.
 *
 * The patterns intentionally err toward false negatives over
 * false positives so legitimate admin content (a saint biography
 * that mentions JavaScript, a prayer with "DROP" in it) is not
 * blocked. The patterns flag only patterns that have no plausible
 * place in religious-content fields.
 */

export type PayloadThreat = {
  kind:
    | "script_tag"
    | "javascript_url"
    | "event_handler"
    | "sql_keyword_chain"
    | "shell_redirect"
    | "factory_gate_bypass";
  match: string;
};

/**
 * Field names that may NEVER appear in an admin-supplied payload —
 * these are exclusively managed by the content factory's
 * persistBuiltPackage() after strict QA accepts a package. An
 * attempt to set them from the API surface is a factory-bypass
 * attempt and gets logged as a Security Breach.
 */
const FACTORY_GATE_FIELDS = new Set([
  "publicRenderReady",
  "isThresholdEligible",
  "packageValidationStatus",
  "contentPackageVersion",
  "lastPackageValidatedAt",
  "packageContractVersion",
]);

const SCRIPT_TAG_RE = /<script\b[^>]*>[\s\S]*?<\/script>/i;
const JS_URL_RE = /\bjavascript\s*:\s*[^\s"']{3,}/i;
const EVENT_HANDLER_RE = /\b(?:on(?:click|error|load|mouseover|focus|submit))\s*=\s*['"]/i;
// SQL injection — chained keywords that have no place in religious
// content fields. Single keywords like "drop" alone are too common.
const SQL_INJECTION_RE =
  /\b(?:union\s+select|drop\s+table|insert\s+into\s+[^\s]+\s+values|delete\s+from\s+[^\s]+\s+where|update\s+[^\s]+\s+set\s+[^\s]+\s*=)\b/i;
// Shell redirect / command chain in field text.
const SHELL_REDIRECT_RE = /;\s*(?:rm\s+-rf|wget\s+http|curl\s+-O|nc\s+-e|bash\s+-i)\b/i;

/**
 * Scan an arbitrary content payload (string OR nested object/array
 * of strings) for known threat patterns. Returns the first threat
 * it finds, or `null` when no patterns match.
 *
 * Object scanning also detects factory-gate field-name bypass
 * attempts: any key in FACTORY_GATE_FIELDS at any nesting level
 * fires `factory_gate_bypass` so the admin-mutation gate can log
 * the attempt as a Security Breach.
 */
export function scanForThreats(payload: unknown): PayloadThreat | null {
  if (payload == null) return null;
  if (typeof payload === "string") return scanString(payload);
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const hit = scanForThreats(item);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof payload === "object") {
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      if (FACTORY_GATE_FIELDS.has(key)) {
        return { kind: "factory_gate_bypass", match: key };
      }
      const hit = scanForThreats(value);
      if (hit) return hit;
    }
    return null;
  }
  return null;
}

function scanString(value: string): PayloadThreat | null {
  if (value.length === 0) return null;
  const scriptMatch = SCRIPT_TAG_RE.exec(value);
  if (scriptMatch) return { kind: "script_tag", match: scriptMatch[0].slice(0, 80) };
  const jsMatch = JS_URL_RE.exec(value);
  if (jsMatch) return { kind: "javascript_url", match: jsMatch[0].slice(0, 80) };
  const handlerMatch = EVENT_HANDLER_RE.exec(value);
  if (handlerMatch) return { kind: "event_handler", match: handlerMatch[0].slice(0, 80) };
  const sqlMatch = SQL_INJECTION_RE.exec(value);
  if (sqlMatch) return { kind: "sql_keyword_chain", match: sqlMatch[0].slice(0, 80) };
  const shellMatch = SHELL_REDIRECT_RE.exec(value);
  if (shellMatch) return { kind: "shell_redirect", match: shellMatch[0].slice(0, 80) };
  return null;
}
