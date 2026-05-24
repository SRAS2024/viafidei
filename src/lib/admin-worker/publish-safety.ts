/**
 * Publish-safety pattern blockers (spec section 15).
 *
 * Even after QA passes, the Admin Worker must refuse to publish
 * specific categories of obvious-wrong content that historically
 * slipped through schema validation. These blockers are deterministic
 * pattern checks on titles, slugs, source URLs, and key payload
 * fields.
 *
 * The blockers run BEFORE the publish gate; a hit forces the package
 * to either rejection or human review depending on the rule.
 */

import { isJunkUrl } from "./web-navigator";

export type SafetyBlockReason =
  | "incomplete_prayer"
  | "article_about_prayer"
  | "saint_named_institution"
  | "livestream"
  | "event_page"
  | "bulletin"
  | "store_page"
  | "donation_page"
  | "random_news"
  | "wrong_content_type"
  | "no_source_evidence"
  | "unapproved_scripture_translation";

export interface SafetyInput {
  contentType: string;
  title: string;
  slug?: string;
  sourceUrl?: string;
  /** Free-form body text the worker built (for content classification). */
  bodyText?: string;
  /** Direct payload fields the safety check inspects. */
  hasSourceEvidence: boolean;
  /** Scripture translation declared by the package, when applicable. */
  scriptureTranslation?: string;
  /** Approved scripture translations (RSV-CE, NABRE, etc.). */
  approvedTranslations?: ReadonlyArray<string>;
}

export interface SafetyDecision {
  blocked: boolean;
  reasons: SafetyBlockReason[];
  details: string[];
}

const PRAYER_ARTICLE_PHRASES: readonly RegExp[] = [
  /\b(how to pray|the history of|reflections? on|what is the)\b/i,
  /\barticle about\b/i,
  /\bessay\b/i,
];

const INSTITUTION_SUFFIXES: readonly string[] = [
  "hospital",
  "school",
  "university",
  "college",
  "academy",
  "parish",
  "cathedral",
  "basilica",
  "shrine",
  "monastery",
  "abbey",
  "convent",
  "seminary",
  "church",
  "chapel",
];

function endsWithInstitutionSuffix(title: string): boolean {
  const lower = title.toLowerCase();
  for (const suffix of INSTITUTION_SUFFIXES) {
    if (lower.endsWith(` ${suffix}`)) return true;
    if (lower.includes(` ${suffix} of `)) return true;
    if (lower.includes(` ${suffix}'s `)) return true;
  }
  return false;
}

function looksIncomplete(text: string | undefined): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  if (trimmed.length < 40) return true;
  if (/^\s*(prayer\s+text|tbd|todo|coming soon|placeholder)\s*\.?$/i.test(trimmed)) return true;
  return false;
}

/**
 * Run every pattern blocker for the given content type. Returns the
 * union of reasons; `blocked = true` when at least one fired.
 */
export function evaluatePublishSafety(input: SafetyInput): SafetyDecision {
  const reasons: SafetyBlockReason[] = [];
  const details: string[] = [];

  // Universal rules.
  if (!input.hasSourceEvidence) {
    reasons.push("no_source_evidence");
    details.push("no citations or source URL attached");
  }

  if (input.sourceUrl) {
    const junk = isJunkUrl(input.sourceUrl);
    if (junk.junk) {
      reasons.push(reasonForJunk(input.sourceUrl));
      details.push(`source URL is junk: ${junk.reason ?? "matched pattern"}`);
    }
  }

  // Per-content-type rules.
  if (input.contentType === "PRAYER") {
    if (looksIncomplete(input.bodyText)) {
      reasons.push("incomplete_prayer");
      details.push("prayer text is empty or placeholder");
    }
    if (PRAYER_ARTICLE_PHRASES.some((re) => re.test(input.title))) {
      reasons.push("article_about_prayer");
      details.push("title looks like an article about a prayer, not the prayer itself");
    }
  }

  if (input.contentType === "SAINT" && endsWithInstitutionSuffix(input.title)) {
    reasons.push("saint_named_institution");
    details.push(`title "${input.title}" looks like an institution, not a person`);
  }

  if (
    input.scriptureTranslation &&
    input.approvedTranslations &&
    !input.approvedTranslations.includes(input.scriptureTranslation)
  ) {
    reasons.push("unapproved_scripture_translation");
    details.push(`scripture translation "${input.scriptureTranslation}" is not approved`);
  }

  return { blocked: reasons.length > 0, reasons, details };
}

function reasonForJunk(url: string): SafetyBlockReason {
  const lower = url.toLowerCase();
  if (/(live|livestream|stream|watch)/.test(lower)) return "livestream";
  if (/(event|calendar)/.test(lower)) return "event_page";
  if (/(donate|giving)/.test(lower)) return "donation_page";
  if (/(bulletin|newsletter)/.test(lower)) return "bulletin";
  if (/(shop|store|cart|checkout|gift-shop|bookstore)/.test(lower)) return "store_page";
  if (/(news|press|blog)/.test(lower)) return "random_news";
  return "wrong_content_type";
}
