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
import { feastDayInText, mapCanonizationStatus, parseFeastValue } from "./corroboration";

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
  /**
   * Authoritative source URLs the worker should ADD to its own discovery queue
   * from this row (e.g. an entity's official website) — the self-expansion of
   * the knowledge base: the worker learns new places to pull content from as it
   * ingests. Optional; returns [] when the row carries none.
   */
  discoveredSources?(row: SparqlBinding): string[];
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
    `SELECT ?pope ?popeLabel (YEAR(?start) AS ?startYear) (YEAR(?end) AS ?endYear) ?birthName ?article ?website WHERE {
  ?pope p:P39 ?statement .
  ?statement ps:P39 wd:Q19546 .
  OPTIONAL { ?statement pq:P580 ?start . }
  OPTIONAL { ?statement pq:P582 ?end . }
  OPTIONAL { ?pope wdt:P1477 ?birthName . }
  OPTIONAL { ?pope wdt:P856 ?website . }
  OPTIONAL { ?article schema:about ?pope ; schema:isPartOf <https://en.wikipedia.org/> . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
ORDER BY ?start ?pope
LIMIT ${limit} OFFSET ${offset}`,
  discoveredSources(row) {
    const website = bindingValue(row, "website");
    return website ? [website] : [];
  },
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

type SaintType =
  | "martyr"
  | "doctor_of_the_church"
  | "virgin"
  | "confessor"
  | "religious"
  | "lay"
  | "bishop"
  | "pope"
  | "apostle"
  | "evangelist"
  | "founder"
  | "missionary"
  | "other";

/**
 * Classify a saint's type from the source text deterministically. Reads only
 * the Wikipedia abstract — never invents — and falls back to the always-valid
 * "other" when no marker is present. Ordered most-specific first.
 */
export function classifySaintType(text: string): SaintType {
  const t = text.toLowerCase();
  if (/\bmartyr/.test(t)) return "martyr";
  if (/doctor of the church/.test(t)) return "doctor_of_the_church";
  if (/\bapostle\b/.test(t)) return "apostle";
  if (/\bevangelist\b/.test(t)) return "evangelist";
  if (/\bpope\b/.test(t)) return "pope";
  if (/\b(arch)?bishop\b/.test(t)) return "bishop";
  if (/\b(founder|foundress|co-founder)\b|\bfounded the\b/.test(t)) return "founder";
  if (/\bmissionar/.test(t)) return "missionary";
  if (/\bvirgin\b/.test(t)) return "virgin";
  if (/\b(priest|monk|nun|friar|abbot|abbess|religious order|consecrated)\b/.test(t)) {
    return "religious";
  }
  return "other";
}

const saintIngestor: StructuredIngestor = {
  contentType: "SAINT",
  id: "wikidata-saints",
  authorityLevel: "TRUSTED_PUBLISHER",
  // One row per saint (GROUP BY) carrying canonization status, feast day, the
  // English Wikipedia article (for the biography + a second citation), and the
  // optional official website (self-expansion).
  sparql: (limit, offset) =>
    `SELECT ?s (SAMPLE(?sLabel) AS ?label) (SAMPLE(?feast) AS ?feastVal) (SAMPLE(?feastName0) AS ?feastName) (SAMPLE(?statusLabel) AS ?status) (SAMPLE(?article) AS ?art) (SAMPLE(?website) AS ?site) WHERE {
  ?s wdt:P411 ?statusItem .
  ?statusItem rdfs:label ?statusLabel . FILTER(LANG(?statusLabel) = "en")
  ?s wdt:P841 ?feast .
  OPTIONAL { ?feast rdfs:label ?feastName0 . FILTER(LANG(?feastName0) = "en") }
  ?s rdfs:label ?sLabel . FILTER(LANG(?sLabel) = "en")
  OPTIONAL { ?article schema:about ?s ; schema:isPartOf <https://en.wikipedia.org/> . }
  OPTIONAL { ?s wdt:P856 ?website . }
}
GROUP BY ?s
ORDER BY ?s
LIMIT ${limit} OFFSET ${offset}`,
  discoveredSources(row) {
    const site = bindingValue(row, "site");
    return site ? [site] : [];
  },
  async map(row) {
    const entity = bindingValue(row, "s");
    const label = bindingValue(row, "label");
    const statusLabel = bindingValue(row, "status");
    if (!entity || !label || !statusLabel) return null;

    const canonizationStatus = mapCanonizationStatus(statusLabel);
    if (!canonizationStatus) return null;

    const feast = parseFeastValue({
      literal: bindingValue(row, "feastVal"),
      label: bindingValue(row, "feastName"),
    });
    if (!feast) return null;

    // A Wikipedia article is required: it supplies the ≥100-char biography, the
    // independent corroboration text for the feast day, and the second citation.
    const article = bindingValue(row, "art");
    if (!article) return null;
    const summary = await fetchSummaryForArticleUrl(article);
    if (!summary || summary.extract.length < 100) return null;

    // Accuracy guardrail: the sensitive feast day MUST be stated, in words, in
    // the independent article text. No corroboration → not published.
    if (!feastDayInText(feast.feastMonth, feast.feastDayOfMonth, summary.extract)) return null;

    const base = slugify(label);
    if (!base) return null;
    const slug = base.startsWith("saint-") ? base : `saint-${base}`;

    const citations = [wikidataEntityUrl(entity), summary.url];
    const payload: Record<string, unknown> = {
      slug,
      canonicalName: label,
      feastDay: feast.feastDay,
      feastMonth: feast.feastMonth,
      feastDayOfMonth: feast.feastDayOfMonth,
      patronages: [],
      biography: summary.extract,
      saintType: classifySaintType(summary.extract),
      canonizationStatus,
      relatedPrayers: [],
      relatedDevotions: [],
      citations,
    };

    return {
      contentType: "SAINT",
      slug,
      authorityLevel: "TRUSTED_PUBLISHER",
      citations,
      payload,
    };
  },
};

/** All registered structured ingestors. Extend this to cover more types. */
export const STRUCTURED_INGESTORS: StructuredIngestor[] = [popeIngestor, saintIngestor];

export function ingestorFor(contentType: string): StructuredIngestor | undefined {
  return STRUCTURED_INGESTORS.find((i) => i.contentType === contentType);
}
