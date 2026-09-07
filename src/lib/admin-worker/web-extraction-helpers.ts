/**
 * Pure helpers for the web-extraction pipeline stages in dispatcher.ts
 * (fetch → read → extract → verify → QA → publish). Everything here is
 * deterministic and side-effect free so each rule can be pinned by a unit
 * test without a fake Prisma client.
 *
 * Why these exist (audit findings WX-03 / WX-06 / WX-09 / WX-14 / PR-04 /
 * PR-15):
 *   - a raw `<title>` ("St. Francis of Assisi - Saints & Angels - Catholic
 *     Online") was used verbatim as the entity name, the published title AND
 *     the slug, so cross-source verification never found the entity on an
 *     independent page and two sources for one entity produced two slugs;
 *   - PDF sources have no `<title>` at all, so every PDF collapsed into one
 *     "Untitled" artifact;
 *   - any fetch failure (timeout / 429 / 5xx / a dropped Wi-Fi) permanently
 *     REJECTED the candidate;
 *   - web-published prayers carried raw extractor fields (no body / slug /
 *     citations / canonical category) and no page language.
 */

import type { Prisma, PrismaClient } from "@prisma/client";

import { validatePayload } from "@/lib/checklist/schemas";
import { categorizePrayer } from "@/lib/content-shared/prayer-categories";

// ── Titles ─────────────────────────────────────────────────────────────

/** Trailing/leading `<title>` segments that name the SITE, not the entity. */
const GENERIC_SITE_SEGMENTS: ReadonlySet<string> = new Set([
  "home",
  "homepage",
  "home page",
  "official website",
  "official site",
  "catholic online",
  "saints & angels",
  "saints and angels",
  "saints",
  "prayers",
  "prayer",
  "news",
  "blog",
  "articles",
  "ewtn",
  "usccb",
  "vatican",
  "vatican.va",
  "the holy see",
  "holy see",
  "new advent",
  "catholic encyclopedia",
  "catholic culture",
  "franciscan media",
  "aleteia",
  "catholic answers",
  "catholic news agency",
  "national catholic register",
  "loyola press",
  "my catholic life!",
  "my catholic life",
  "catholic.org",
  "wikipedia",
  "wikipedia, the free encyclopedia",
]);

const TITLE_SEPARATOR = /\s+(?:\||–|—|::|»|«|›|‹|-)\s+/;

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));
}

/** Host tokens ("catholicculture.org" → ["catholicculture", "catholic culture"]). */
function hostTokens(host: string | null | undefined): string[] {
  if (!host) return [];
  const parts = host
    .toLowerCase()
    .replace(/^www\d*\./, "")
    .split(".")
    .filter((p) => p.length >= 4 && !["www", "com", "org", "net", "info", "edu"].includes(p));
  const out: string[] = [];
  for (const p of parts) {
    out.push(p);
    // "catholicculture" also appears as "catholic culture" in titles.
    const spaced = p.replace(/catholic/, "catholic ").trim();
    if (spaced !== p) out.push(spaced);
  }
  return out;
}

function isSiteSegment(segment: string, host: string | null | undefined): boolean {
  const s = segment.toLowerCase().trim();
  if (!s) return true;
  if (GENERIC_SITE_SEGMENTS.has(s)) return true;
  if (/\.(org|com|net|va|edu|info)\b/.test(s)) return true;
  return hostTokens(host).some((t) => s === t || s.includes(t));
}

/**
 * Clean a page `<title>` down to the entity it names: drop the site-name /
 * section segments a site appends ("… | Catholic Culture", "… - Saints &
 * Angels - Catholic Online", "Home » …"). Segments are only dropped while at
 * least one remains, so a title that is nothing but a site name is returned
 * as-is rather than emptied. Returns null for an empty title.
 */
export function cleanSourceTitle(
  raw: string | null | undefined,
  host?: string | null,
): string | null {
  if (!raw) return null;
  const text = decodeEntities(raw)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  let segments = text
    .split(TITLE_SEPARATOR)
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return null;
  // Trailing site/section segments first ("Entity - Section - Site").
  while (segments.length >= 2 && isSiteSegment(segments[segments.length - 1], host)) {
    segments = segments.slice(0, -1);
  }
  // A leading site name ("Catholic Online - Entity", "Home » Saints » Entity").
  while (segments.length >= 2 && isSiteSegment(segments[0], host)) {
    segments = segments.slice(1);
  }
  const cleaned = segments.join(" - ").trim();
  return cleaned || null;
}

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

function titleCaseWord(w: string): string {
  return w ? w[0].toUpperCase() + w.slice(1) : w;
}

/**
 * A title derived from the URL path ("/documents/rerum-novarum.pdf" → "Rerum
 * Novarum"). Skips index-style and numeric-only segments; null when nothing
 * usable remains.
 */
export function titleFromUrlPath(url: string): string | null {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(url).pathname);
  } catch {
    return null;
  }
  const segments = pathname.split("/").filter(Boolean).reverse();
  for (const seg of segments) {
    const base = seg.replace(/\.(pdf|html?|php|aspx?|jsp)$/i, "");
    if (/^(index|default|home)$/i.test(base)) continue;
    const words = base
      .replace(/[_+\-.]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean);
    const letters = words.join("").replace(/[^a-z]/gi, "").length;
    if (letters < 3) continue;
    return words.map((w) => titleCaseWord(w.toLowerCase())).join(" ");
  }
  return null;
}

/**
 * First heading-like line of an extracted text body: short, mostly letters,
 * not a sentence. Used for PDFs, whose text starts with the document title
 * far more often than not.
 */
function firstHeadingLine(text: string | null | undefined): string | null {
  if (!text) return null;
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 15);
  for (const line of lines) {
    if (line.length < 4 || line.length > 140) continue;
    const letters = line.replace(/[^a-z]/gi, "").length;
    if (letters < line.length * 0.5) continue;
    if (/[.;:]$/.test(line)) continue;
    if (/^(page|p\.)\s*\d+/i.test(line)) continue;
    return line;
  }
  return null;
}

/**
 * The best available document title for a fetched/read source: the cleaned
 * `<title>`, else (for PDFs / title-less bodies) the first heading-like line
 * of the text, else the URL path. Null only when every source is empty — the
 * caller must then refuse to package the read instead of inventing "Untitled"
 * (WX-14: one "Untitled" artifact swallowed every later PDF as a DUPLICATE).
 */
export function deriveDocumentTitle(input: {
  title?: string | null;
  url: string;
  bodyText?: string | null;
  host?: string | null;
}): string | null {
  const cleaned = cleanSourceTitle(input.title, input.host);
  if (cleaned) return cleaned;
  const heading = firstHeadingLine(input.bodyText);
  if (heading) return cleanSourceTitle(heading, input.host);
  return titleFromUrlPath(input.url);
}

export function looksLikePdf(url: string, contentType?: string | null): boolean {
  return /application\/pdf/i.test(contentType ?? "") || /\.pdf($|[?#])/i.test(url);
}

// ── Language ───────────────────────────────────────────────────────────

const STOPWORDS: Record<string, string[]> = {
  en: ["the", "and", "of", "to", "with", "our", "for", "is", "you"],
  es: ["el", "los", "las", "que", "por", "con", "para", "una", "nuestro", "señor"],
  la: ["et", "est", "qui", "nobis", "domine", "sancta", "tuum", "nostrum", "in", "cum"],
  it: ["il", "che", "per", "non", "della", "nostro", "signore", "sia"],
  fr: ["les", "des", "est", "nous", "vous", "notre", "seigneur", "pour"],
  pt: ["os", "do", "da", "não", "nós", "nosso", "senhor", "para"],
  de: ["der", "die", "und", "das", "nicht", "wir", "unser", "herr"],
  pl: ["nie", "jest", "się", "nasz", "panie", "który"],
};

/**
 * Deterministic page language: a language prefix in the URL path wins
 * (usccb.org/es/prayers/…); otherwise a stop-word vote over the first 3000
 * characters. English unless another language clearly dominates.
 */
export function detectReadLanguage(url: string, text: string | null | undefined): string {
  try {
    const path = new URL(url).pathname.toLowerCase();
    const m = /^\/(es|la|it|fr|pt|de|pl)(?:\/|$)/.exec(path);
    if (m) return m[1];
  } catch {
    // not a URL — fall through to the text vote
  }
  const sample = ` ${(text ?? "")
    .slice(0, 3000)
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, " ")} `;
  if (!sample.trim()) return "en";
  const scores: Record<string, number> = {};
  for (const [lang, words] of Object.entries(STOPWORDS)) {
    let n = 0;
    for (const w of words) {
      const re = new RegExp(`\\s${w}\\s`, "gu");
      n += (sample.match(re) ?? []).length;
    }
    scores[lang] = n;
  }
  let best = "en";
  for (const [lang, n] of Object.entries(scores)) {
    if (n > scores[best]) best = lang;
  }
  // Require a clear margin over English: English pages quote Latin/Spanish
  // titles all the time, and "en" must win every tie.
  if (best !== "en" && scores[best] >= 3 && scores[best] > scores.en * 1.5) return best;
  return "en";
}

// ── Fetch failure classification + retry backoff ───────────────────────

/** Fetcher error classes that describe the SOURCE, not the network. */
const PERMANENT_ERROR_CLASSES: ReadonlySet<string> = new Set([
  "INVALID_URL",
  "UNAPPROVED_HOST",
  "BINARY_REJECTED",
  "PDF_TOO_LARGE",
  "PDF_UNREADABLE",
  "PDF_READ_FAILED",
  "TOO_SMALL",
  "TOO_LARGE_NO_STRUCTURE",
  "LOGIN_PAGE",
]);

/** HTTP statuses that mean "try again later", not "this page is gone". */
const TRANSIENT_HTTP = new Set([408, 425, 429]);

export type FetchFailureKind = "permanent" | "transient";

/**
 * A fetch failure is PERMANENT when it is a verdict about the page (wrong
 * host, binary, login wall, too small, a 4xx other than 429) and TRANSIENT
 * otherwise (timeout / abort, network error, 429, 5xx, anything unknown).
 * Unknown errors default to transient because the cost of a bounded retry
 * is a few requests, while a wrong REJECT loses the source for good.
 */
export function classifyFetchFailure(input: {
  errorClass?: string | null;
  rejectionReason?: string | null;
  httpStatus?: number | null;
}): FetchFailureKind {
  if (input.errorClass && PERMANENT_ERROR_CLASSES.has(input.errorClass)) return "permanent";
  const status =
    typeof input.httpStatus === "number" && input.httpStatus > 0
      ? input.httpStatus
      : Number(/^HTTP (\d{3})\b/.exec(input.rejectionReason ?? "")?.[1] ?? 0);
  if (status >= 400 && status < 500) return TRANSIENT_HTTP.has(status) ? "transient" : "permanent";
  return "transient";
}

/** Transient failures a candidate may accumulate before it is rejected. */
export const MAX_TRANSIENT_FETCH_ATTEMPTS = 4;

/** Backoff before the (attempts+1)-th fetch: 5 min → 30 min → 2 h. */
export function fetchRetryBackoffMs(attempts: number): number {
  if (attempts <= 0) return 0;
  if (attempts === 1) return 5 * 60_000;
  if (attempts === 2) return 30 * 60_000;
  return 2 * 60 * 60_000;
}

/**
 * Selection filter for the fetch stage: a candidate is eligible when it has
 * never been attempted, or its last attempt is older than the backoff for
 * its attempt count. This is what keeps a candidate that just failed
 * transiently (or was cache-satisfied) from being re-selected on the very
 * next pass ahead of every other candidate (WX-05 / WX-06).
 */
export function candidateFetchEligibility(now: Date): Prisma.CandidateSourceUrlWhereInput {
  const before = (ms: number) => new Date(now.getTime() - ms);
  return {
    OR: [
      { lastFetchedAt: null },
      { fetchAttempts: { lte: 0 } },
      { fetchAttempts: 1, lastFetchedAt: { lt: before(fetchRetryBackoffMs(1)) } },
      { fetchAttempts: 2, lastFetchedAt: { lt: before(fetchRetryBackoffMs(2)) } },
      { fetchAttempts: { gte: 3 }, lastFetchedAt: { lt: before(fetchRetryBackoffMs(3)) } },
    ],
  };
}

// ── Cross-source verification: type-aware expected values ──────────────

/** Fields that name the entity — compared by the cleaned name, not the raw title. */
const NAME_FIELDS: ReadonlySet<string> = new Set([
  "saintName",
  "apparitionTitle",
  "title",
  "novenaTitle",
  "prayerTitle",
  "consecrationTitle",
  "devotionTitle",
  "liturgyTitle",
  "sacramentTitle",
  "marianTitleName",
  "doctorName",
  "riteName",
  "popeName",
]);

/**
 * Fields DERIVED from another field by the extractor (SAINT feastMonth /
 * feastDayNumber / feastDayOfMonth all come from feastDay). They are never
 * verified on their own — a bare "10" or "4" is on every page — and count as
 * verified exactly when their parent is.
 */
const DERIVED_FIELDS: Record<string, Record<string, string>> = {
  SAINT: { feastMonth: "feastDay", feastDayNumber: "feastDay", feastDayOfMonth: "feastDay" },
};

export function derivedParentField(contentType: string, field: string): string | null {
  return DERIVED_FIELDS[contentType]?.[field] ?? null;
}

/** "Saint Francis of Assisi" / "St. Francis" → "Francis of Assisi" / "Francis". */
export function stripHonorific(name: string): string {
  return name
    .replace(/^(saints?|sts?\.?|blessed|bl\.?|venerable|ven\.?|servant of god)\s+/i, "")
    .trim();
}

function monthDayVariants(month: number, day: number): string[] {
  const long = titleCaseWord(MONTHS[month - 1]);
  const short = long.slice(0, 3);
  return [
    `${long} ${day}`,
    `${day} ${long}`,
    `${short} ${day}`,
    `${short}. ${day}`,
    `${long} ${String(day).padStart(2, "0")}`,
  ];
}

export interface ExpectedValueVariants {
  /** The form a live validation page would carry verbatim (null = unverifiable). */
  primary: string | null;
  /** Every comparable form, for cheap corpus lookups. */
  all: string[];
}

/**
 * The forms an INDEPENDENT source could state a fact in. The extractor emits
 * schema shapes ("10-04" for a feast day, "Saint …" for a name, ISO dates)
 * that no real page prints verbatim, which is why substring verification
 * could never MATCH (WX-03). Numbers under four digits are unverifiable by
 * substring and get no primary form.
 */
export function expectedValueVariants(
  contentType: string,
  field: string,
  derived: string,
): ExpectedValueVariants {
  const value = derived.replace(/\s+/g, " ").trim();
  if (!value) return { primary: null, all: [] };

  if (/^\d{1,3}$/.test(value)) return { primary: null, all: [] };

  // "MM-DD" feast days.
  let m = /^(\d{2})-(\d{2})$/.exec(value);
  if (m) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const all = monthDayVariants(month, day);
      return { primary: all[0], all: [...all, value] };
    }
  }
  // ISO dates "YYYY-MM-DD" (apparition dates, promulgation dates).
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const md = monthDayVariants(month, day);
      const all = [`${md[0]}, ${year}`, `${md[1]} ${year}`, `${md[2]} ${year}`, value];
      return { primary: all[0], all };
    }
  }
  if (NAME_FIELDS.has(field)) {
    const cleaned = cleanSourceTitle(value) ?? value;
    const bare = stripHonorific(cleaned);
    const all = [...new Set([bare, cleaned, value].filter((s) => s.length >= 3))];
    return { primary: all[0] ?? null, all };
  }
  void contentType;
  return { primary: value, all: [value] };
}

/**
 * The entity a corroborating page must be ABOUT: the cleaned primary name
 * field (honorific stripped) rather than the site-suffixed title.
 */
export function entityHintFor(
  contentType: string,
  fields: Record<string, unknown>,
  normalizedTitle: string,
): string {
  for (const key of NAME_FIELDS) {
    const v = fields[key];
    if (typeof v === "string" && v.trim().length >= 3) {
      return stripHonorific(cleanSourceTitle(v) ?? v);
    }
  }
  void contentType;
  return stripHonorific(cleanSourceTitle(normalizedTitle) ?? normalizedTitle);
}

// ── PRAYER publish payload ─────────────────────────────────────────────

/** Extractor prayer types → the PRAYER schema enum. */
const PRAYER_TYPE_MAP: Record<string, string> = {
  morning: "morning",
  evening: "evening",
  night: "evening",
  meal: "meal",
  grace: "meal",
  litany: "litany",
  novena: "novena",
  rosary: "rosary",
  marian: "marian",
  general: "general",
  intercession: "intercession",
  intercessory: "intercession",
  petition: "intercession",
  thanksgiving: "general",
  consecration: "consecration",
  act: "act",
  chaplet: "chaplet",
  psalm: "psalm",
  canticle: "canticle",
  hymn: "hymn",
};

export type PrayerPayloadResult =
  | { ok: true; payload: Record<string, unknown>; language: string }
  | { ok: false; errors: string[] };

/**
 * Turn the PrayerExtractor's raw fields into the complete PRAYER schema
 * payload the public pages and the schema validator expect: slug, title,
 * body (verbatim prayer text), enum prayerType, canonical category, language
 * and citations. The raw fields are kept alongside for anything that still
 * reads `prayerText`. Validated through the shared schema so a web prayer
 * obeys the same rules as a curated one (PR-04).
 */
export function buildPrayerPublishPayload(input: {
  fields: Record<string, unknown>;
  title: string;
  slug: string;
  host?: string | null;
  /** The page the prayer was read from — the citation the schema requires. */
  sourceUrl?: string | null;
}): PrayerPayloadResult {
  const f = input.fields;
  const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
  const title = cleanSourceTitle(str(f.prayerTitle) ?? input.title, input.host) ?? input.title;
  const body = str(f.body) ?? str(f.prayerText);
  const rawType = (str(f.prayerType) ?? "general").toLowerCase();
  const prayerType = PRAYER_TYPE_MAP[rawType] ?? "general";
  const language = (str(f.language) ?? "en").toLowerCase();
  // The extractor's display fields never carry the URL, so the read's own
  // source URL is the citation of record — without it the schema (min 1
  // citation) would refuse every web prayer.
  const sourceUrl = str(f.sourceUrl) ?? str(input.sourceUrl);
  const citations = [
    ...new Set([...(Array.isArray(f.citations) ? f.citations : []), sourceUrl]),
  ].filter((c): c is string => typeof c === "string" && /^https?:\/\//i.test(c));
  const category = categorizePrayer({
    title,
    prayerType,
    body,
    // The extractor stamps the literal "PRAYER"; only a canonical value survives.
    category: str(f.category)?.toLowerCase() === "prayer" ? null : str(f.category),
  });
  const candidate: Record<string, unknown> = {
    ...f,
    slug: input.slug,
    title,
    body: body ?? "",
    prayerType,
    category,
    language,
    citations,
    occasions: Array.isArray(f.occasions) ? f.occasions : [],
    relatedSaints: Array.isArray(f.relatedSaints) ? f.relatedSaints : [],
  };
  if (str(f.summary)) candidate.summary = str(f.summary);
  const validated = validatePayload("PRAYER", candidate);
  if (!validated.ok) return { ok: false, errors: validated.errors };
  return { ok: true, payload: { ...candidate, ...validated.data }, language };
}

// ── Title fallbacks from extracted fields ──────────────────────────────

/** The order content-builder itself uses to name a package from its fields. */
const FIELD_TITLE_KEYS = [
  "prayerTitle",
  "saintName",
  "apparitionTitle",
  "novenaTitle",
  "devotionTitle",
  "consecrationTitle",
  "sacramentTitle",
  "marianTitleName",
  "title",
  "liturgyTitle",
  "doctorName",
  "riteName",
  "popeName",
  "parishName",
] as const;

/**
 * A title the extractor itself produced (`prayerTitle`, `saintName`, …).
 * Used when the page has no usable `<title>`, before falling back to the
 * body heading / URL path.
 */
export function extractorFieldTitle(fields: Record<string, unknown>): string | null {
  for (const key of FIELD_TITLE_KEYS) {
    const v = fields[key];
    if (typeof v === "string" && v.trim().length >= 3) return v.trim();
  }
  return null;
}

// ── Strict-QA formatting dimension ─────────────────────────────────────

/** Markup / template leakage that must never reach a public page. */
const MARKUP_LEAK = /<\/?[a-z][a-z0-9]*(\s[^<>]*)?>|&(nbsp|amp|quot|#\d+);|\{\{|\}\}|\[\[/i;
/** Navigation / boilerplate the reader let through. */
const BOILERPLATE = /(cookie policy|subscribe to our newsletter|share on facebook|advertisement)/i;

/**
 * Deterministic formatting score for strict QA.
 *
 * The extractors never set `formatting.score`, so this dimension used to be a
 * flat 0.8 for EVERY artifact — which, with the other capped dimensions, put
 * the maximum reachable finalScore at ~0.79 + 0.15·confidence and made the
 * 0.95 doctrinal threshold mathematically unreachable (WX-02). Score what can
 * actually be checked instead: a clean body is 1.0, and each real defect
 * (markup leak, boilerplate, a body that is a single truncated fragment)
 * deducts. Never returns 0 — a zero dimension is a hard strict-QA FAIL and
 * formatting alone must not reject content that is otherwise complete and
 * corroborated.
 */
export function formattingQualityScore(
  fields: Record<string, unknown>,
  formattingMetadata: Record<string, unknown>,
): number {
  if (typeof formattingMetadata.score === "number") {
    return Math.max(0, Math.min(1, formattingMetadata.score));
  }
  const text = Object.values(fields)
    .filter((v): v is string => typeof v === "string")
    .join("\n")
    .slice(0, 20_000);
  if (!text.trim()) return 0.6;
  let score = 1;
  if (MARKUP_LEAK.test(text)) score -= 0.35;
  if (BOILERPLATE.test(text)) score -= 0.2;
  // A body that ends mid-sentence is the signature of a truncated extraction.
  if (/\b(read more|continue reading|\.\.\.)\s*$/i.test(text.trim())) score -= 0.2;
  return Math.max(0.4, Math.min(1, score));
}

// ── Durable EXTRACTION cursor ──────────────────────────────────────────

/**
 * AdminWorkerMemory key holding the extraction scan cursor. EXTRACTION used
 * to read only the 200 OLDEST classified reads and pick the first without an
 * artifact — so once those 200 all had artifacts the stage idled forever and
 * read #201 onward was never extracted (WX-01). The cursor makes every pass
 * resume where the last one stopped, and wrap to the oldest read when it runs
 * off the end, so the scan can never park on a prefix.
 */
export const EXTRACTION_CURSOR_KEY = "web-extraction:read-cursor";

export interface ExtractionCursor {
  /** createdAt of the last read this scan examined. */
  at: Date;
  /** Its id — the tiebreaker, so reads sharing a timestamp are never skipped. */
  id: string;
}

/**
 * "Strictly after the cursor" in (createdAt, id) order. Returns `{}` for a
 * null cursor so the scan starts at the oldest read.
 */
export function extractionCursorWhere(cursor: ExtractionCursor | null): Record<string, unknown> {
  if (!cursor) return {};
  return {
    OR: [
      { createdAt: { gt: cursor.at } },
      { AND: [{ createdAt: cursor.at }, { id: { gt: cursor.id } }] },
    ],
  };
}

/**
 * Only the AdminWorkerMemory model is touched, and every call is wrapped in
 * try/catch, so a client (or test fake) without that model is a no-op rather
 * than a throw.
 */
type MemoryCapablePrisma = Pick<PrismaClient, "adminWorkerMemory">;

/** Read the persisted extraction cursor. Fail-open: null restarts the scan. */
export async function loadExtractionCursor(
  prisma: MemoryCapablePrisma,
): Promise<ExtractionCursor | null> {
  try {
    const row = await prisma.adminWorkerMemory.findUnique({
      where: {
        memoryType_memoryKey: {
          memoryType: "GENERIC" as const,
          memoryKey: EXTRACTION_CURSOR_KEY,
        },
      },
      select: { memoryValue: true },
    });
    const value = row?.memoryValue as { at?: string; id?: string } | undefined;
    if (!value?.at || !value.id) return null;
    const at = new Date(value.at);
    if (Number.isNaN(at.getTime())) return null;
    return { at, id: value.id };
  } catch {
    return null;
  }
}

/** Persist the extraction cursor (best-effort — a lost write only re-scans). */
export async function saveExtractionCursor(
  prisma: MemoryCapablePrisma,
  cursor: ExtractionCursor | null,
): Promise<void> {
  try {
    const where = {
      memoryType_memoryKey: {
        memoryType: "GENERIC" as const,
        memoryKey: EXTRACTION_CURSOR_KEY,
      },
    };
    const memoryValue = cursor ? { at: cursor.at.toISOString(), id: cursor.id } : {};
    await prisma.adminWorkerMemory.upsert({
      where,
      update: { memoryValue, lastUsedAt: new Date() },
      create: {
        memoryType: "GENERIC",
        memoryKey: EXTRACTION_CURSOR_KEY,
        memoryValue,
        lastUsedAt: new Date(),
      },
    });
  } catch {
    // Best-effort: without the cursor the next pass simply rescans from the
    // oldest read, which is the old behaviour, not a wedge.
  }
}

/**
 * Verification rounds an artifact may spend gathering cross-source evidence
 * before it is parked for review. Without a bound, a SAINT artifact whose
 * facts no probe URL carries cycles BUILD_READY → verify → NEEDS_REPAIR →
 * (repair resets) → BUILD_READY forever, re-fetching the same 404s every time
 * (WX-03).
 */
export const MAX_VERIFICATION_ROUNDS = 3;
