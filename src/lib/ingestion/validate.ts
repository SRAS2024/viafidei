/**
 * LEGACY (Section 6 deprecation marker).
 *
 * This module is the pre-strict-QA validator. It still ships because
 * `sanitize()` is reused by the runner's pre-processing step, and
 * because `validateItem()` is referenced by `strict-qa-bridge.ts` as
 * a structural sanity check before the strict pipeline runs.
 *
 * It must NOT be the authoritative validator. Production validity is
 * enforced by `src/lib/content-qa/pipeline.ts` (runStrictPipeline +
 * per-contract validators). Any new code path that needs to "validate
 * content" should import from `@/lib/content-qa`, NOT from here.
 *
 * Audit: this file is allowed to remain in the tree, but its export
 * surface is frozen — no new public symbols, no new responsibilities.
 * Section 6 removal will follow once the runner has been refactored
 * to depend on `sanitize` exclusively (and not `validateItem`).
 */

import type { IngestedItem } from "./types";
import { normalizeSlug } from "./slug";
import { isApprovedUrl } from "./sources/vatican-allowlist";

const ORIGIN_URL_RE = /^(https?:\/\/|mailto:)/i;

/**
 * Tables that are protected from any ingestion write. These are user-generated
 * tables (journals, goals, milestones, saved items, profile data). The
 * ingestion runner must never persist into these tables; the assertion guards
 * against accidental misuse if a new adapter is added that broadens the
 * `kind` union without also extending the persistence layer.
 */
const PROTECTED_USER_KINDS: ReadonlySet<string> = new Set([
  "journal",
  "journalEntry",
  "goal",
  "milestone",
  "userSavedPrayer",
  "userSavedSaint",
  "userSavedApparition",
  "userSavedParish",
  "userSavedDevotion",
  "profile",
  "user",
]);

/**
 * Phrases that almost always mean a scraped page is a navigation, listing,
 * source-summary, broadcast schedule, or newsletter rather than real
 * devotional content. Any item whose title or body matches one of these
 * is rejected before it can land in a content table.
 */
const NON_CONTENT_PHRASES: ReadonlyArray<RegExp> = [
  // Generic site / source descriptions.
  /\b(catholic\s+australia|catholic\s+answers|catholic\s+culture|catholic\s+news\s+agency|catholic\s+world\s+report|word\s+on\s+fire|ascension\s+press|the\s+catholic\s+thing|ewtn)\s*(,|\.|-|—|is)\s*(a\s+(work|service|publication|website|programme|program|ministry|apostolate)|an?\s+(initiative|outreach))/i,
  /\bcatholic\s+bishops\s+conference\b.*\b(website|publication|directory)\b/i,
  /\ba\s+work\s+of\s+the\s+(australian|us|usccb|cccb)\b/i,
  /\b(catholic\s+answers|ewtn|word\s+on\s+fire)\s+is\s+a\s+(media|catholic|global)\b/i,
  // TV / radio / livestream descriptions.
  /\b(ewtn\s+(live|television|radio|tv|programming|broadcast)|live\s+stream(?:ed)?|broadcast\s+schedule|on\s+demand|episode\s+\d+|series\s+overview|television\s+programs?|tv\s+programs?)\b/i,
  /\b(daily\s+mass\s+broadcast|catholic\s+television|radio\s+ministry)\b/i,
  // Newsletter / subscribe / event-listing copy.
  /\b(subscribe\s+to\s+our\s+(newsletter|email|mailing)|sign\s+up\s+for\s+(our\s+)?(newsletter|updates)|monthly\s+newsletter|weekly\s+newsletter|our\s+(newsletter|e-?mail\s+list))\b/i,
  /\b(event\s+listings?|upcoming\s+events|schedule\s+of\s+events|conference\s+registration|register\s+(now|today)|tickets\s+available)\b/i,
  // Donation appeals & shop pages.
  /\b(donate\s+(now|today)|make\s+a\s+donation|donation\s+appeal|gift\s+shop|online\s+store|catholic\s+bookstore|order\s+(now|today)|add\s+to\s+cart)\b/i,
  // Generic page furniture.
  /\b(404\s+not\s+found|page\s+not\s+found|access\s+denied|cookies?\s+policy|privacy\s+policy|terms\s+of\s+(use|service)|site\s*map|breadcrumb)\b/i,
  // Bare article / blog-post stubs.
  /\b(continue\s+reading|read\s+more|click\s+here\s+to\s+(read|learn)|the\s+article\s+(continues|appears)|excerpt\s+from)\b/i,
  // Browser / accessibility / CMS chrome that snuck into the body.
  /\b(skip\s+to\s+(main\s+)?content|accessibility\s+(feedback|menu|tools)|toggle\s+(menu|navigation))\b/i,
  /\b(latest\s+content|featured\s+content|read,?\s*listen,?\s*or\s*watch)\b/i,
  /\b(honest\s+answers\s+to\s+questions|questions\s+about\s+catholic\s+faith\s+&\s+beliefs)\b/i,
];

/**
 * Title patterns that almost always indicate a brand landing / index /
 * navigation page rather than a single piece of devotional content.
 * Used to reject pages like:
 *   "Catholic Prayers - Prayer to Jesus, Marian, & More | EWTN"
 *   "Catholic Faith, Beliefs, & Prayers | Catholic Answers"
 *   "Prayers and Devotions | USCCB"
 * These are aggregator pages and have no place in a single-prayer or
 * single-saint row.
 */
const LANDING_PAGE_TITLE_PATTERNS: ReadonlyArray<RegExp> = [
  // Anything containing "& More" before a brand suffix is an index page.
  /\b&\s*more\b/i,
  // "Catholic Faith, Beliefs, & Prayers" — generic plural enumeration.
  /\bcatholic\s+(faith|beliefs|teachings?)\s*[,&]/i,
  // "Catholic Prayers - X to Y, Z" — list page.
  /\b(catholic\s+)?prayers?\s*[-–:]\s*prayer\s+(to|for)\b.*[,&]/i,
  // Bare plural categories with a brand suffix: "Catholic Prayers | EWTN".
  /^(catholic\s+)?(prayers?|devotions?|saints?|sacraments?|novenas?|litanies?)\s*\|\s*\w/i,
  // "Prayers and Devotions" style enumerations.
  /^(prayers?|devotions?|saints?)\s+and\s+(prayers?|devotions?|saints?|sacraments?)/i,
  // "Index of …" / "Directory of …" / "List of …" pages.
  /^(index|directory|list|catalog|catalogue|collection)\s+of\s+/i,
  // "Top N …", "All Catholic …", "Best Catholic …".
  /^(top\s+\d+|all\s+(catholic\s+)?(prayers?|saints?|devotions?)|best\s+catholic\s+)/i,
];

/**
 * Body openers that almost always mean the page is a meta-description
 * about the content type rather than an actual instance of that
 * content type. A prayer body that starts with "Devotions are
 * manifestations of our profound love…" is talking *about* devotion,
 * it is not itself a prayer. Reject those.
 */
const META_DESCRIPTION_OPENERS: ReadonlyArray<RegExp> = [
  /^\s*(devotions?|prayers?|the\s+rosary|the\s+(hail\s+mary|our\s+father|memorare))\s+(are|is|was|were)\s+/i,
  /^\s*(catholic\s+answers|ewtn|word\s+on\s+fire|catholic\s+culture|usccb|cccb)\s+(is|was)\s+(a|an|the)\s+/i,
  /^\s*(this|here)\s+is\s+(a|an)\s+(collection|list|index|directory)\s+of\b/i,
  /^\s*(below|here)\s+(you\s+will\s+find|are)\s+/i,
  /^\s*(a|the)\s+(prayer|devotion|practice)\s+(is|was)\s+(a|an|the)\s+/i,
  /^\s*(skip\s+to\s+(main\s+)?content|accessibility\s+feedback|latest\s+content)/i,
];

/**
 * Returns true when the title matches a known landing-page pattern.
 * Landing pages are aggregator URLs, not individual content rows.
 */
export function looksLikeLandingPage(title: string): boolean {
  if (typeof title !== "string") return false;
  return LANDING_PAGE_TITLE_PATTERNS.some((re) => re.test(title));
}

/**
 * Returns true when the body opens with meta-description language —
 * i.e. it describes the *category* of content rather than being a
 * single instance of it.
 */
export function looksLikeMetaDescription(body: string): boolean {
  if (typeof body !== "string") return false;
  return META_DESCRIPTION_OPENERS.some((re) => re.test(body));
}

function nonEmpty(value: string | undefined | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Returns true when the given haystack reads like navigation, a source
 * summary, or broadcast copy rather than real Catholic content. Used to
 * keep "EWTN is a Catholic television network." style blurbs out of the
 * prayer, saint, and devotion tables.
 */
export function looksLikeNonContent(haystack: string): boolean {
  return NON_CONTENT_PHRASES.some((re) => re.test(haystack));
}

const KNOWN_PRAYER_CATEGORIES: ReadonlySet<string> = new Set([
  "Marian",
  "Christ",
  "Christological",
  "Angelic",
  "Sacramental",
  "Seasonal",
  "Daily",
  "Dominical",
  "Eucharistic",
  "Trinitarian",
  "Pneumatological",
  "Theological Virtue",
  "Liturgical",
  "Litany",
  "Rosary",
  "Chaplet",
  "Novena",
  "Devotional",
  "Penitential",
  "Creedal",
  "Traditional",
]);

const PRAYER_INSTRUCTION_MARKERS: ReadonlyArray<RegExp> = [
  // Closing word.
  /\bamen\b/i,
  // Direct address of God / the saints.
  /\b(o\s+lord|o\s+god|o\s+jesus|o\s+holy|o\s+mary|o\s+father|o\s+sacred|hail\b|blessed\b|lord\s+have\s+mercy|kyrie|sancte|sanctus|jesus\s+christ|christ\s+have\s+mercy)\b/i,
  // Petition / praise verbs.
  /\b(pray|grant|hear|have\s+mercy|deliver\s+us|hallowed|glory\s+be|we\s+beseech|veni|magnificat|deo\s+gratias|sanctify|save\s+me|preserve\s+us|protect\s+us|come\s+holy)\b/i,
  // Liturgical / catechetical first-person formulas.
  /\b(let\s+us\s+pray|in\s+the\s+name\s+of\s+the\s+father|i\s+(believe|confess|adore|offer|thank|love)|we\s+(believe|confess|adore|thank))\b/i,
  // Anima-Christi / Marian-antiphon style direct invocations.
  /\b((soul|body|blood|water|passion|heart)\s+of\s+christ|mother\s+of\s+(god|mercy)|queen\s+of\s+heaven|king\s+of\s+kings)\b/i,
];

function looksLikePrayer(body: string): boolean {
  return PRAYER_INSTRUCTION_MARKERS.some((re) => re.test(body));
}

function validatePrayer(item: IngestedItem & { kind: "prayer" }): string | null {
  if (!nonEmpty(item.slug)) return "Prayer slug is required";
  if (!nonEmpty(item.defaultTitle)) return "Prayer defaultTitle is required";
  if (!nonEmpty(item.category)) return "Prayer category is required";
  if (!nonEmpty(item.body)) return "Prayer body is required";
  // A real prayer carries more than a single-sentence summary; we keep
  // the lower bound conservative so legitimate brief prayers
  // (Sign of the Cross, the Glory Be) still pass.
  if (item.body.trim().length < 40) return "Prayer body looks too short";
  // Landing / aggregator pages with a brand suffix and "& More" are
  // never single prayers. Reject outright so the janitor hard-deletes.
  if (looksLikeLandingPage(item.defaultTitle)) {
    return "Prayer title looks like a landing or index page, not a single prayer";
  }
  // Body that opens with "Devotions are manifestations of…" or "Skip
  // to main content" is describing the category, not BEING a prayer.
  if (looksLikeMetaDescription(item.body)) {
    return "Prayer body reads as meta-description or navigation cruft, not an actual prayer";
  }
  // The title must not look like a source byline ("Catholic Australia,
  // a work of the Australian Catholic Bishops Conference") or program
  // listing.
  if (looksLikeNonContent(item.defaultTitle) || looksLikeNonContent(item.body)) {
    return "Prayer looks like a source summary / navigation page, not a real prayer";
  }
  // A page that says nothing but "Catholic Australia, a work of the
  // Australian Catholic Bishops Conference." should never reach the
  // Prayers table. Require at least one prayer-marker word (Amen,
  // O Lord, Hail, Glory be, "let us pray", etc.).
  if (!looksLikePrayer(item.body)) {
    return "Prayer body does not contain any recognisable prayer language";
  }
  // Loose schema: keep ingestion-supplied categories that match the
  // recognised set, but accept anything truthy for backward compatibility
  // with legacy seeds.
  if (item.category.length > 64) return "Prayer category looks unusable";
  return null;
}

const SAINT_BIOGRAPHY_MARKERS: ReadonlyArray<RegExp> = [
  /\b(saint|st\.?|blessed|bl\.?|venerable|martyr|virgin|priest|monk|nun|abbot|bishop|pope|doctor\s+of\s+the\s+church)\b/i,
  /\b(born|died|canon(ized|ised)|beatif(ied|ication)|feast\s+day|patron(ess)?\s+(of|saint))\b/i,
  /\b(century|in\s+\d{3,4}|\d{3,4}\s*(AD|BC|CE))\b/i,
];

function looksLikeSaintBiography(text: string): boolean {
  return SAINT_BIOGRAPHY_MARKERS.some((re) => re.test(text));
}

function validateSaint(item: IngestedItem & { kind: "saint" }): string | null {
  if (!nonEmpty(item.slug)) return "Saint slug is required";
  if (!nonEmpty(item.canonicalName)) return "Saint canonicalName is required";
  if (!nonEmpty(item.biography)) return "Saint biography is required";
  // Saint cards in the catalog need enough body to give "a well-rounded
  // sense of the saint's life" — reject one-line stubs.
  if (item.biography.trim().length < 80) return "Saint biography looks too short";
  if (looksLikeLandingPage(item.canonicalName)) {
    return "Saint name looks like a landing or index page, not an individual saint";
  }
  if (looksLikeMetaDescription(item.biography)) {
    return "Saint biography reads as meta-description or navigation cruft";
  }
  if (looksLikeNonContent(item.canonicalName) || looksLikeNonContent(item.biography)) {
    return "Saint looks like a TV program listing / source summary";
  }
  // The biography has to actually talk about a holy person. Pages whose
  // body is just "EWTN is the global Catholic Network" should not land in
  // the Saint table.
  if (!looksLikeSaintBiography(item.biography)) {
    return "Saint biography does not read like a saint biography";
  }
  // canonicalName must contain the saint's name; a generic title like
  // "Catholic Saints" or "Patron Saints" is a navigation page, not a
  // saint.
  if (
    /^(catholic\s+saints?|patron\s+saints?|saints?\s+(directory|list|index))/i.test(
      item.canonicalName,
    )
  ) {
    return "Saint canonicalName looks like a directory page";
  }
  return null;
}

const APPARITION_APPROVED_STATUSES: ReadonlySet<string> = new Set([
  "Approved",
  "Constat de supernaturalitate",
  "Non constat de supernaturalitate",
  "Constat de non supernaturalitate",
  "Worthy of belief",
  "Devotional approval",
  "Pending",
  "Under investigation",
  "Not approved",
]);

function validateApparition(item: IngestedItem & { kind: "apparition" }): string | null {
  if (!nonEmpty(item.slug)) return "Apparition slug is required";
  if (!nonEmpty(item.title)) return "Apparition title is required";
  if (!nonEmpty(item.summary)) return "Apparition summary is required";
  if (!nonEmpty(item.approvedStatus)) return "Apparition approvedStatus is required";
  if (item.summary.trim().length < 60) return "Apparition summary looks too short";
  if (looksLikeLandingPage(item.title)) {
    return "Apparition title looks like a landing or index page";
  }
  if (looksLikeMetaDescription(item.summary)) {
    return "Apparition summary reads as meta-description or navigation cruft";
  }
  if (looksLikeNonContent(item.title) || looksLikeNonContent(item.summary)) {
    return "Apparition looks like a source summary / page navigation";
  }
  // The summary should mention the apparition's particulars — Mary, Our
  // Lady, the Blessed Virgin, an appearance / vision, or the name of
  // the seer.
  if (
    !/\b(mary|our\s+lady|blessed\s+virgin|virgin|madonna|theotokos|nuestra\s+señora|notre\s+dame|appear(ed|ance)|apparition|vision)\b/i.test(
      item.summary,
    )
  ) {
    return "Apparition summary does not reference Marian apparition language";
  }
  if (!APPARITION_APPROVED_STATUSES.has(item.approvedStatus.trim())) {
    return `Apparition approvedStatus '${item.approvedStatus}' is not a recognised canonical status`;
  }
  return null;
}

function validateParish(item: IngestedItem & { kind: "parish" }): string | null {
  if (!nonEmpty(item.slug)) return "Parish slug is required";
  if (!nonEmpty(item.name)) return "Parish name is required";
  if (item.name.trim().length < 3) return "Parish name looks too short";
  if (
    /baptist|methodist|lutheran|presbyterian|orthodox|anglican|episcopal|protestant|mosque|synagogue|temple|hindu|buddhist/i.test(
      item.name,
    )
  ) {
    return "Parish name suggests a non-Catholic place of worship";
  }
  if (/^(find|search|locate|browse|all)\s+(a\s+)?paris/i.test(item.name)) {
    return "Parish name looks like a navigation page";
  }
  if (/locator|directory|listing/i.test(item.name) && item.name.split(/\s+/).length <= 3) {
    return "Parish name looks like a directory page";
  }
  if (item.websiteUrl && !ORIGIN_URL_RE.test(item.websiteUrl)) {
    return "Parish websiteUrl must start with http(s):// or mailto:";
  }
  if (item.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)) {
    return "Parish email is malformed";
  }
  return null;
}

const DEVOTION_MARKERS: ReadonlyArray<RegExp> = [
  /\b(devotion|rosary|novena|chaplet|consecration|adoration|holy\s+hour|stations\s+of\s+the\s+cross|via\s+crucis|first\s+(friday|saturday)|scapular|brown\s+scapular|miraculous\s+medal)\b/i,
  /\b(prayer|prayers|meditation|pray)\b/i,
];

function validateDevotion(item: IngestedItem & { kind: "devotion" }): string | null {
  if (!nonEmpty(item.slug)) return "Devotion slug is required";
  if (!nonEmpty(item.title)) return "Devotion title is required";
  if (!nonEmpty(item.summary)) return "Devotion summary is required";
  if (item.summary.trim().length < 40) return "Devotion summary looks too short";
  if (item.durationMinutes !== undefined && item.durationMinutes <= 0) {
    return "Devotion durationMinutes must be positive";
  }
  if (looksLikeLandingPage(item.title)) {
    return "Devotion title looks like a landing or index page";
  }
  if (looksLikeMetaDescription(item.summary)) {
    return "Devotion summary reads as meta-description or navigation cruft";
  }
  if (looksLikeNonContent(item.title) || looksLikeNonContent(item.summary)) {
    return "Devotion looks like a source summary / broadcast description";
  }
  // The summary needs to talk about a devotional practice; otherwise we
  // are simply absorbing a generic Catholic-website blurb.
  if (!DEVOTION_MARKERS.some((re) => re.test(`${item.title} ${item.summary}`))) {
    return "Devotion does not look like a Catholic devotional practice";
  }
  return null;
}

const LITURGY_KINDS = new Set([
  "MASS_STRUCTURE",
  "LITURGICAL_YEAR",
  "SYMBOLISM",
  "MARRIAGE_RITE",
  "FUNERAL_RITE",
  "ORDINATION_RITE",
  "COUNCIL_TIMELINE",
  "GLOSSARY",
  "GENERAL",
]);

function validateLiturgy(item: IngestedItem & { kind: "liturgy" }): string | null {
  if (!nonEmpty(item.slug)) return "Liturgy slug is required";
  if (!nonEmpty(item.title)) return "Liturgy title is required";
  if (!nonEmpty(item.body)) return "Liturgy body is required";
  if (item.body.length < 80) return "Liturgy body looks too short";
  if (!LITURGY_KINDS.has(item.liturgyKind)) {
    return `Liturgy kind '${item.liturgyKind}' is not a recognised LiturgyKind`;
  }
  if (looksLikeLandingPage(item.title)) {
    return "Liturgy entry title looks like a landing or index page";
  }
  if (looksLikeMetaDescription(item.body)) {
    return "Liturgy entry body reads as meta-description or navigation cruft";
  }
  if (looksLikeNonContent(item.title) || looksLikeNonContent(item.body)) {
    return "Liturgy entry looks like a source summary / TV program listing";
  }
  return null;
}

const GUIDE_KINDS = new Set([
  "ROSARY",
  "CONFESSION",
  "ADORATION",
  "DEVOTION",
  "CONSECRATION",
  "VOCATION",
  "GENERAL",
]);

function validateGuide(item: IngestedItem & { kind: "guide" }): string | null {
  if (!nonEmpty(item.slug)) return "Guide slug is required";
  if (!nonEmpty(item.title)) return "Guide title is required";
  if (!nonEmpty(item.summary)) return "Guide summary is required";
  if (item.summary.length < 40) return "Guide summary looks too short";
  if (!GUIDE_KINDS.has(item.guideKind)) {
    return `Guide kind '${item.guideKind}' is not a recognised SpiritualLifeKind`;
  }
  if (looksLikeLandingPage(item.title)) {
    return "Guide title looks like a landing or index page";
  }
  if (looksLikeMetaDescription(item.summary)) {
    return "Guide summary reads as meta-description or navigation cruft";
  }
  if (looksLikeNonContent(item.title) || looksLikeNonContent(item.summary)) {
    return "Guide looks like a source summary / broadcast description";
  }
  if (item.steps && item.steps.length > 0) {
    for (const s of item.steps) {
      if (!nonEmpty(s.title)) return "Guide step title is required";
      if (!nonEmpty(s.body)) return "Guide step body is required";
    }
  }
  if (item.durationDays !== undefined && item.durationDays <= 0) {
    return "Guide durationDays must be positive";
  }
  return null;
}

function validateExternalSourceKey(item: IngestedItem): string | null {
  const key = item.externalSourceKey;
  if (!key) return null;
  // External keys are URLs in the autofill pipeline; if so, the host MUST be
  // Vatican-approved. Non-URL keys (e.g. legacy seed identifiers) are passed
  // through.
  if (/^https?:\/\//i.test(key) && !isApprovedUrl(key)) {
    return `externalSourceKey '${key}' is not from a Vatican-approved host`;
  }
  return null;
}

export function validateItem(item: IngestedItem): string | null {
  // Guard rail: ingestion must never touch user-generated content tables.
  // If a future adapter is mistakenly tagged with a user-facing kind, this
  // check rejects the item before it can reach persistence.
  if (PROTECTED_USER_KINDS.has((item as { kind: string }).kind)) {
    return `kind '${(item as { kind: string }).kind}' is protected user-generated content and must not be ingested`;
  }
  const sourceError = validateExternalSourceKey(item);
  if (sourceError) return sourceError;
  switch (item.kind) {
    case "prayer":
      return validatePrayer(item);
    case "saint":
      return validateSaint(item);
    case "apparition":
      return validateApparition(item);
    case "parish":
      return validateParish(item);
    case "devotion":
      return validateDevotion(item);
    case "liturgy":
      return validateLiturgy(item);
    case "guide":
      return validateGuide(item);
  }
}

/**
 * Severity of a validation failure:
 *
 *   • `"noise"` — the item is clearly navigation cruft, a brand
 *     landing page, or a meta-description about a content category.
 *     These never have any place in the catalog; the runner hard-
 *     deletes them with no archive or review entry.
 *   • `"hard"` — structurally invalid: missing required fields,
 *     protected kind, or off-allowlist source. Also dropped.
 *   • `"soft"` — passes structural checks but trips one of the
 *     lexical category heuristics (a "prayer" body without
 *     prayer-language markers, a "saint" biography missing
 *     biographical vocabulary, an "apparition" summary missing
 *     Marian vocabulary, body too short, etc.). The runner writes
 *     these to the database with `status = REVIEW` so a moderator
 *     can decide whether to publish or archive — these are the
 *     "imperfect but possibly real" rows worth keeping.
 *
 * Splitting validation into noise / hard / soft severities lets the
 * pipeline:
 *   - aggressively delete clearly-non-content items (noise),
 *   - refuse structurally-impossible items (hard),
 *   - and preserve borderline real content (soft).
 */
export type ValidationSeverity = "noise" | "hard" | "soft";

/**
 * Reasons that mean "this isn't real content; delete it". Matches the
 * messages produced by `looksLikeLandingPage()`,
 * `looksLikeMetaDescription()`, and the broader `looksLikeNonContent()`
 * detectors when they fire on titles or bodies.
 */
const NOISE_REASON_RE =
  /(landing or index page|meta-description|navigation cruft|TV program listing|source summary|page navigation|broadcast description|directory page|index page)/i;

const SOFT_REASON_RE =
  /(prayer language|biography does not read|Marian apparition language|Catholic devotional|too short|looks too short|biography looks too short|prayer body looks too short|summary looks too short|apparition summary looks too short|devotion summary looks too short|liturgy body looks too short|guide summary looks too short)/i;

const HARD_REASON_RE =
  /(slug is required|required|protected user-generated|not from a Vatican-approved host|non-Catholic|websiteUrl|email is malformed|not a recognised|canonical status|approvedStatus|durationMinutes|durationDays)/i;

/**
 * Classify a validation failure reason. Order matters: a reason that
 * mentions both "looks like" and "too short" should be classified as
 * noise (the looks-like check fires first in the validators), so the
 * NOISE pattern is tried first.
 */
export function classifySeverity(reason: string): ValidationSeverity {
  if (NOISE_REASON_RE.test(reason)) return "noise";
  if (HARD_REASON_RE.test(reason)) return "hard";
  if (SOFT_REASON_RE.test(reason)) return "soft";
  return "hard";
}

/**
 * Returns a copy of `items` partitioned into four buckets:
 *   • `valid`    — passes every check; safe to persist.
 *   • `review`   — passes the structural checks but fails a category
 *                  heuristic. Persisted with `status = REVIEW` so a
 *                  moderator can publish or archive. These are the
 *                  "imperfect but possibly real" rows worth keeping.
 *   • `noise`    — clearly non-content (landing pages, navigation
 *                  cruft, meta-descriptions). The runner hard-deletes
 *                  these with no review entry. They never had any
 *                  place in the catalog.
 *   • `rejected` — structurally invalid (missing required field,
 *                  off-allowlist source, protected kind). Refused
 *                  before persistence.
 *
 * Slugs are normalized on every item before the validator runs.
 */
export function sanitize(items: IngestedItem[]): {
  valid: IngestedItem[];
  review: Array<{ item: IngestedItem; reason: string }>;
  noise: Array<{ item: IngestedItem; reason: string }>;
  rejected: Array<{ item: IngestedItem; reason: string }>;
} {
  const valid: IngestedItem[] = [];
  const review: Array<{ item: IngestedItem; reason: string }> = [];
  const noise: Array<{ item: IngestedItem; reason: string }> = [];
  const rejected: Array<{ item: IngestedItem; reason: string }> = [];
  for (const item of items) {
    const normalized = { ...item, slug: normalizeSlug(item.slug) };
    const reason = validateItem(normalized);
    if (!reason) {
      valid.push(normalized);
      continue;
    }
    const severity = classifySeverity(reason);
    if (severity === "soft") {
      review.push({ item: normalized, reason });
    } else if (severity === "noise") {
      noise.push({ item: normalized, reason });
    } else {
      rejected.push({ item, reason });
    }
  }
  return { valid, review, noise, rejected };
}

export { KNOWN_PRAYER_CATEGORIES };
