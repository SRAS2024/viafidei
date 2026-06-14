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
import { fetchArticleInfobox } from "./wikipedia-infobox";
import { fetchDocumentExcerpt } from "./document-excerpt";
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

/**
 * Normalise a display name for cross-slug duplicate detection: strip honorific
 * prefixes (Saint, Pope, Blessed, …) and punctuation so "Pope Saint John Paul
 * II" and "Pope John Paul II" collapse to the same key, while distinguishing
 * tokens (regnal numbers, surnames) are kept.
 */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(pope|saint|st|blessed|bl|venerable|ven|servant of god)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Reduce a rite / Church-sui-iuris name to its distinguishing core, dropping the
 * generic words ("rite", "(Greek) Catholic Church", …) so the structured slug
 * lines up with the curated convention (`rite-roman`, `rite-byzantine`, …).
 * This is the dedup safety net: a Wikidata "Byzantine Rite" maps to `rite-byzantine`
 * and collapses onto the curated entry instead of becoming a second page, while a
 * genuinely new sui iuris church ("Italo-Albanian") yields a fresh `rite-italo-albanian`.
 */
export function riteCoreSlug(label: string): string {
  const core = label
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(
      /\b(rite|church|catholic|greek|ge'?ez|byzantine-rite|sui|iuris|eastern|major|archiepiscopal|metropolitan)\b/g,
      " ",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return slugify(core);
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
    // Wikidata tags ANTIPOPES with the papal position too — exclude them so the
    // count reflects the real line of Roman Pontiffs, not disputed claimants.
    if (/\bantipope\b/i.test(label)) return null;

    // "Pope " only when the label doesn't already carry a papal title (and never
    // double-prefixes "Pope Saint …"); antipopes are already excluded above.
    const title = /\bpope\b/i.test(label) ? label : `Pope ${label}`;
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

    // Accuracy guardrail: the sensitive feast day MUST also be stated in the
    // article itself — in the prose OR in its infobox (where it usually lives;
    // the abstract often omits it). Either way it is an independent statement
    // of the fact: no corroboration → not published.
    let corroborated = feastDayInText(feast.feastMonth, feast.feastDayOfMonth, summary.extract);
    let infobox: Record<string, string> = {};
    if (!corroborated) {
      infobox = await fetchArticleInfobox(article).catch(() => ({}));
      const infoboxFeast = infobox.feast_day ?? infobox.feast ?? "";
      corroborated =
        Boolean(infoboxFeast) &&
        (parseFeastValue({ label: infoboxFeast })?.feastDay === feast.feastDay ||
          feastDayInText(feast.feastMonth, feast.feastDayOfMonth, infoboxFeast));
    } else {
      // Corroborated by prose; still read the infobox for the optional
      // enrichment fields below (fail-open).
      infobox = await fetchArticleInfobox(article).catch(() => ({}));
    }
    if (!corroborated) return null;

    const base = slugify(label);
    if (!base) return null;
    const slug = base.startsWith("saint-") ? base : `saint-${base}`;

    // Optional enrichment, straight from the article's infobox (cited via the
    // article itself): patronage list, birth/death, canonization details.
    const patronages = (infobox.patronage ?? "")
      .split(/[;,]| and /)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && s.length <= 80)
      .slice(0, 12);
    const yearish = (s: string | undefined): string | undefined => {
      const t = (s ?? "").trim();
      return t && /\d{3,4}/.test(t) && t.length <= 60 ? t : undefined;
    };
    const birthDate = yearish(infobox.birth_date);
    const deathDate = yearish(infobox.death_date);
    const canonizationDate = yearish(infobox.canonized_date);
    const canonizedBy = (infobox.canonized_by ?? "").trim() || undefined;

    const citations = [wikidataEntityUrl(entity), summary.url];
    const payload: Record<string, unknown> = {
      slug,
      canonicalName: label,
      feastDay: feast.feastDay,
      feastMonth: feast.feastMonth,
      feastDayOfMonth: feast.feastDayOfMonth,
      patronages,
      biography: summary.extract,
      saintType: classifySaintType(summary.extract),
      canonizationStatus,
      relatedPrayers: [],
      relatedDevotions: [],
      citations,
    };
    if (birthDate) payload.birthDate = birthDate;
    if (deathDate) payload.deathDate = deathDate;
    if (canonizationDate) payload.canonizationDate = canonizationDate;
    if (canonizedBy && canonizedBy.length <= 80) payload.canonizedBy = canonizedBy;

    return {
      contentType: "SAINT",
      slug,
      authorityLevel: "TRUSTED_PUBLISHER",
      citations,
      payload,
    };
  },
};

type DocumentType =
  | "encyclical"
  | "apostolic_exhortation"
  | "apostolic_constitution"
  | "motu_proprio"
  | "apostolic_letter"
  | "decree"
  | "declaration";

/**
 * Map Wikidata instance-of type labels to the schema's documentType enum.
 * Reads concatenated labels (most-specific first) and returns null on anything
 * unrecognised so the caller skips rather than mislabels.
 */
export function mapDocumentType(typeLabels: string): DocumentType | null {
  const t = typeLabels.toLowerCase();
  if (t.includes("encyclical")) return "encyclical";
  if (t.includes("apostolic exhortation")) return "apostolic_exhortation";
  if (t.includes("apostolic constitution")) return "apostolic_constitution";
  if (t.includes("motu proprio")) return "motu_proprio";
  if (t.includes("apostolic letter")) return "apostolic_letter";
  if (t.includes("decree")) return "decree";
  if (t.includes("declaration")) return "declaration";
  return null;
}

const churchDocumentIngestor: StructuredIngestor = {
  contentType: "CHURCH_DOCUMENT",
  id: "wikidata-church-documents",
  authorityLevel: "TRUSTED_PUBLISHER",
  // Official Church documents (encyclicals, exhortations, constitutions, motu
  // proprios, apostolic letters). Bibliographic facts come straight from
  // Wikidata (type, author, day-precision date, main subjects, canonical text
  // URL); the narrative summary comes verbatim + cited from Wikipedia. The
  // date is required at day precision (P577 value node) so a year-only date is
  // never padded to a fabricated month/day.
  sparql: (limit, offset) =>
    `SELECT ?doc (SAMPLE(?docLabel) AS ?label) (GROUP_CONCAT(DISTINCT ?typeLabel; SEPARATOR="||") AS ?types) (SAMPLE(?authorLabel) AS ?author) (SAMPLE(?date) AS ?pubDate) (SAMPLE(?canonical) AS ?canon) (GROUP_CONCAT(DISTINCT ?subjectLabel; SEPARATOR="||") AS ?themes) (SAMPLE(?article) AS ?art) WHERE {
  ?doc wdt:P31 ?type .
  ?type rdfs:label ?typeLabel . FILTER(LANG(?typeLabel) = "en")
  FILTER(CONTAINS(LCASE(?typeLabel), "encyclical") || CONTAINS(LCASE(?typeLabel), "apostolic exhortation") || CONTAINS(LCASE(?typeLabel), "apostolic constitution") || CONTAINS(LCASE(?typeLabel), "motu proprio") || CONTAINS(LCASE(?typeLabel), "apostolic letter"))
  ?doc rdfs:label ?docLabel . FILTER(LANG(?docLabel) = "en")
  ?doc wdt:P50 ?author . ?author rdfs:label ?authorLabel . FILTER(LANG(?authorLabel) = "en")
  ?doc p:P577 ?pubSt . ?pubSt psv:P577 ?pubVal . ?pubVal wikibase:timeValue ?date ; wikibase:timePrecision ?prec . FILTER(?prec >= 11)
  ?doc wdt:P921 ?subject . ?subject rdfs:label ?subjectLabel . FILTER(LANG(?subjectLabel) = "en")
  OPTIONAL { ?doc wdt:P953 ?canonical . }
  OPTIONAL { ?article schema:about ?doc ; schema:isPartOf <https://en.wikipedia.org/> . }
}
GROUP BY ?doc
ORDER BY ?doc
LIMIT ${limit} OFFSET ${offset}`,
  discoveredSources(row) {
    // The canonical document URL is usually the actual Vatican text — a
    // high-value extraction source to add to the worker's own discovery queue.
    const canon = bindingValue(row, "canon");
    return canon ? [canon] : [];
  },
  async map(row) {
    const entity = bindingValue(row, "doc");
    const label = bindingValue(row, "label");
    const types = bindingValue(row, "types");
    const author = bindingValue(row, "author");
    const pubDate = bindingValue(row, "pubDate");
    const canon = bindingValue(row, "canon");
    const themesRaw = bindingValue(row, "themes");
    const article = bindingValue(row, "art");
    if (!entity || !label || !types || !author || !pubDate || !themesRaw) return null;

    const documentType = mapDocumentType(types);
    if (!documentType) return null;

    const dateMatch = pubDate.match(/^\+?(\d{4}-\d{2}-\d{2})T/);
    if (!dateMatch) return null;
    const issuedDate = dateMatch[1];

    const keyThemes = [
      ...new Set(
        themesRaw
          .split("||")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ].slice(0, 8);
    if (keyThemes.length === 0) return null;

    // canonicalUrl is required + must be a valid URL.
    if (!canon) return null;
    let canonicalUrl: string;
    try {
      canonicalUrl = new URL(canon).toString();
    } catch {
      return null;
    }

    if (!article) return null;
    const summary = await fetchSummaryForArticleUrl(article);
    if (!summary || summary.extract.length < 100) return null;

    const slug = slugify(label);
    if (!slug) return null;

    const citations = [wikidataEntityUrl(entity), canonicalUrl];
    if (!citations.includes(summary.url)) citations.push(summary.url);

    const payload: Record<string, unknown> = {
      slug,
      title: label,
      documentType,
      issuingAuthority: author,
      issuedDate,
      summary: summary.extract,
      keyThemes,
      canonicalUrl,
      relatedDocuments: [],
      citations,
    };

    // Verbatim opening excerpt from the canonical document text itself
    // (usually vatican.va) — cited via canonicalUrl, zero fabrication surface.
    // Fail-open: no excerpt just means the record ships metadata-only.
    const excerpt = await fetchDocumentExcerpt(canonicalUrl).catch(() => null);
    if (excerpt) payload.bodyExcerpt = excerpt;

    return {
      contentType: "CHURCH_DOCUMENT",
      slug,
      authorityLevel: "TRUSTED_PUBLISHER",
      citations,
      payload,
    };
  },
};

const doctorIngestor: StructuredIngestor = {
  contentType: "DOCTOR",
  id: "wikidata-doctors",
  authorityLevel: "TRUSTED_PUBLISHER",
  // Doctors of the Church — matched by the honorific label (position held P39
  // or award P166 containing "Doctor of the Church"), so it doesn't depend on a
  // single hard-coded QID. The schema is permissive (name + citations); the
  // biography comes verbatim + cited from Wikipedia when available.
  sparql: (limit, offset) =>
    `SELECT ?d (SAMPLE(?dLabel) AS ?label) (SAMPLE(?article) AS ?art) (SAMPLE(?website) AS ?site) WHERE {
  ?d (wdt:P39|wdt:P166) ?honor .
  ?honor rdfs:label ?honorLabel . FILTER(LANG(?honorLabel) = "en")
  FILTER(CONTAINS(LCASE(?honorLabel), "doctor of the church"))
  ?d rdfs:label ?dLabel . FILTER(LANG(?dLabel) = "en")
  OPTIONAL { ?article schema:about ?d ; schema:isPartOf <https://en.wikipedia.org/> . }
  OPTIONAL { ?d wdt:P856 ?website . }
}
GROUP BY ?d
ORDER BY ?d
LIMIT ${limit} OFFSET ${offset}`,
  discoveredSources(row) {
    const site = bindingValue(row, "site");
    return site ? [site] : [];
  },
  async map(row) {
    const entity = bindingValue(row, "d");
    const label = bindingValue(row, "label");
    if (!entity || !label) return null;
    if (/^Q\d+$/.test(label)) return null;

    const title = /\b(saint|st\.?|pope|blessed)\b/i.test(label) ? label : `Saint ${label}`;
    const citations = [wikidataEntityUrl(entity)];
    let summary: string | undefined;
    const article = bindingValue(row, "art");
    if (article) {
      const s = await fetchSummaryForArticleUrl(article);
      if (s) {
        summary = s.extract;
        if (!citations.includes(s.url)) citations.push(s.url);
      } else if (!citations.includes(article)) {
        citations.push(article);
      }
    }

    const slug = `doctor-${slugify(label)}`;
    if (slug === "doctor-") return null;

    const payload: Record<string, unknown> = { slug, title, citations };
    if (summary) {
      payload.summary = summary;
      payload.background = summary;
    }

    return {
      contentType: "DOCTOR",
      slug,
      authorityLevel: "TRUSTED_PUBLISHER",
      citations,
      payload,
    };
  },
};

const riteIngestor: StructuredIngestor = {
  contentType: "RITE",
  id: "wikidata-rites",
  authorityLevel: "TRUSTED_PUBLISHER",
  // The recognized Catholic rites + the Eastern Catholic Churches sui iuris — a
  // fixed, factual, low-sensitivity set Wikidata covers well. The RITE schema is
  // permissive (name + citations; description optional), so a cited Wikipedia
  // abstract for the narrative is a complete, accurate record. The instance-of
  // filter requires "catholic"/"sui iuris"/"eastern catholic church" so no
  // non-Catholic rite is pulled, and a Wikipedia article is required for the
  // cited description.
  sparql: (limit, offset) =>
    `SELECT ?r (SAMPLE(?rLabel) AS ?label) (SAMPLE(?article) AS ?art) (SAMPLE(?website) AS ?site) WHERE {
  ?r wdt:P31 ?type .
  ?type rdfs:label ?tl . FILTER(LANG(?tl) = "en")
  FILTER(CONTAINS(LCASE(?tl), "sui iuris") || CONTAINS(LCASE(?tl), "eastern catholic church") || (CONTAINS(LCASE(?tl), "catholic") && (CONTAINS(LCASE(?tl), "rite") || CONTAINS(LCASE(?tl), "church"))))
  ?r rdfs:label ?rLabel . FILTER(LANG(?rLabel) = "en")
  ?article schema:about ?r ; schema:isPartOf <https://en.wikipedia.org/> .
  OPTIONAL { ?r wdt:P856 ?website . }
}
GROUP BY ?r
ORDER BY ?r
LIMIT ${limit} OFFSET ${offset}`,
  discoveredSources(row) {
    const site = bindingValue(row, "site");
    return site ? [site] : [];
  },
  async map(row) {
    const entity = bindingValue(row, "r");
    const label = bindingValue(row, "label");
    if (!entity || !label) return null;
    if (/^Q\d+$/.test(label)) return null;

    // The cited descriptive narrative comes verbatim from Wikipedia; a rite with
    // only a name and no sourced description isn't publishable quality.
    const article = bindingValue(row, "art");
    if (!article) return null;
    const summary = await fetchSummaryForArticleUrl(article);
    if (!summary || summary.extract.length < 80) return null;

    const core = riteCoreSlug(label);
    if (!core) return null;
    const slug = `rite-${core}`;

    const citations = [wikidataEntityUrl(entity), summary.url];
    const payload: Record<string, unknown> = {
      slug,
      title: label,
      summary: summary.extract,
      background: summary.extract,
      citations,
    };

    return {
      contentType: "RITE",
      slug,
      authorityLevel: "TRUSTED_PUBLISHER",
      citations,
      payload,
    };
  },
};

/* ── Multi-source narrative resolution ──────────────────────────────────────
 * The descriptive content types (devotion, Marian title, spiritual practice)
 * carry narrative fields whose accuracy rules ask for authoritative sources —
 * not an encyclopedia. So their ingestors resolve the narrative from MULTIPLE
 * sources in priority order and cross-reference: the entity's official website
 * (P856) and "described at URL" (P973) FIRST — read verbatim with the same
 * conservative document extractor used for Church-document excerpts — and the
 * Wikipedia abstract only as the LAST resort. Every authoritative URL the entity
 * carries is cited, so each published record is cross-referenceable against more
 * than one source. A record with no sourced narrative from ANY source is
 * skipped, never invented. Network-gated + fail-open like the rest of the engine.
 */

interface SourcedNarrative {
  /** Narrative text, verbatim from the winning source. */
  text: string;
  /** URL the narrative text came from. */
  sourceUrl: string;
  /** Every authoritative URL for the entity (for multi-source citations). */
  citations: string[];
  /** True when the only narrative available was the Wikipedia fallback. */
  wikipediaFallback: boolean;
}

/** Normalise to a valid URL string, or null when the value isn't one. */
function validUrl(u: string | undefined | null): string | null {
  if (!u) return null;
  try {
    return new URL(u).toString();
  } catch {
    return null;
  }
}

/** First sentence(s) of a source text up to ~maxChars, cut on a boundary. */
export function leadText(text: string, maxChars: number): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= maxChars) return t;
  const slice = t.slice(0, maxChars);
  const stop = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("? "), slice.lastIndexOf("! "));
  return stop > 40 ? slice.slice(0, stop + 1) : slice;
}

/**
 * Resolve the narrative for a descriptive entity from its row's sources, in
 * accuracy order: official website → described-at URL → Wikipedia (last). Reads
 * the authoritative pages verbatim via the document extractor; the Wikipedia
 * abstract is the final fallback but is always cited (when present) for
 * cross-reference. Returns null when no source yields enough prose.
 */
async function resolveSourcedNarrative(
  row: SparqlBinding,
  opts: { minChars?: number } = {},
): Promise<SourcedNarrative | null> {
  const minChars = opts.minChars ?? 120;
  const site = validUrl(bindingValue(row, "site"));
  const desc = validUrl(bindingValue(row, "desc"));
  const art = bindingValue(row, "art");

  // 1) Authoritative sources first. fetchDocumentExcerpt is conservative (real
  //    prose only) and fail-open, so a flaky/empty official page just falls
  //    through to the next source.
  let text: string | null = null;
  let sourceUrl = "";
  for (const url of [site, desc].filter((u): u is string => Boolean(u))) {
    const excerpt = await fetchDocumentExcerpt(url).catch(() => null);
    if (excerpt && excerpt.trim().length >= minChars) {
      text = excerpt.trim();
      sourceUrl = url;
      break;
    }
  }

  // 2) Wikipedia — the LAST resort for the narrative, but always read + cite it
  //    (when present) so the record carries an independent cross-reference.
  let wikiUrl: string | null = null;
  if (art) {
    const summary = await fetchSummaryForArticleUrl(art).catch(() => null);
    if (summary) {
      wikiUrl = validUrl(summary.url) ?? validUrl(art);
      if (!text && summary.extract.trim().length >= minChars) {
        text = summary.extract.trim();
        sourceUrl = wikiUrl ?? "";
      }
    }
  }

  if (!text || !sourceUrl) return null;

  const citations: string[] = [];
  for (const u of [site, desc, wikiUrl].filter((u): u is string => Boolean(u))) {
    if (!citations.includes(u)) citations.push(u);
  }
  return { text, sourceUrl, citations, wikipediaFallback: sourceUrl === wikiUrl };
}

/** Common SPARQL projection of an entity's authoritative source URLs. */
function sourcedEntitySources(row: SparqlBinding): string[] {
  const out: string[] = [];
  const site = bindingValue(row, "site");
  const desc = bindingValue(row, "desc");
  if (site) out.push(site);
  if (desc) out.push(desc);
  return out;
}

/**
 * Classify a devotion's type from its name + sourced text into the schema's
 * free-text `devotionType`. Reads only the source text — never invents — and
 * falls back to the always-valid "Catholic devotion".
 */
export function classifyDevotionType(text: string): string {
  const t = text.toLowerCase();
  if (/sacred heart/.test(t)) return "Devotion to the Sacred Heart";
  if (/immaculate heart/.test(t)) return "Devotion to the Immaculate Heart";
  if (/divine mercy/.test(t)) return "Divine Mercy devotion";
  if (/holy face/.test(t)) return "Devotion to the Holy Face";
  if (/precious blood/.test(t)) return "Devotion to the Precious Blood";
  if (/blessed sacrament|eucharist|adoration|forty hours|corpus christi/.test(t)) {
    return "Eucharistic devotion";
  }
  if (
    /rosary|scapular|our lady|blessed virgin|\bmary\b|marian|guadalupe|fátima|fatima|lourdes/.test(
      t,
    )
  ) {
    return "Marian devotion";
  }
  if (/\bsaint\b|\bst\.\s/.test(t)) return "Devotion to a saint";
  return "Catholic devotion";
}

const devotionIngestor: StructuredIngestor = {
  contentType: "DEVOTION",
  id: "wikidata-devotions",
  authorityLevel: "TRUSTED_PUBLISHER",
  // Catholic devotions — enumerated by an instance-of label containing
  // "devotion" (robust to QID drift, like the rite/church-document filters).
  // The narrative comes from the devotion's official source first and Wikipedia
  // only as a last resort; both source URLs are cited for cross-reference.
  sparql: (limit, offset) =>
    `SELECT ?d (SAMPLE(?dLabel) AS ?label) (GROUP_CONCAT(DISTINCT ?typeLabel; SEPARATOR="||") AS ?types) (SAMPLE(?site) AS ?site) (SAMPLE(?described) AS ?desc) (SAMPLE(?article) AS ?art) WHERE {
  ?d wdt:P31 ?type .
  ?type rdfs:label ?typeLabel . FILTER(LANG(?typeLabel) = "en")
  FILTER(CONTAINS(LCASE(?typeLabel), "devotion"))
  ?d rdfs:label ?dLabel . FILTER(LANG(?dLabel) = "en")
  OPTIONAL { ?d wdt:P856 ?site . }
  OPTIONAL { ?d wdt:P973 ?described . }
  OPTIONAL { ?article schema:about ?d ; schema:isPartOf <https://en.wikipedia.org/> . }
}
GROUP BY ?d
ORDER BY ?d
LIMIT ${limit} OFFSET ${offset}`,
  discoveredSources: sourcedEntitySources,
  async map(row) {
    const entity = bindingValue(row, "d");
    const label = bindingValue(row, "label");
    if (!entity || !label || /^Q\d+$/.test(label)) return null;

    const narrative = await resolveSourcedNarrative(row);
    if (!narrative) return null;

    const slug = slugify(label);
    if (!slug) return null;

    const types = bindingValue(row, "types") ?? "";
    const citations = [...new Set([wikidataEntityUrl(entity), ...narrative.citations])];
    const payload: Record<string, unknown> = {
      slug,
      title: label,
      summary: leadText(narrative.text, 280),
      background: narrative.text,
      devotionType: classifyDevotionType(`${label} ${types} ${narrative.text}`),
      practiceInstructions: narrative.text,
      relatedPrayers: [],
      relatedSaints: [],
      citations,
    };
    return {
      contentType: "DEVOTION",
      slug,
      authorityLevel: "TRUSTED_PUBLISHER",
      citations,
      payload,
    };
  },
};

const marianTitleIngestor: StructuredIngestor = {
  contentType: "MARIAN_TITLE",
  id: "wikidata-marian-titles",
  authorityLevel: "TRUSTED_PUBLISHER",
  // Titles / invocations of the Blessed Virgin Mary, enumerated by an
  // instance-of label naming a Marian title. Narrative + cross-reference resolve
  // exactly as for devotions (official source first, Wikipedia last).
  sparql: (limit, offset) =>
    `SELECT ?m (SAMPLE(?mLabel) AS ?label) (SAMPLE(?site) AS ?site) (SAMPLE(?described) AS ?desc) (SAMPLE(?article) AS ?art) WHERE {
  ?m wdt:P31 ?type .
  ?type rdfs:label ?typeLabel . FILTER(LANG(?typeLabel) = "en")
  FILTER(CONTAINS(LCASE(?typeLabel), "title of mary") || CONTAINS(LCASE(?typeLabel), "title of the blessed virgin") || CONTAINS(LCASE(?typeLabel), "marian title") || CONTAINS(LCASE(?typeLabel), "epithet of mary"))
  ?m rdfs:label ?mLabel . FILTER(LANG(?mLabel) = "en")
  OPTIONAL { ?m wdt:P856 ?site . }
  OPTIONAL { ?m wdt:P973 ?described . }
  OPTIONAL { ?article schema:about ?m ; schema:isPartOf <https://en.wikipedia.org/> . }
}
GROUP BY ?m
ORDER BY ?m
LIMIT ${limit} OFFSET ${offset}`,
  discoveredSources: sourcedEntitySources,
  async map(row) {
    const entity = bindingValue(row, "m");
    const label = bindingValue(row, "label");
    if (!entity || !label || /^Q\d+$/.test(label)) return null;

    const narrative = await resolveSourcedNarrative(row);
    if (!narrative) return null;

    const slug = slugify(label);
    if (!slug) return null;

    const citations = [...new Set([wikidataEntityUrl(entity), ...narrative.citations])];
    const payload: Record<string, unknown> = {
      slug,
      title: label,
      summary: leadText(narrative.text, 280),
      origin: narrative.text,
      theologicalSignificance: narrative.text,
      associatedPrayers: [],
      citations,
    };
    return {
      contentType: "MARIAN_TITLE",
      slug,
      authorityLevel: "TRUSTED_PUBLISHER",
      citations,
      payload,
    };
  },
};

type PracticeKind =
  | "contemplative_prayer"
  | "lectio_divina"
  | "examen"
  | "fasting"
  | "almsgiving"
  | "pilgrimage"
  | "stations_of_the_cross"
  | "spiritual_direction"
  | "discernment"
  | "vocation"
  | "mortification"
  | "other";

/**
 * Map a practice's name + sourced text to the schema's `practiceKind` enum, or
 * null when it is NOT a recognised Catholic practice — so the ingestor skips it
 * rather than publish a non-Catholic meditation technique (the schema's explicit
 * accuracy rule). Ordered most-specific first.
 */
export function classifyPracticeKind(text: string): PracticeKind | null {
  const t = text.toLowerCase();
  if (/lectio divina/.test(t)) return "lectio_divina";
  if (/examen|examination of conscience/.test(t)) return "examen";
  if (/stations of the cross|way of the cross|via crucis/.test(t)) return "stations_of_the_cross";
  if (/\bfasting\b|\bfast\b|abstinence/.test(t)) return "fasting";
  if (/almsgiving|\balms\b/.test(t)) return "almsgiving";
  if (/pilgrimage|\bpilgrim\b/.test(t)) return "pilgrimage";
  if (/spiritual direction|spiritual director/.test(t)) return "spiritual_direction";
  if (/\bdiscernment\b/.test(t)) return "discernment";
  if (
    /contemplative prayer|contemplation|eucharistic adoration|\badoration\b|mental prayer/.test(t)
  ) {
    return "contemplative_prayer";
  }
  if (/mortification|\bpenance\b|penitential/.test(t)) return "mortification";
  if (/\bvocation\b/.test(t)) return "vocation";
  return null;
}

const spiritualPracticeIngestor: StructuredIngestor = {
  contentType: "SPIRITUAL_PRACTICE",
  id: "wikidata-spiritual-practices",
  authorityLevel: "TRUSTED_PUBLISHER",
  // Catholic spiritual practices, enumerated broadly by instance-of label and
  // then narrowed by `classifyPracticeKind` (an unrecognised practice is
  // skipped, keeping non-Catholic techniques out). Multi-source narrative as
  // above; the practice's own approved source is preferred over Wikipedia.
  sparql: (limit, offset) =>
    `SELECT ?p (SAMPLE(?pLabel) AS ?label) (SAMPLE(?site) AS ?site) (SAMPLE(?described) AS ?desc) (SAMPLE(?article) AS ?art) WHERE {
  ?p wdt:P31 ?type .
  ?type rdfs:label ?typeLabel . FILTER(LANG(?typeLabel) = "en")
  FILTER(CONTAINS(LCASE(?typeLabel), "spiritual practice") || CONTAINS(LCASE(?typeLabel), "christian practice") || CONTAINS(LCASE(?typeLabel), "ascetical practice") || CONTAINS(LCASE(?typeLabel), "form of prayer"))
  ?p rdfs:label ?pLabel . FILTER(LANG(?pLabel) = "en")
  OPTIONAL { ?p wdt:P856 ?site . }
  OPTIONAL { ?p wdt:P973 ?described . }
  OPTIONAL { ?article schema:about ?p ; schema:isPartOf <https://en.wikipedia.org/> . }
}
GROUP BY ?p
ORDER BY ?p
LIMIT ${limit} OFFSET ${offset}`,
  discoveredSources: sourcedEntitySources,
  async map(row) {
    const entity = bindingValue(row, "p");
    const label = bindingValue(row, "label");
    if (!entity || !label || /^Q\d+$/.test(label)) return null;

    // summary + instructions both require ≥50 chars, so demand a fuller source.
    const narrative = await resolveSourcedNarrative(row, { minChars: 140 });
    if (!narrative) return null;

    const practiceKind = classifyPracticeKind(`${label} ${narrative.text}`);
    if (!practiceKind) return null;

    const slug = slugify(label);
    if (!slug) return null;

    const lead = leadText(narrative.text, 300);
    const summary = lead.length >= 50 ? lead : narrative.text;
    const citations = [...new Set([wikidataEntityUrl(entity), ...narrative.citations])];
    const payload: Record<string, unknown> = {
      slug,
      title: label,
      summary,
      practiceKind,
      instructions: narrative.text,
      relatedPrayers: [],
      relatedSaints: [],
      citations,
    };
    return {
      contentType: "SPIRITUAL_PRACTICE",
      slug,
      authorityLevel: "TRUSTED_PUBLISHER",
      citations,
      payload,
    };
  },
};

const councilIngestor: StructuredIngestor = {
  contentType: "CHURCH_DOCUMENT",
  id: "wikidata-councils",
  authorityLevel: "TRUSTED_PUBLISHER",
  // The ecumenical councils of the Catholic Church — Nicaea through Vatican II —
  // as `council_document` records, so the Church-history timeline fills with the
  // great councils, not just modern encyclicals. The council's inception year
  // (P571) is the historically certain fact and the timeline sorts on it; when
  // the source only records year precision the day is a sortable placeholder
  // (YYYY-01-01), never a fabricated exact date. The narrative is the verbatim,
  // cited Wikipedia abstract. A separate ingestor (not the document one) so its
  // own cursor walks the council corpus; the LRU tiebreak in `pickIngestor` lets
  // both CHURCH_DOCUMENT ingestors run.
  sparql: (limit, offset) =>
    `SELECT ?c (SAMPLE(?cLabel) AS ?label) (SAMPLE(?tv) AS ?inception) (SAMPLE(?prec) AS ?precision) (SAMPLE(?article) AS ?art) (SAMPLE(?canonical) AS ?canon) WHERE {
  ?c wdt:P31 ?type .
  ?type rdfs:label ?tl . FILTER(LANG(?tl) = "en")
  FILTER(CONTAINS(LCASE(?tl), "council") && (CONTAINS(LCASE(?tl), "ecumenical") || CONTAINS(LCASE(?tl), "catholic")))
  ?c rdfs:label ?cLabel . FILTER(LANG(?cLabel) = "en")
  ?c p:P571 ?incSt . ?incSt psv:P571 ?incNode . ?incNode wikibase:timeValue ?tv ; wikibase:timePrecision ?prec .
  ?article schema:about ?c ; schema:isPartOf <https://en.wikipedia.org/> .
  OPTIONAL { ?c wdt:P953 ?canonical . }
}
GROUP BY ?c
ORDER BY ?c
LIMIT ${limit} OFFSET ${offset}`,
  async map(row) {
    const entity = bindingValue(row, "c");
    const label = bindingValue(row, "label");
    if (!entity || !label || /^Q\d+$/.test(label)) return null;

    const inception = bindingValue(row, "inception");
    if (!inception) return null;
    const precision = Number(bindingValue(row, "precision") ?? "0");
    const m = inception.match(/^[+-]?(\d{1,4})-(\d{2})-(\d{2})T/);
    if (!m) return null;
    const year = m[1].padStart(4, "0");
    // Day precision (≥11) keeps the real opening date; coarser precision keeps
    // only the certain year and uses a sortable Jan-1 placeholder.
    const issuedDate = precision >= 11 ? `${year}-${m[2]}-${m[3]}` : `${year}-01-01`;

    const article = bindingValue(row, "art");
    if (!article) return null;
    const summary = await fetchSummaryForArticleUrl(article);
    if (!summary || summary.extract.length < 100) return null;

    const slug = slugify(label);
    if (!slug) return null;

    const canonicalUrl = validUrl(bindingValue(row, "canon")) ?? summary.url;
    const citations = [...new Set([wikidataEntityUrl(entity), summary.url, canonicalUrl])];
    const payload: Record<string, unknown> = {
      slug,
      title: label,
      documentType: "council_document",
      issuingAuthority: "Catholic Church",
      issuedDate,
      summary: summary.extract,
      keyThemes: ["Ecumenical council"],
      canonicalUrl,
      relatedDocuments: [],
      citations,
    };
    return {
      contentType: "CHURCH_DOCUMENT",
      slug,
      authorityLevel: "TRUSTED_PUBLISHER",
      citations,
      payload,
    };
  },
};

/** All registered structured ingestors. Extend this to cover more types. */
export const STRUCTURED_INGESTORS: StructuredIngestor[] = [
  popeIngestor,
  saintIngestor,
  churchDocumentIngestor,
  councilIngestor,
  doctorIngestor,
  riteIngestor,
  devotionIngestor,
  marianTitleIngestor,
  spiritualPracticeIngestor,
];

export function ingestorFor(contentType: string): StructuredIngestor | undefined {
  return STRUCTURED_INGESTORS.find((i) => i.contentType === contentType);
}
