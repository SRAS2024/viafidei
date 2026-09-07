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
import { bindingValue, qidOf, wikidataEntityUrl, type SparqlBinding } from "./wikidata";
import { fetchSummaryForArticleUrl } from "./wikipedia";
import { fetchArticleInfobox } from "./wikipedia-infobox";
import { fetchDocumentExcerpt } from "./document-excerpt";
import {
  feastDayInTextLocalized,
  feastMentionIndexLocalized,
  monthName,
  parseFeastValue,
  type ParsedFeast,
} from "./corroboration";
import {
  CATHOLIC_RELIGION_QIDS,
  CATHOLIC_STATUS_QIDS,
  GENERIC_SAINT_QID,
  SAINT_FACTS_PATTERNS,
  SAINT_FACTS_SELECT,
  composeStructuredBiography,
  deriveSaintType,
  hasCatholicReligion,
  hasNonCatholicReligion,
  parseSaintFacts,
  preferredAltArticle,
  resolveCanonizationStatus,
  saintDisplayTitle,
  type CanonizationStatus,
} from "./saint-facts";

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
   * CHEAP identity of a row — the slug/name the entry WOULD publish under and
   * the entity's QID — computed from the SPARQL row alone, with no network.
   * The orchestrator uses it to skip already-live rows BEFORE any Wikipedia
   * fetch, so a re-sweep of thousands of published rows costs one SPARQL call
   * per page and zero Wikipedia traffic. Optional; ingestors without it are
   * checked after mapping as before.
   */
  identify?(row: SparqlBinding): RowIdentity | null;
  /**
   * Authoritative source URLs the worker should ADD to its own discovery queue
   * from this row (e.g. an entity's official website) — the self-expansion of
   * the knowledge base: the worker learns new places to pull content from as it
   * ingests. Optional; returns [] when the row carries none.
   */
  discoveredSources?(row: SparqlBinding): string[];
}

/** What `identify` returns: any subset, all cheap. */
export interface RowIdentity {
  qid?: string;
  slug?: string;
  name?: string;
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
  identify(row) {
    const label = bindingValue(row, "popeLabel");
    if (!label || /^Q\d+$/.test(label)) return null;
    const title = /\bpope\b/i.test(label) ? label : `Pope ${label}`;
    return {
      qid: qidOf(bindingValue(row, "pope")) ?? undefined,
      slug: `pope-${slugify(label)}`,
      name: title,
    };
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

/** Slug convention for structured saints (shared with `identify`). */
function saintSlugFor(label: string): string | null {
  const base = slugify(label);
  if (!base) return null;
  return base.startsWith("saint-") ? base : `saint-${base}`;
}

/** Human feast text ("August 23") for the composed biography. */
function feastText(feast: ParsedFeast): string {
  return `${monthName(feast.feastMonth)} ${feast.feastDayOfMonth}`;
}

/**
 * The distinct feast days a saint's P841 statements name. Wikidata records
 * several for ~300 saints (General Roman Calendar date + a pre-1969 or
 * regional date), so the ingest must never SAMPLE one at random.
 */
export function parseFeastCandidates(raw: string[]): ParsedFeast[] {
  const out: ParsedFeast[] = [];
  for (const value of raw) {
    const parsed = /^[+-]?\d{4}-\d{2}-\d{2}T/.test(value)
      ? parseFeastValue({ literal: value })
      : parseFeastValue({ label: value });
    if (parsed && !out.some((f) => f.feastDay === parsed.feastDay)) out.push(parsed);
  }
  return out;
}

/** Infobox feast parameter, across the language editions we corroborate in. */
function infoboxFeastValue(infobox: Record<string, string>): string {
  for (const key of [
    "feast_day",
    "feast",
    "feastday",
    "ricorrenza", // itwiki {{Santo}}
    "festividad", // eswiki {{Ficha de santo}}
    "fête", // frwiki {{Infobox Saint}}
    "fete",
    "gedenktag", // dewiki
    "wspomnienie", // plwiki {{Święty infobox}}
  ]) {
    const v = infobox[key];
    if (v && v.trim()) return v.trim();
  }
  return "";
}

/**
 * Choose the ONE feast day to publish and corroborate it against the article
 * (prose OR infobox), in the article's own language.
 *
 * Single Wikidata value: it must be stated in the abstract or the infobox.
 * Several values: only the day the infobox lists FIRST is eligible (the
 * infobox leads with the current calendar date and lists historical dates
 * after it), and it must be one of Wikidata's values — otherwise ambiguous →
 * skip. Prose alone cannot disambiguate a multi-feast saint.
 */
export function chooseCorroboratedFeast(input: {
  candidates: ParsedFeast[];
  abstract: string;
  infobox: Record<string, string>;
  lang: string;
}): ParsedFeast | null {
  const { candidates, abstract, infobox, lang } = input;
  if (candidates.length === 0) return null;
  const infoboxFeast = infoboxFeastValue(infobox);
  if (candidates.length === 1) {
    const f = candidates[0];
    if (feastDayInTextLocalized(f.feastMonth, f.feastDayOfMonth, abstract, lang)) return f;
    if (!infoboxFeast) return null;
    const parsedInfobox =
      lang === "en" ? parseFeastValue({ label: infoboxFeast })?.feastDay : undefined;
    return parsedInfobox === f.feastDay ||
      feastDayInTextLocalized(f.feastMonth, f.feastDayOfMonth, infoboxFeast, lang)
      ? f
      : null;
  }
  if (!infoboxFeast) return null;
  // The FIRST date named in the infobox value decides; find which candidate
  // is stated earliest in that string.
  let best: { feast: ParsedFeast; at: number } | null = null;
  for (const f of candidates) {
    const at = firstFeastMention(f, infoboxFeast, lang);
    if (at >= 0 && (best === null || at < best.at)) best = { feast: f, at };
  }
  return best?.feast ?? null;
}

/** Index of the first mention of a feast in `text` (−1 when absent). */
function firstFeastMention(f: ParsedFeast, text: string, lang: string): number {
  // The exact match position decides which of several corroborated dates the
  // infobox lists FIRST. (A sliding-window "does it appear" test reported the
  // same position for every date in "28 January; 7 March", so Wikidata's
  // arbitrary value order chose the published feast.)
  return feastMentionIndexLocalized(f.feastMonth, f.feastDayOfMonth, text, lang);
}

/**
 * Canonization status for a saint with NO P411 at all (the "Catholic religion
 * + feast day" widening branch): the article's own infobox must state a
 * canonization or beatification date. No date → no status → not published.
 */
function statusFromInfobox(infobox: Record<string, string>): CanonizationStatus | null {
  const dated = (key: string) => /\d{3,4}/.test(infobox[key] ?? "");
  if (dated("canonized_date") || dated("canonised_date") || dated("canonizzazione")) {
    return "canonized";
  }
  if (dated("beatified_date") || dated("beatificazione") || dated("beatificación")) {
    return "beatified";
  }
  return null;
}

/** SPARQL `VALUES` list for a set of QIDs. */
function values(qids: readonly string[]): string {
  return qids.map((q) => `wd:${q}`).join(" ");
}

const CATHOLIC_SPECIFIC_STATUS_QIDS = [
  ...CATHOLIC_STATUS_QIDS.canonized,
  ...CATHOLIC_STATUS_QIDS.beatified,
  ...CATHOLIC_STATUS_QIDS.venerable,
  ...CATHOLIC_STATUS_QIDS.servant_of_god,
];

const saintIngestor: StructuredIngestor = {
  contentType: "SAINT",
  id: "wikidata-saints",
  authorityLevel: "TRUSTED_PUBLISHER",
  // One row per saint (GROUP BY) carrying EVERY status / feast / religion /
  // role statement (never a random SAMPLE), the English Wikipedia article and
  // the it/es/fr/de/pl articles, and the optional official website.
  //
  // Three enumeration branches, each indexed (no label scans):
  //   1. a Catholic-specific P411 status item;
  //   2. the generic "saint" item WITH a Catholic religion (P140) — the generic
  //      item alone is also given to Orthodox / Anglican / Coptic / folk saints;
  //   3. a Catholic religion + feast day and NO P411 at all (status is then
  //      taken from the article's infobox canonization/beatification date).
  sparql: (limit, offset) =>
    `SELECT ${SAINT_FACTS_SELECT} WHERE {
  ?s wdt:P841 ?anyFeast .
  { ?s wdt:P411 ?catholicStatus . VALUES ?catholicStatus { ${values(CATHOLIC_SPECIFIC_STATUS_QIDS)} } }
  UNION
  { ?s wdt:P411 wd:${GENERIC_SAINT_QID} . ?s wdt:P140 ?catholicRel . VALUES ?catholicRel { ${values(CATHOLIC_RELIGION_QIDS)} } }
  UNION
  { ?s wdt:P140 ?catholicRel . VALUES ?catholicRel { ${values(CATHOLIC_RELIGION_QIDS)} } FILTER NOT EXISTS { ?s wdt:P411 [] } }
  ${SAINT_FACTS_PATTERNS}
}
GROUP BY ?s
ORDER BY ?s
LIMIT ${limit} OFFSET ${offset}`,
  discoveredSources(row) {
    const site = bindingValue(row, "site");
    return site ? [site] : [];
  },
  identify(row) {
    const label = bindingValue(row, "label");
    if (!label || /^Q\d+$/.test(label)) return null;
    return {
      qid: qidOf(bindingValue(row, "s")) ?? undefined,
      slug: saintSlugFor(label) ?? undefined,
      name: label,
    };
  },
  async map(row) {
    const facts = parseSaintFacts(row);
    if (!facts) return null;

    // Accuracy guard 1 — status by QID. A generic/Orthodox-only record cannot
    // prove Catholic veneration; skip it (never map it to `canonized`).
    const resolved = resolveCanonizationStatus(facts);
    let canonizationStatus = resolved?.status ?? null;
    const needsInfoboxStatus = !canonizationStatus && facts.statuses.length === 0;
    if (!canonizationStatus && !needsInfoboxStatus) return null;
    // Negative guard: an Orthodox / Anglican / Coptic religion with no Catholic
    // religion is disqualifying unless a Catholic-specific status overrides it.
    if (
      resolved?.basis !== "catholic-status" &&
      hasNonCatholicReligion(facts) &&
      !hasCatholicReligion(facts)
    ) {
      return null;
    }
    if (needsInfoboxStatus && !hasCatholicReligion(facts)) return null;

    const candidates = parseFeastCandidates(facts.feasts);
    if (candidates.length === 0) return null;

    // The article supplies the independent corroboration of the feast day and
    // the second citation. English first; otherwise the preferred non-English
    // edition, whose prose is used for corroboration ONLY.
    const enArticle = facts.enArticle;
    const alt = enArticle ? null : preferredAltArticle(facts.altArticles);
    const articleUrl = enArticle ?? alt?.url ?? null;
    const lang = enArticle ? "en" : (alt?.lang ?? null);
    if (!articleUrl || !lang) return null;
    const summary = await fetchSummaryForArticleUrl(articleUrl);
    if (!summary) return null;
    if (lang === "en" && summary.extract.length < 100) return null;

    // Read the infobox up front: it corroborates the feast, disambiguates a
    // multi-feast saint, supplies the status for branch 3, and enriches the
    // record. Fail-open ({}): a missing infobox just means less corroboration.
    const infobox: Record<string, string> = await fetchArticleInfobox(articleUrl).catch(() => ({}));

    if (needsInfoboxStatus) canonizationStatus = statusFromInfobox(infobox);
    if (!canonizationStatus) return null;

    // Accuracy guard 2 — the feast day MUST also be stated by the article
    // (prose or infobox), and a multi-feast saint only publishes the day the
    // infobox lists first. Anything ambiguous is skipped, never guessed.
    const feast = chooseCorroboratedFeast({
      candidates,
      abstract: summary.extract,
      infobox,
      lang,
    });
    if (!feast) return null;

    const slug = saintSlugFor(facts.label);
    if (!slug) return null;

    // The published biography is ALWAYS English: the enwiki abstract verbatim,
    // or — for a saint with only a non-English article — a short factual
    // biography composed from the entity's own cited statements.
    let biography: string;
    let provenance: Record<string, unknown> | undefined;
    if (lang === "en") {
      biography = summary.extract;
    } else {
      const composed = composeStructuredBiography({
        facts,
        status: canonizationStatus,
        feastText: feastText(feast),
        articleLang: lang,
      });
      if (!composed || composed.length < 100) return null;
      biography = composed;
      provenance = { biography: "structured-facts", articleLanguage: lang };
    }

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
    const birthDate =
      yearish(infobox.birth_date) ??
      (facts.birthYear != null ? String(facts.birthYear) : undefined);
    const deathDate =
      yearish(infobox.death_date) ??
      (facts.deathYear != null ? String(facts.deathYear) : undefined);
    const canonizationDate = yearish(infobox.canonized_date);
    const canonizedBy = (infobox.canonized_by ?? "").trim() || undefined;

    const citations = [wikidataEntityUrl(facts.entityUri), summary.url];
    const payload: Record<string, unknown> = {
      slug,
      // Bare name for dedup; the honorific display title is what the page shows.
      canonicalName: facts.label,
      title: saintDisplayTitle(facts.label, canonizationStatus),
      wikidataQid: facts.qid,
      feastDay: feast.feastDay,
      feastMonth: feast.feastMonth,
      feastDayOfMonth: feast.feastDayOfMonth,
      patronages,
      biography,
      saintType: deriveSaintType(facts, {
        abstract: lang === "en" ? summary.extract : undefined,
        infoboxTitles: infobox.titles,
      }),
      canonizationStatus,
      relatedPrayers: [],
      relatedDevotions: [],
      citations,
    };
    if (birthDate) payload.birthDate = birthDate;
    if (deathDate) payload.deathDate = deathDate;
    if (canonizationDate) payload.canonizationDate = canonizationDate;
    if (canonizedBy && canonizedBy.length <= 80) payload.canonizedBy = canonizedBy;
    if (provenance) payload.provenance = provenance;

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
  | "declaration"
  | "papal_bull";

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
  // The SPARQL enumerates papal bulls (Q189867) too; without this branch the
  // great dogmatic bulls (Unam Sanctam, Ineffabilis Deus, …) took batch slots
  // and were dropped on every pass. `\bbull\b` never matches "bulletin".
  if (/\bpapal bull\b|\bbull\b/.test(t)) return "papal_bull";
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
  # Match the specific document-type items directly (encyclical, apostolic
  # exhortation, apostolic constitution, motu proprio, apostolic letter, papal
  # bull) via the P31 index. The previous "?type rdfs:label ?l . FILTER(CONTAINS
  # (?l, …))" scanned every instance-of label in Wikidata and reliably timed out
  # (60s+), so the whole CHURCH_DOCUMENT type published 0.
  VALUES ?type { wd:Q221409 wd:Q2116256 wd:Q620035 wd:Q18643 wd:Q2731728 wd:Q189867 }
  ?doc wdt:P31 ?type .
  ?type rdfs:label ?typeLabel . FILTER(LANG(?typeLabel) = "en")
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
  // Slug + name straight from the row, so an already-live document (most of
  // this small corpus) costs no Wikipedia summary and no vatican.va excerpt.
  identify(row) {
    const label = bindingValue(row, "label");
    if (!label || /^Q\d+$/.test(label)) return null;
    return {
      qid: qidOf(bindingValue(row, "doc")) ?? undefined,
      slug: slugify(label) || undefined,
      name: label,
    };
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
  # "Doctor of the Church" (Q192499) as award received (P166), matched directly
  # via the index. The old "(P39|P166) ?honor . FILTER(CONTAINS(label,
  # 'doctor of the church'))" scanned every position/award label in Wikidata
  # (P39/P166 are among the most-used properties) and timed out at 60s+; the
  # 37-strong Doctors set is fully covered by curated content, so a fast,
  # precise query is what matters here.
  ?d wdt:P166 wd:Q192499 .
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
  identify(row) {
    const label = bindingValue(row, "label");
    if (!label || /^Q\d+$/.test(label)) return null;
    const base = slugify(label);
    return {
      qid: qidOf(bindingValue(row, "d")) ?? undefined,
      slug: base ? `doctor-${base}` : undefined,
      name: label,
    };
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
  # "liturgical rite" (Q3937326) via the P31 index. The old label-CONTAINS scan
  # over every instance-of type ("sui iuris" / "eastern catholic church" / …)
  # timed out at 60s+ and published 0 rites.
  ?r wdt:P31 wd:Q3937326 .
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
  identify(row) {
    const label = bindingValue(row, "label");
    if (!label || /^Q\d+$/.test(label)) return null;
    const core = riteCoreSlug(label);
    return {
      qid: qidOf(bindingValue(row, "r")) ?? undefined,
      slug: core ? `rite-${core}` : undefined,
      name: label,
    };
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

    // Accuracy guard: the generic "liturgical rite" class (Q3937326) also
    // contains non-Catholic rites (Orthodox / Anglican / Lutheran); only
    // publish ones that read as Catholic / in communion with Rome.
    if (!isCatholicRiteContext(`${label} ${summary.extract}`)) return null;

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
  # Marian devotion (Q1898047) + Catholic devotion (Q3054723) via the P31 index.
  # The old "?type rdfs:label ?l . FILTER(CONTAINS(?l,'devotion'))" scanned every
  # instance-of label in Wikidata and timed out at 60s+, publishing 0 devotions.
  VALUES ?type { wd:Q1898047 wd:Q3054723 }
  ?d wdt:P31 ?type .
  ?type rdfs:label ?typeLabel . FILTER(LANG(?typeLabel) = "en")
  ?d rdfs:label ?dLabel . FILTER(LANG(?dLabel) = "en")
  OPTIONAL { ?d wdt:P856 ?site . }
  OPTIONAL { ?d wdt:P973 ?described . }
  OPTIONAL { ?article schema:about ?d ; schema:isPartOf <https://en.wikipedia.org/> . }
}
GROUP BY ?d
ORDER BY ?d
LIMIT ${limit} OFFSET ${offset}`,
  discoveredSources: sourcedEntitySources,
  identify(row) {
    const label = bindingValue(row, "label");
    if (!label || /^Q\d+$/.test(label)) return null;
    return {
      qid: qidOf(bindingValue(row, "d")) ?? undefined,
      slug: slugify(label) || undefined,
      name: label,
    };
  },
  async map(row) {
    const entity = bindingValue(row, "d");
    const label = bindingValue(row, "label");
    if (!entity || !label || /^Q\d+$/.test(label)) return null;

    // De-overlap with the MARIAN_TITLE ingestor: both draw from the
    // Marian-devotion class (Q1898047). A Marian-title-named entity ("Our Lady
    // …", a Marian "Litany …") is owned by the MARIAN_TITLE ingestor, so skip
    // it here — otherwise the same entity would publish as BOTH a DEVOTION and
    // a MARIAN_TITLE under the same slug.
    if (MARIAN_TITLE_LABEL_RE.test(label)) return null;

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
  # Marian titles / invocations, taken from the Marian-devotion class (Q1898047)
  # and narrowed to title-like entities by name ("Our Lady …", "Madonna …",
  # "Virgin …", a Marian "Litany …"). The name FILTER is applied AFTER the P31
  # index has already reduced to the small Marian-devotion set, so it is fast —
  # unlike the old "?type rdfs:label ?l . FILTER(CONTAINS(?l,'title of mary'))"
  # scan over every instance-of label, which timed out at 60s+.
  ?m wdt:P31 wd:Q1898047 .
  ?m rdfs:label ?mLabel . FILTER(LANG(?mLabel) = "en")
  FILTER(CONTAINS(?mLabel, "Our Lady") || CONTAINS(?mLabel, "Madonna") || CONTAINS(?mLabel, "Virgin") || CONTAINS(?mLabel, "Blessed Virgin") || CONTAINS(?mLabel, "Litany"))
  OPTIONAL { ?m wdt:P856 ?site . }
  OPTIONAL { ?m wdt:P973 ?described . }
  OPTIONAL { ?article schema:about ?m ; schema:isPartOf <https://en.wikipedia.org/> . }
}
GROUP BY ?m
ORDER BY ?m
LIMIT ${limit} OFFSET ${offset}`,
  discoveredSources: sourcedEntitySources,
  identify(row) {
    const label = bindingValue(row, "label");
    if (!label || /^Q\d+$/.test(label)) return null;
    return {
      qid: qidOf(bindingValue(row, "m")) ?? undefined,
      slug: slugify(label) || undefined,
      name: label,
    };
  },
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
/**
 * True only when the text reads as a Catholic/Christian practice. The generic
 * Wikidata "spiritual practice" class (Q2270606) also contains Islamic (dhikr),
 * Mandaean (ṣauma), Breton-folk (pardon), Hindu, Buddhist, and New-Age
 * practices, and `classifyPracticeKind` matches on the practice *kind*
 * (fasting / prayer / pilgrimage) which those share — so without this guard a
 * non-Catholic practice would publish as a Catholic one. Requires a positive
 * Christian signal AND the absence of another religion's signal (skip-on-doubt,
 * consistent with the worker's accuracy-first rule).
 */
/**
 * Label pattern for a Marian title/invocation ("Our Lady …", "Madonna …",
 * a Marian "Litany …", "Virgin …"). Shared so the MARIAN_TITLE ingestor's
 * SPARQL and the DEVOTION ingestor's de-overlap guard use the SAME definition:
 * a Marian-devotion-class entity matching this is published as a MARIAN_TITLE,
 * and the DEVOTION ingestor skips it, so the two never emit the same entity
 * (same slug) under two content types.
 */
export const MARIAN_TITLE_LABEL_RE = /our lady|madonna|blessed virgin|\bvirgin\b|\blitany\b/i;

/**
 * True only when the text reads as a *Catholic* liturgical rite. The generic
 * Wikidata "liturgical rite" class (Q3937326) also contains non-Catholic rites
 * (Eastern Orthodox, Oriental Orthodox, Anglican, Lutheran), so — exactly like
 * the spiritual-practice guard — the rite ingestor must screen for Catholicity
 * or it would publish a non-Catholic rite as a Catholic one (a doctrinal
 * accuracy violation). Accepts an explicit Catholic / in-communion marker;
 * rejects a clear non-Catholic tradition; skips on doubt (accuracy-first).
 */
export function isCatholicRiteContext(text: string): boolean {
  const t = text.toLowerCase();
  if (
    /catholic|sui iuris|sui juris|in full communion|in communion with (rome|the (roman )?catholic|the holy see)|holy see|\bvatican|latin (church|rite)|roman rite|eastern catholic/.test(
      t,
    )
  ) {
    return true;
  }
  // No Catholic marker: reject when it clearly belongs to another tradition;
  // otherwise skip (uncertain → not published).
  return false;
}

export function isCatholicPracticeContext(text: string): boolean {
  const t = text.toLowerCase();
  const otherReligion =
    /\bislam|islamic|muslim|sufi|qur'?an|\bhindu|hinduism|buddhis|\bzen\b|taoism|taoist|shinto|sikh|\bjain|mandaean|mandaeism|pagan|wicca|neopagan|new age|kabbalah|shaman/.test(
      t,
    );
  if (otherReligion) return false;
  const christian =
    /catholic|christian|christ\b|\bchurch\b|\bgospel|\bliturg|sacrament|\bmonast|benedictine|ignatian|carmelite|franciscan|dominican|jesuit|\bmass\b|rosary|eucharist|scripture|\bbible|apostol|\bsaint|holy see|\bvatican|desert father/.test(
      t,
    );
  return christian;
}

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
  # "spiritual practice" (Q2270606) via the P31 index; map()'s
  # classifyPracticeKind then keeps only recognised Catholic practices and skips
  # the rest. The old label-CONTAINS scan over every instance-of type timed out
  # at 60s+ and published 0.
  ?p wdt:P31 wd:Q2270606 .
  ?p rdfs:label ?pLabel . FILTER(LANG(?pLabel) = "en")
  OPTIONAL { ?p wdt:P856 ?site . }
  OPTIONAL { ?p wdt:P973 ?described . }
  OPTIONAL { ?article schema:about ?p ; schema:isPartOf <https://en.wikipedia.org/> . }
}
GROUP BY ?p
ORDER BY ?p
LIMIT ${limit} OFFSET ${offset}`,
  discoveredSources: sourcedEntitySources,
  identify(row) {
    const label = bindingValue(row, "label");
    if (!label || /^Q\d+$/.test(label)) return null;
    return {
      qid: qidOf(bindingValue(row, "p")) ?? undefined,
      slug: slugify(label) || undefined,
      name: label,
    };
  },
  async map(row) {
    const entity = bindingValue(row, "p");
    const label = bindingValue(row, "label");
    if (!entity || !label || /^Q\d+$/.test(label)) return null;

    // summary + instructions both require ≥50 chars, so demand a fuller source.
    const narrative = await resolveSourcedNarrative(row, { minChars: 140 });
    if (!narrative) return null;

    // Accuracy guard: the generic "spiritual practice" class contains other
    // religions' practices; only publish ones that read as Catholic/Christian.
    if (!isCatholicPracticeContext(`${label} ${narrative.text}`)) return null;

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

/**
 * All registered structured ingestors. Extend this to cover more types.
 *
 * There is deliberately NO council ingestor: the twenty-one ecumenical
 * councils are all curated (`knowledge/church-history.ts`), and on Wikidata
 * only Vatican I carries the inception (P571) the query required — so it could
 * never publish anything, yet took a Query-Service round-trip every time the
 * LRU tiebreak picked it. Loosening the query would only have produced
 * duplicates under Wikidata's differing labels ("First Council of Ephesus").
 */
export const STRUCTURED_INGESTORS: StructuredIngestor[] = [
  popeIngestor,
  saintIngestor,
  churchDocumentIngestor,
  doctorIngestor,
  riteIngestor,
  devotionIngestor,
  marianTitleIngestor,
  spiritualPracticeIngestor,
];

export function ingestorFor(contentType: string): StructuredIngestor | undefined {
  return STRUCTURED_INGESTORS.find((i) => i.contentType === contentType);
}
