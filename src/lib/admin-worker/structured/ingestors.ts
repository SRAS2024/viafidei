/**
 * Structured-knowledge ingestor registry.
 *
 * Each ingestor declares, for one content type: a SPARQL query that enumerates
 * the entities of that type from Wikidata, and a mapper that turns one result
 * row into a schema-valid `CuratedEntry` (fetching a Wikipedia abstract for the
 * narrative field where the schema wants one). Adding a content type is "add an
 * ingestor here" — the orchestrator (`ingest.ts`), the publish path, the cursor
 * and the learning signal are all type-agnostic.
 *
 * Accuracy stays paramount: a mapper returns null whenever the row can't yield
 * a complete record, and every produced entry still passes the strict content
 * schema and the full publish gate before anything goes live. Structured data
 * widens what the worker can *procure*; the gates still decide what publishes.
 *
 * POPE is the first ingestor: the line of Roman Pontiffs with their reign years
 * is historical, low-sensitivity, cross-checkable, and a real coverage gap
 * (a few dozen curated vs. 264 total). Doctrinally-sensitive types (a saint's
 * canonization status and feast day) follow once the two-source corroboration
 * layer is in place.
 */

import type { ChecklistContentType, SourceAuthorityLevel } from "@prisma/client";

import type { CuratedEntry } from "@/lib/checklist/knowledge";
import { bindingValue, wikidataEntityUrl, type SparqlBinding } from "./wikidata";
import { fetchSummaryForArticleUrl } from "./wikipedia";

/** Reserved for future context (locale, calendar) passed into a mapper. */
export type IngestContext = Record<string, never>;

export interface StructuredIngestor {
  /** The content type this ingestor publishes. */
  contentType: ChecklistContentType;
  /** Stable id for cursor + learning memory keys and logs. */
  id: string;
  /** Authority level recorded for the produced entries (honest to the source). */
  authorityLevel: SourceAuthorityLevel;
  /**
   * SPARQL SELECT enumerating entities. MUST be deterministically ordered so
   * the `LIMIT`/`OFFSET` cursor walks the whole corpus across passes.
   */
  sparql(limit: number, offset: number): string;
  /** Map one row → a curated-style entry, or null when it can't yield one. */
  map(row: SparqlBinding, ctx: IngestContext): Promise<CuratedEntry | null>;
}

/** ASCII slug from a label (matches the curated knowledge slug convention). */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const popeIngestor: StructuredIngestor = {
  contentType: "POPE",
  id: "wikidata-popes",
  // Honest to the immediate source: an aggregated reference graph (Wikidata +
  // Wikipedia), not a magisterial publication. The publish gate keys off QA /
  // evidence / score, not this level, so it never blocks; it only colours the
  // stored quality breakdown.
  authorityLevel: "TRUSTED_PUBLISHER",
  sparql: (limit, offset) =>
    `SELECT ?pope ?popeLabel (YEAR(?start) AS ?startYear) (YEAR(?end) AS ?endYear) ?birthName ?article WHERE {
  ?pope p:P39 ?statement .
  ?statement ps:P39 wd:Q19546 .
  OPTIONAL { ?statement pq:P580 ?start . }
  OPTIONAL { ?statement pq:P582 ?end . }
  OPTIONAL { ?pope wdt:P1477 ?birthName . }
  OPTIONAL { ?article schema:about ?pope ; schema:isPartOf <https://en.wikipedia.org/> . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
ORDER BY ?start ?pope
LIMIT ${limit} OFFSET ${offset}`,
  async map(row) {
    const label = bindingValue(row, "popeLabel");
    const entity = bindingValue(row, "pope");
    const startYear = bindingValue(row, "startYear");
    // No usable label (the label service echoes the QID when none exists),
    // entity, or reign-start year → can't build a valid POPE record.
    if (!label || !entity || !startYear) return null;
    if (/^Q\d+$/.test(label)) return null;

    const title = /pope/i.test(label) ? label : `Pope ${label}`;
    const endYear = bindingValue(row, "endYear");
    const birthName = bindingValue(row, "birthName");
    const article = bindingValue(row, "article");

    const citations = [wikidataEntityUrl(entity)];
    let background: string | undefined;
    if (article) {
      const summary = await fetchSummaryForArticleUrl(article);
      if (summary) {
        background = summary.extract;
        if (!citations.includes(summary.url)) citations.push(summary.url);
      } else if (!citations.includes(article)) {
        citations.push(article);
      }
    }

    const slug = `pope-${slugify(label)}`;
    if (!slug || slug === "pope-") return null;

    const payload: Record<string, unknown> = {
      slug,
      title,
      papacyStart: startYear,
      summary: `${title}, who reigned as Roman Pontiff from ${startYear}${
        endYear ? `–${endYear}` : " to the present"
      }.`,
      citations,
    };
    if (endYear) payload.papacyEnd = endYear;
    if (birthName) payload.birthName = birthName;
    if (background) payload.background = background;

    return {
      contentType: "POPE",
      slug,
      authorityLevel: "TRUSTED_PUBLISHER",
      citations,
      payload,
    };
  },
};

/** All registered structured ingestors. Extend this to cover more types. */
export const STRUCTURED_INGESTORS: StructuredIngestor[] = [popeIngestor];

export function ingestorFor(contentType: string): StructuredIngestor | undefined {
  return STRUCTURED_INGESTORS.find((i) => i.contentType === contentType);
}
