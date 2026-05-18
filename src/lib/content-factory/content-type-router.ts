/**
 * Content type router.
 *
 * When a source supports multiple content types, the router decides
 * which builders SHOULD run against a given SourceDocument. The
 * router uses:
 *
 *   - Source purpose flags        (gates: only types the source is approved for)
 *   - Source URL pattern          (e.g. /saints/ vs /prayers/ paths)
 *   - Page title + headings       (textual signals about the document)
 *   - Metadata                    (open-graph type, schema.org type)
 *   - Builder eligibility rules   (BUILDER_VERSION_REGISTRY required sections)
 *
 * The router never runs a builder if the source is not approved for
 * the content type, regardless of URL/title signals.
 *
 * The router returns a confidence-ordered list of content types so
 * the dispatcher can either enqueue the top match (when the signal
 * is strong) or enqueue the full eligible set (when nothing
 * dominates). The current dispatcher uses the eligible set; this
 * helper exposes the ranking for future routing decisions and for
 * the admin "which builders ran for this URL?" diagnostic.
 */

import type { ContentTypeKey } from "./types";
import { BUILDER_VERSION_REGISTRY, type BuilderRegistryEntry } from "./builder-registry";

export type RouterSignals = {
  sourceUrl: string;
  sourceHost: string;
  title?: string | null;
  headings?: ReadonlyArray<{ level: number; text: string }> | null;
  metadata?: Record<string, string | undefined> | null;
  /** Source purpose flags as a Record so the router can read them generically. */
  sourcePurposes?: Record<string, boolean> | null;
};

export type RouterDecision = {
  /** Allowed types in confidence order (highest first). */
  ranked: ReadonlyArray<{ contentType: ContentTypeKey; score: number; reasons: string[] }>;
  /** Types the router refused to consider (with the reason). */
  rejected: ReadonlyArray<{ contentType: ContentTypeKey; reason: string }>;
};

const URL_PATTERN_HINTS: Partial<Record<ContentTypeKey, RegExp>> = {
  Prayer: /\/(prayer|prayers|orations?)\b/i,
  Saint: /\/(saint|saints|sancti|vita)\b/i,
  MarianApparition: /\/(apparition|fatima|lourdes|guadalupe)\b/i,
  Parish: /\/(parish|parishes|church-locator|directory)\b/i,
  Devotion: /\/(devotion|devotions|spiritual-devotion)\b/i,
  Novena: /\/(novena|novenas|nine-day)\b/i,
  Sacrament:
    /\/(sacrament|baptism|eucharist|confirmation|reconciliation|matrimony|holy-orders|anointing)\b/i,
  Rosary: /\/(rosary|rosaries|mysteries-of-the-rosary)\b/i,
  Consecration: /\/(consecration|consecrate|act-of-consecration)\b/i,
  SpiritualGuidance: /\/(spiritual-(?:guidance|direction|life))\b/i,
  Liturgy: /\/(liturgy|liturgical|mass-readings?|divine-office|breviary)\b/i,
  History: /\/(history|councils?|encyclical|catechism|canon-law|papal)\b/i,
};

const TITLE_HINTS: Partial<Record<ContentTypeKey, RegExp>> = {
  Prayer: /\b(prayer\b|orations?|litany|chaplet|invocation)/i,
  Saint: /\b(saint|st\.|st\b|venerable|blessed)/i,
  MarianApparition: /\bapparition(s)?\b|our\s+lady\s+of/i,
  Parish: /\bparish\b|catholic\s+church\b/i,
  Devotion: /\bdevotion(s)?\b/i,
  Novena: /\bnovena\b/i,
  Sacrament:
    /\b(baptism|eucharist|confirmation|reconciliation|matrimony|holy\s+orders|anointing\s+of\s+the\s+sick)\b/i,
  Rosary: /\brosary\b|mysteries\s+of\s+the\s+rosary/i,
  Consecration: /\bconsecration\b|33[\s-]?day\s+consecration/i,
  SpiritualGuidance: /\bspiritual\s+(guidance|direction|life)\b/i,
  Liturgy: /\b(liturgy|liturgical|breviary|divine\s+office)\b/i,
  History: /\b(council|encyclical|catechism|canon\s+law|schism|papal)\b/i,
};

const NEGATIVE_HINTS: Array<RegExp> = [
  /\blivestream\b/i,
  /\b(?:online\s+)?event\b/i,
  /\bbulletin\b/i,
  /\bnews\s*article\b/i,
  /\bschedule\b/i,
];

/**
 * Score a content type against the router signals. Higher = more
 * confident. A negative score (-1) means a negative hint matched and
 * the candidate should be rejected outright; the dispatcher uses
 * the rank for non-negative scores only.
 */
function scoreContentType(
  entry: BuilderRegistryEntry,
  signals: RouterSignals,
): { score: number; reasons: string[]; rejected: boolean } {
  const reasons: string[] = [];
  let score = 0;
  const url = signals.sourceUrl ?? "";
  const title = signals.title ?? "";
  const headings = (signals.headings ?? []).map((h) => h.text).join(" ");

  // Negative hints are a hard exclusion — livestreams, events,
  // bulletins, and schedules can never become valid Catholic
  // content packages even if the URL/title looks promising.
  if (NEGATIVE_HINTS.some((re) => re.test(title) || re.test(url))) {
    reasons.push("negative_hint_match");
    return { score: -1, reasons, rejected: true };
  }
  const urlHint = URL_PATTERN_HINTS[entry.contentType];
  if (urlHint && urlHint.test(url)) {
    score += 2;
    reasons.push("url_pattern_match");
  }
  const titleHint = TITLE_HINTS[entry.contentType];
  if (titleHint && (titleHint.test(title) || titleHint.test(headings))) {
    score += 2;
    reasons.push("title_or_heading_match");
  }
  if (signals.metadata) {
    const ogType = signals.metadata["og:type"] ?? signals.metadata["schema:type"];
    if (ogType && new RegExp(`\\b${entry.contentType}\\b`, "i").test(ogType)) {
      score += 1;
      reasons.push("metadata_match");
    }
  }
  return { score, reasons, rejected: false };
}

/**
 * Route a SourceDocument to the eligible builders. The router refuses
 * any content type the source is not approved for (source purpose
 * flag missing) and ranks the rest by URL/title/heading/metadata
 * signals.
 */
export function routeContentTypes(signals: RouterSignals): RouterDecision {
  const purposes = signals.sourcePurposes ?? {};
  const ranked: Array<{ contentType: ContentTypeKey; score: number; reasons: string[] }> = [];
  const rejected: Array<{ contentType: ContentTypeKey; reason: string }> = [];
  for (const entry of Object.values(BUILDER_VERSION_REGISTRY)) {
    if (!purposes[entry.requiredSourcePurpose]) {
      rejected.push({
        contentType: entry.contentType,
        reason: `source_not_approved_for_${entry.requiredSourcePurpose}`,
      });
      continue;
    }
    const result = scoreContentType(entry, signals);
    if (result.rejected) {
      rejected.push({
        contentType: entry.contentType,
        reason: `negative_signal: ${result.reasons.join(",")}`,
      });
      continue;
    }
    ranked.push({
      contentType: entry.contentType,
      score: result.score,
      reasons: result.reasons,
    });
  }
  ranked.sort((a, b) => b.score - a.score);
  return { ranked, rejected };
}
