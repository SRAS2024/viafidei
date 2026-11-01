/**
 * Which Wikipedia article a published item's prose was quoted from, if any.
 *
 * Wikipedia text is licensed CC BY-SA 4.0, and reuse requires credit by a link
 * to the article plus the licence. The structured ingest quotes article leads
 * verbatim (a saint's biography, a pope's background, a rite's summary), and
 * the detail page showed them with no credit under an "All rights reserved"
 * footer. This module answers the one question the page needs — "credit
 * which article?" — and nothing else; the site shows no source lists.
 *
 * Two ways to know, most explicit first:
 *   1. `payload.provenance` written by the ingest: `{ article: <url>,
 *      <field>: "wikipedia" }` for every field quoted from that article;
 *   2. for rows published before provenance was recorded, the shape the
 *      structured ingest gave them: a Wikidata entity citation next to a
 *      Wikipedia article citation, on a content type whose narrative that
 *      ingest always took from the article. A row whose provenance names
 *      ANOTHER source for its prose — a biography COMPOSED from Wikidata facts
 *      (`"structured-facts"`), or quoted from a public-domain text
 *      (`public-domain-attribution.ts`) — quoted nothing from Wikipedia and is
 *      not credited to it.
 *
 * Pure: no I/O, no React. Returns null rather than guess.
 */

export interface WikipediaTextSource {
  /** The article URL, as cited. */
  url: string;
  /** The article title, human-readable ("Hildegard Burjan"). */
  title: string;
  /** Language edition ("en", "it", …). */
  lang: string;
}

/** Fields the structured ingest quotes from Wikipedia. */
const QUOTED_FIELDS = [
  "biography",
  "background",
  "summary",
  "origin",
  "theologicalSignificance",
  "practiceInstructions",
  "instructions",
] as const;

/**
 * Content types whose structured ingest ALWAYS took its narrative from the
 * cited article (legacy inference), with the field that carries it.
 */
const LEGACY_QUOTED_FIELD: Readonly<Record<string, readonly string[]>> = {
  SAINT: ["biography"],
  POPE: ["background"],
  DOCTOR: ["summary", "background"],
  RITE: ["summary", "background"],
  CHURCH_DOCUMENT: ["summary"],
};

/**
 * Descriptive types: the ingest preferred the entity's official site and fell
 * back to Wikipedia only when the site yielded nothing, so a legacy row is
 * credited only when the article was its ONLY non-Wikidata source.
 */
const LEGACY_FALLBACK_TYPES: ReadonlySet<string> = new Set([
  "DEVOTION",
  "MARIAN_TITLE",
  "SPIRITUAL_PRACTICE",
]);

const WIKIPEDIA_ARTICLE_RE = /^https?:\/\/([a-z-]+)\.(?:m\.)?wikipedia\.org\/wiki\/([^?#]+)/i;
const WIKIDATA_ENTITY_RE = /^https?:\/\/(?:www\.)?wikidata\.org\/wiki\/Q\d+/i;

/** Parse a Wikipedia article URL into its credit line parts (null when it is not one). */
export function parseWikipediaArticle(url: string): WikipediaTextSource | null {
  const m = url.match(WIKIPEDIA_ARTICLE_RE);
  if (!m) return null;
  let title = m[2];
  try {
    title = decodeURIComponent(title);
  } catch {
    // keep the raw title
  }
  title = title.replace(/_/g, " ").trim();
  if (!title) return null;
  return { url, title, lang: m[1].toLowerCase() };
}

function nonEmptyText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function citationsOf(payload: Record<string, unknown>): string[] {
  const c = payload.citations;
  return Array.isArray(c) ? c.filter((x): x is string => typeof x === "string") : [];
}

/**
 * The Wikipedia article this item's displayed prose came from, or null when
 * none of it did (or it cannot be told).
 */
export function wikipediaTextSource(
  contentType: string,
  payload: Record<string, unknown>,
): WikipediaTextSource | null {
  const provenance =
    payload.provenance &&
    typeof payload.provenance === "object" &&
    !Array.isArray(payload.provenance)
      ? (payload.provenance as Record<string, unknown>)
      : null;

  // 1. Explicit provenance from the ingest.
  if (provenance) {
    const quoted = QUOTED_FIELDS.filter(
      (f) => provenance[f] === "wikipedia" && nonEmptyText(payload[f]),
    );
    if (quoted.length > 0 && typeof provenance.article === "string") {
      return parseWikipediaArticle(provenance.article);
    }
    // The ingest named another source for the prose — a COMPOSED biography
    // ("structured-facts") or a public-domain text (the Catholic Encyclopedia,
    // the 1916 Roman Martyrology) — so none of it is Wikipedia's, even when
    // a Wikipedia article is cited for the facts it corroborated.
    if (QUOTED_FIELDS.some((f) => typeof provenance[f] === "string")) return null;
  }

  // 2. Legacy rows: the structured ingest's own shape.
  const citations = citationsOf(payload);
  if (!citations.some((c) => WIKIDATA_ENTITY_RE.test(c))) return null;
  const articles = citations.filter((c) => WIKIPEDIA_ARTICLE_RE.test(c));
  if (articles.length === 0) return null;

  const fields = LEGACY_QUOTED_FIELD[contentType];
  if (fields) {
    return fields.some((f) => nonEmptyText(payload[f])) ? parseWikipediaArticle(articles[0]) : null;
  }
  if (LEGACY_FALLBACK_TYPES.has(contentType)) {
    const others = citations.filter(
      (c) => !WIKIDATA_ENTITY_RE.test(c) && !WIKIPEDIA_ARTICLE_RE.test(c),
    );
    return others.length === 0 ? parseWikipediaArticle(articles[0]) : null;
  }
  return null;
}

/** English names of the editions the ingest reads, for "Italian Wikipedia". */
const EDITION_NAMES: Readonly<Record<string, string>> = {
  it: "Italian",
  es: "Spanish",
  fr: "French",
  de: "German",
  pl: "Polish",
  pt: "Portuguese",
  nl: "Dutch",
  la: "Latin",
};

/** "Wikipedia" for English, "Italian Wikipedia" for another edition. */
export function wikipediaEditionName(lang: string): string {
  if (lang === "en") return "Wikipedia";
  const name = EDITION_NAMES[lang];
  return name ? `${name} Wikipedia` : `Wikipedia (${lang})`;
}

/** The licence Wikipedia text is reused under. */
export const WIKIPEDIA_LICENSE = {
  name: "CC BY-SA 4.0",
  url: "https://creativecommons.org/licenses/by-sa/4.0/",
} as const;
