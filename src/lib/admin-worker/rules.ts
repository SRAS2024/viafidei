/**
 * Versioned rule engine. The Admin Worker uses deterministic rules
 * (not AI) for every major decision. Rules are versioned so a rule
 * change can be rolled back; they are testable so behaviour is
 * provable; they are visible in admin so the operator can audit them.
 *
 * Phase 1 ships the rule catalog + a minimal evaluator. Rule
 * categories map exactly to spec section 4.
 */

export type RuleCategory =
  | "source_selection"
  | "content_extraction"
  | "content_type_classification"
  | "content_package_formatting"
  | "catholic_correctness"
  | "cross_source_validation"
  | "publish"
  | "deletion"
  | "homepage_design"
  | "security"
  | "report";

export interface Rule<TInput = unknown, TOutput = unknown> {
  id: string;
  category: RuleCategory;
  version: number;
  description: string;
  evaluate(input: TInput): { pass: boolean; reason: string; output?: TOutput };
}

const RULES: Rule[] = [];

export function registerRule<TInput, TOutput>(rule: Rule<TInput, TOutput>): void {
  // Replace any existing rule with the same id (so rule versions live
  // alongside each other only when ids differ).
  const idx = RULES.findIndex((r) => r.id === rule.id);
  if (idx >= 0) {
    RULES[idx] = rule as Rule;
  } else {
    RULES.push(rule as Rule);
  }
}

export function listRules(category?: RuleCategory): readonly Rule[] {
  if (!category) return RULES;
  return RULES.filter((r) => r.category === category);
}

// --- Built-in rules -----------------------------------------------------------

registerRule({
  id: "publish.require_source_evidence",
  category: "publish",
  version: 1,
  description: "Public content must have at least one source citation.",
  evaluate(input: { citationCount: number }) {
    const pass = (input?.citationCount ?? 0) >= 1;
    return { pass, reason: pass ? "has citations" : "no citations attached" };
  },
});

registerRule({
  id: "publish.minimum_quality_score",
  category: "publish",
  version: 1,
  description: "Content quality finalScore must be >= 0.8.",
  evaluate(input: { finalScore: number }) {
    const pass = (input?.finalScore ?? 0) >= 0.8;
    return { pass, reason: pass ? "score >= 0.8" : `score ${input.finalScore} < 0.8` };
  },
});

registerRule({
  id: "deletion.requires_high_confidence",
  category: "deletion",
  version: 1,
  description: "Auto-deletion requires confidence >= 0.9.",
  evaluate(input: { confidence: number }) {
    const pass = (input?.confidence ?? 0) >= 0.9;
    return { pass, reason: pass ? "confidence >= 0.9" : `confidence ${input.confidence} < 0.9` };
  },
});

registerRule({
  id: "homepage_design.preserve_major_sections",
  category: "homepage_design",
  version: 1,
  description: "Major section deletion requires high confidence or human review.",
  evaluate(input: { sectionsRemoved: number; confidence: number }) {
    const removed = input?.sectionsRemoved ?? 0;
    const conf = input?.confidence ?? 0;
    const pass = removed === 0 || conf >= 0.95;
    return {
      pass,
      reason: pass
        ? "no risky section removal"
        : `removed ${removed} sections at confidence ${conf}`,
    };
  },
});

registerRule({
  id: "security.brute_force_ban",
  category: "security",
  version: 1,
  description: "Ban a device only when classification=Breach and confidence >= 0.9.",
  evaluate(input: { classification: string; confidence: number }) {
    const pass = input?.classification === "Breach" && (input?.confidence ?? 0) >= 0.9;
    return {
      pass,
      reason: pass ? "confirmed brute force" : "not a confirmed breach",
    };
  },
});

registerRule({
  id: "source_selection.skip_paused",
  category: "source_selection",
  version: 1,
  description: "Skip sources currently paused by the reputation engine.",
  evaluate(input: { paused: boolean }) {
    const pass = !input?.paused;
    return { pass, reason: pass ? "source active" : "source paused" };
  },
});

registerRule({
  id: "catholic_correctness.no_scripture_unapproved_translation",
  category: "catholic_correctness",
  version: 1,
  description: "Block scripture quoted from unapproved translation sources.",
  evaluate(input: { translationApproved: boolean }) {
    const pass = input?.translationApproved !== false;
    return { pass, reason: pass ? "approved translation" : "translation not approved" };
  },
});

registerRule({
  id: "content_extraction.minimum_body_length",
  category: "content_extraction",
  version: 1,
  description: "Extracted content body must be at least 40 characters.",
  evaluate(input: { bodyLength: number }) {
    const pass = (input?.bodyLength ?? 0) >= 40;
    return { pass, reason: pass ? "body length ok" : `body length ${input.bodyLength} < 40` };
  },
});

registerRule({
  id: "content_type_classification.requires_predicted_type",
  category: "content_type_classification",
  version: 1,
  description: "Candidate URLs must have a predicted content type before fetching.",
  evaluate(input: { predictedContentType: string | null }) {
    const pass = Boolean(input?.predictedContentType);
    return {
      pass,
      reason: pass ? "content type predicted" : "no predicted content type",
    };
  },
});

registerRule({
  id: "content_package_formatting.no_html_leak",
  category: "content_package_formatting",
  version: 1,
  description: "Formatted package body must not contain raw HTML tags.",
  evaluate(input: { body: string }) {
    const body = String(input?.body ?? "");
    const pass = !/<[a-z][^>]*>/i.test(body);
    return { pass, reason: pass ? "no HTML leak" : "raw HTML tag detected" };
  },
});

registerRule({
  id: "cross_source_validation.minimum_distinct_sources",
  category: "cross_source_validation",
  version: 1,
  description: "Validation evidence must cover at least 2 distinct sources.",
  evaluate(input: { distinctSourceCount: number }) {
    const pass = (input?.distinctSourceCount ?? 0) >= 2;
    return {
      pass,
      reason: pass
        ? `${input.distinctSourceCount} distinct sources`
        : `only ${input.distinctSourceCount ?? 0} distinct source(s)`,
    };
  },
});

registerRule({
  id: "report.must_redact_secrets",
  category: "report",
  version: 1,
  description: "Generated reports must redact secrets (passwords, tokens, etc.).",
  evaluate(input: { rendered: string }) {
    const rendered = String(input?.rendered ?? "");
    // Heuristic: a "password=" or "token=" in plain text is a leak.
    const pass = !/(password|api_key|token|session_secret|database_url)\s*[:=]\s*[^[\s]/i.test(
      rendered,
    );
    return { pass, reason: pass ? "no secret leak detected" : "potential secret in report body" };
  },
});
