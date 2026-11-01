/**
 * Search inside one content list page (/prayers?q=, /popes?q=, …).
 *
 * The small content types are already read whole by their list pages (the
 * cards show payload prose), so their search runs here, over the rows the page
 * has in hand: no second query, and the page's own filters and order keep
 * working on the result. The types that grow without bound (saints, litanies,
 * parishes) search in SQL instead — see `listPublishedPage` and
 * `listParishPage` — with the same reading of a query: every word must match,
 * a word matches the start of a word, and "Saint" and "St." are one word.
 *
 * Matches are ordered the way a reader expects: the title itself, then a title
 * that begins with the query, then one containing it, then titles holding every
 * word, then the short facts on the card (subtitle, patronage, place, kind),
 * and last the longer text (a summary, the prayer itself). Ties keep the
 * page's own order.
 */

import type { ChecklistContentType } from "@prisma/client";

import type { PublishedItem } from "@/lib/data/published";

/** Longest query a list page searches for; the rest is ignored. */
export const MAX_QUERY_LENGTH = 100;

/** At most this many words are matched; a pasted paragraph is not a query. */
export const MAX_QUERY_WORDS = 8;

/** Prose beyond this many characters per field is not searched, as in the SQL index. */
const MAX_PROSE_CHARS = 4000;

/**
 * A list page's URL with these parameters, in the order given, leaving out the
 * empty ones: `listHref("/prayers", { filter: "marian", q: "mary" })` is
 * "/prayers?filter=marian&q=mary". Filter chips carry the search this way, and
 * "Clear search" is the same URL without `q`.
 */
export function listHref(
  path: string,
  params: Readonly<Record<string, string | null | undefined>> = {},
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.length > 0) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * `?q=` as the page receives it → the query: the first value when the
 * parameter repeats, whitespace collapsed, trimmed and capped. "" when absent.
 */
export function parseSearchQuery(raw: unknown): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH).trim();
}

/**
 * Case- and accent-folded words separated by single spaces: "St. Thérèse's"
 * → "st thereses". Apostrophes vanish so "Mary's" and "marys" agree; every
 * other mark between letters separates words.
 */
export function normalizeSearchText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/['’ʼ`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Words that mean the same thing in a title: "St. Joseph" is "Saint Joseph". */
const SAME_WORD: Readonly<Record<string, readonly string[]>> = {
  st: ["st", "saint"],
  saint: ["st", "saint"],
  sts: ["sts", "saints"],
  saints: ["sts", "saints"],
};

/** The normalized words of a query, de-duplicated and capped. */
export function searchWords(query: string): string[] {
  const words = normalizeSearchText(query).split(" ").filter(Boolean);
  return [...new Set(words)].slice(0, MAX_QUERY_WORDS);
}

/**
 * Text prepared for word-start matching: " word word … " with each word that
 * has a synonym followed by it, so "St." can be found by typing "saint" (or
 * just "sain") and "Saint" by typing "st".
 */
function haystack(texts: ReadonlyArray<string | null | undefined>): string {
  const words: string[] = [];
  for (const text of texts) {
    if (!text) continue;
    for (const word of normalizeSearchText(text).split(" ")) {
      if (!word) continue;
      words.push(...(SAME_WORD[word] ?? [word]));
    }
  }
  return words.length > 0 ? ` ${words.join(" ")} ` : " ";
}

/** Every query word starts some word of the text. */
function holdsEvery(text: string, words: readonly string[]): boolean {
  return words.every((word) => text.includes(` ${word}`));
}

/** What one item offers to a search. */
export interface SearchFields {
  title: string;
  /** Short facts a reader searches by: subtitle, patronage, place, kind. */
  secondary?: ReadonlyArray<string | null | undefined>;
  /** Longer text, searched last: a summary, the prayer itself. */
  prose?: ReadonlyArray<string | null | undefined>;
}

/**
 * How well `fields` answers the query, lower is better, or null when some
 * word of the query is found nowhere in it.
 */
export function searchTier(fields: SearchFields, query: string): number | null {
  const words = searchWords(query);
  if (words.length === 0) return null;
  const phrase = words.join(" ");
  const title = normalizeSearchText(fields.title);
  if (title === phrase) return 0;
  if (title.startsWith(phrase)) return 1;
  if (` ${title}`.includes(` ${phrase}`)) return 2;
  const titleWords = haystack([fields.title]);
  if (holdsEvery(titleWords, words)) return 3;
  const card = haystack([fields.title, ...(fields.secondary ?? [])]);
  if (holdsEvery(card, words)) return 4;
  const prose = (fields.prose ?? []).map((text) => text?.slice(0, MAX_PROSE_CHARS));
  if (holdsEvery(haystack([fields.title, ...(fields.secondary ?? []), ...prose]), words)) {
    return 5;
  }
  return null;
}

/**
 * The items that match `query`, best first; ties keep their order in `items`
 * (the page's own order: chronological popes, alphabetical prayers). An empty
 * query returns every item unchanged; a query with no letters or digits in it
 * ("!!!") matches nothing, as it does in SQL.
 */
export function rankBySearch<T>(
  items: readonly T[],
  query: string,
  fieldsOf: (item: T) => SearchFields,
): T[] {
  if (!query.trim()) return [...items];
  const ranked: Array<{ item: T; tier: number; index: number }> = [];
  items.forEach((item, index) => {
    const tier = searchTier(fieldsOf(item), query);
    if (tier !== null) ranked.push({ item, tier, index });
  });
  ranked.sort((a, b) => a.tier - b.tier || a.index - b.index);
  return ranked.map((entry) => entry.item);
}

/**
 * The payload fields each type is searched by besides its title and subtitle —
 * the facts its card and page lead with. Stored enum values ("lent_preparation")
 * are searchable too: normalization reads the underscores as spaces.
 */
const SECONDARY_FIELDS: Partial<Record<ChecklistContentType, readonly string[]>> = {
  PRAYER: ["prayerType", "category", "occasions"],
  SAINT: ["patronages", "patronage", "feastDay"],
  APPARITION: ["location", "country", "yearOfApparition", "visionaries", "approvedStatus"],
  MARIAN_TITLE: ["aliases", "origin", "region"],
  POPE: ["papacyStart", "papacyEnd", "birthName"],
  DOCTOR: ["doctorTitle", "ecclesialRole"],
  NOVENA: ["intentionTheme"],
  DEVOTION: ["devotionType", "subtype"],
  GUIDE: ["kind", "category", "sacramentKey"],
  LITURGICAL: ["kind", "season", "rank", "feastDate"],
  CHURCH_DOCUMENT: ["documentType", "issuingAuthority", "issuedDate", "keyThemes"],
  RITE: ["family", "region", "riteKey", "entryKind"],
  SPIRITUAL_PRACTICE: ["practiceKind", "tradition"],
  PARISH: ["city", "state", "country", "postalCode"],
};

/** Longer text searched last, for every type that has it. */
const PROSE_FIELDS = [
  "summary",
  "body",
  "prayerText",
  "latin",
  "intro",
  "description",
  "history",
  "background",
] as const;

/** Strings (and numbers, as text) in a payload value, one level into arrays. */
function textsOf(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value] : [];
  if (typeof value === "number" && Number.isFinite(value)) return [String(value)];
  if (Array.isArray(value)) return value.flatMap((entry) => textsOf(entry));
  return [];
}

/**
 * The search fields of a published item. `extra` adds the labels the page
 * shows for it (a prayer's category, a guide's kind) so the reader can search
 * by the words actually on the card.
 */
export function publishedSearchFields(
  item: Pick<PublishedItem, "contentType" | "title" | "subtitle" | "payload">,
  extra: ReadonlyArray<string | null | undefined> = [],
): SearchFields {
  const payload = (item.payload ?? {}) as Record<string, unknown>;
  const fields = SECONDARY_FIELDS[item.contentType] ?? [];
  return {
    title: item.title,
    secondary: [item.subtitle, ...extra, ...fields.flatMap((key) => textsOf(payload[key]))],
    prose: PROSE_FIELDS.flatMap((key) => textsOf(payload[key])),
  };
}

/** `rankBySearch` over published items, with `publishedSearchFields`. */
export function searchPublishedItems<T extends Parameters<typeof publishedSearchFields>[0]>(
  items: readonly T[],
  query: string,
  extra?: (item: T) => ReadonlyArray<string | null | undefined>,
): T[] {
  return rankBySearch(items, query, (item) => publishedSearchFields(item, extra?.(item)));
}
