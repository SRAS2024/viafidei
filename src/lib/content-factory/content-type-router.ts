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
 * The router returns a confidence-ordered list of content types AND a
 * `selected` subset — the types that carry a STRONG positive signal
 * (a URL-path match or a title/heading match). A source merely
 * permitting a content type is not, by itself, a reason to build that
 * type: the dispatcher enqueues `selected` when it is non-empty so a
 * `/prayers/` page is not also queued as a Saint / Devotion / Novena
 * build. `ranked` is still exposed for the admin "which builders
 * could run for this URL?" diagnostic.
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
  /**
   * The subset of `ranked` carrying a STRONG positive signal — a
   * URL-path match or a title/heading match. The dispatcher enqueues
   * only these types when the set is non-empty, so a source document
   * is not built as every type the source happens to permit.
   */
  selected: ReadonlyArray<{ contentType: ContentTypeKey; score: number; reasons: string[] }>;
  /** Types the router refused to consider (with the reason). */
  rejected: ReadonlyArray<{ contentType: ContentTypeKey; reason: string }>;
};

/**
 * Minimum score for a content type to count as "strongly signalled".
 * A URL-pattern match or a title/heading match each contribute +2, so
 * the threshold of 2 requires at least one of those — metadata alone
 * (+1) is too weak to queue a builder on.
 */
const STRONG_SIGNAL_THRESHOLD = 2;

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

/**
 * Hard negative signals from spec #4 + #6: the router rejects a
 * candidate content type outright when any of these match the URL or
 * title. Livestream / event / bulletin / staff / donation / school /
 * Mass schedule / news / press / podcast / blog / newsletter /
 * registration / video / webinar content can never become valid
 * Catholic content packages — bad URL → no build attempt.
 */
const NEGATIVE_HINTS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /\blivestream\b/i, label: "livestream" },
  { pattern: /\bwatch\s+live\b/i, label: "watch_live" },
  { pattern: /\bbulletin\b/i, label: "bulletin" },
  { pattern: /\bstaff\s+page\b/i, label: "staff_page" },
  { pattern: /\bour\s+staff\b/i, label: "staff_page" },
  { pattern: /\bdonate\b|\bdonation\s+page\b|\bgive\s+now\b/i, label: "donation_page" },
  { pattern: /\bschool\s+page\b|\bcatholic\s+school\b/i, label: "school_page" },
  { pattern: /\bevent\s+registration\b|\bregister\s+now\b/i, label: "event_registration" },
  { pattern: /\b(?:online\s+)?event\b/i, label: "event" },
  { pattern: /\bmass\s+schedule\b|\bmass\s+times\b/i, label: "mass_schedule" },
  { pattern: /\bschedule\b/i, label: "schedule" },
  { pattern: /\bnews\s+article\b|\bnews\s+story\b/i, label: "news_article" },
  { pattern: /\bpress\s+release\b/i, label: "press_release" },
  { pattern: /\bnewsletter\b/i, label: "newsletter" },
  { pattern: /\bpodcast\s+episode\b|\bepisode\s+\d+\b/i, label: "podcast_episode" },
  { pattern: /\bblog\s+post\b/i, label: "unrelated_blog_post" },
  { pattern: /\bwebinar\b/i, label: "webinar" },
  { pattern: /\bbreaking\s+news\b/i, label: "breaking_news" },
  // URL-path shapes for article / blog / news / event / livestream /
  // podcast / video / webinar / press / donate / register / newsletter /
  // tag / category / author feeds. Even when title or headings look
  // promising, a /articles/, /blog/, /news/, /events/ URL is a news
  // or blog page — never a content package. These match against the
  // URL only (since the title regexes above already cover the words
  // when they appear in <title>).
  { pattern: /\/articles?(?:\/|$|-)/i, label: "article" },
  { pattern: /\/blog(?:\/|$|-)/i, label: "unrelated_blog_post" },
  { pattern: /\/news(?:\/|$|-)/i, label: "news" },
  { pattern: /\/events?(?:\/|$|-)/i, label: "event" },
  { pattern: /\/calendar(?:\/|$|-)/i, label: "calendar" },
  { pattern: /\/livestreams?(?:\/|$|-)/i, label: "livestream" },
  { pattern: /\/live-streams?(?:\/|$|-)/i, label: "livestream" },
  { pattern: /\/watch-live(?:\/|$|-)/i, label: "watch_live" },
  { pattern: /\/podcasts?(?:\/|$|-)/i, label: "podcast" },
  { pattern: /\/videos?(?:\/|$|-)/i, label: "video" },
  { pattern: /\/webinar(?:\/|$|-)/i, label: "webinar" },
  { pattern: /\/press(?:-releases?)?(?:\/|$|-)/i, label: "press" },
  { pattern: /\/donate(?:\/|$|-)/i, label: "donate" },
  { pattern: /\/donations?(?:\/|$|-)/i, label: "donations" },
  { pattern: /\/register(?:\/|$|-)/i, label: "register" },
  { pattern: /\/registration(?:\/|$|-)/i, label: "registration" },
  { pattern: /\/newsletters?(?:\/|$|-)/i, label: "newsletter" },
  { pattern: /\/subscribe(?:\/|$|-)/i, label: "subscribe" },
  { pattern: /\/tag(?:\/|$|-)/i, label: "tag_index" },
  { pattern: /\/tags(?:\/|$|-)/i, label: "tag_index" },
  { pattern: /\/category(?:\/|$|-)/i, label: "category_index" },
  { pattern: /\/categories(?:\/|$|-)/i, label: "category_index" },
  { pattern: /\/author(?:\/|$|-)/i, label: "author_index" },
  { pattern: /\/store(?:\/|$|-)/i, label: "store" },
  { pattern: /\/shop(?:\/|$|-)/i, label: "shop" },
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
  // bulletins, schedules, staff/donation/school pages, press
  // releases, podcasts, blog posts can never become valid Catholic
  // content packages even if the URL/title looks promising. We
  // surface the matched label so router diagnostics can show why a
  // candidate was rejected.
  const negHit = NEGATIVE_HINTS.find(({ pattern }) => pattern.test(title) || pattern.test(url));
  if (negHit) {
    reasons.push(`negative_hint:${negHit.label}`);
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
  const selected = ranked.filter((r) => r.score >= STRONG_SIGNAL_THRESHOLD);
  return { ranked, selected, rejected };
}
