/**
 * Structured facts about a saint, read from Wikidata BY QID — the shared
 * vocabulary of the SAINT ingestor (`ingestors.ts`) and the published-saint
 * repair sweep (`saint-repair.ts`).
 *
 * Why QIDs and not labels: the previous ingest mapped the P411 canonization
 * status by label substring, so every item whose English label contains
 * "saint" — the generic "saint" (Q43115, which Wikidata gives to Orthodox,
 * Anglican, Coptic and folk saints alike), "Eastern Orthodox saint", "Anglican
 * saint", "folk saint" — published as a Catholic `canonized`, and the Orthodox
 * monastic honorific "The Venerable" published as the Catholic pre-beatification
 * stage `venerable`. Every rule below is keyed to a specific Wikidata item, and
 * the generic "saint" only counts when the entity's own religion (P140) is the
 * Catholic Church. Nothing here reads prose for a status.
 *
 * Why not prose for the saint TYPE either: a keyword scan of the Wikipedia
 * abstract labelled St Patrick and St Ansgar "apostle" ("Apostle of Ireland"),
 * St John Vianney "virgin" (his abstract mentions the Virgin Mary) and every
 * modern saint "pope" ("canonized by Pope …"). The type is now derived from the
 * entity's positions (P39), occupations (P106), awards (P166), statuses (P411)
 * and the article's own infobox `titles`; prose is consulted only for the
 * unambiguous "martyr" / "Doctor of the Church" phrases, and never for
 * apostle / pope / virgin.
 *
 * Skip-on-doubt throughout: a null status means "cannot prove Catholic
 * veneration from the structured record" and the caller does not publish.
 */

import type { SparqlBinding } from "./wikidata";
import { bindingList, bindingValue, qidOf } from "./wikidata";

export type CanonizationStatus = "canonized" | "beatified" | "venerable" | "servant_of_god";

export type SaintType =
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

/* ── Wikidata items (verified against the live graph on 2026-09-06) ─────── */

/** P411 items that are Catholic-specific canonization statuses. */
export const CATHOLIC_STATUS_QIDS: Record<CanonizationStatus, readonly string[]> = {
  // Catholic saint · canonized saint · pre-congregation saint · canonization
  canonized: ["Q3464126", "Q123110154", "Q18344276", "Q51621"],
  // blessed · beatification
  beatified: ["Q2369287", "Q51620"],
  // Venerable (shared with Orthodox/Protestant usage — see resolve rule)
  venerable: ["Q51619"],
  // Servant of God
  servant_of_god: ["Q869974"],
};

/** The generic "saint" item — Catholic only when P140 says so. */
export const GENERIC_SAINT_QID = "Q43115";

/**
 * P411 items that PROVE a non-Catholic (or non-ecclesial) veneration: the
 * Orthodox "The Venerable", Eastern Orthodox saint, Coptic saint, Anglican
 * saint, folk saint, "list of Eastern Orthodox saints", Right-Believing, New
 * Martyr. Deliberately NOT here: hieromartyr / great martyr / thaumaturge —
 * Orthodox-style titles that Wikidata also gives to pre-schism saints the
 * Catholic Church venerates (St Lawrence carries only "hieromartyr").
 */
export const NON_CATHOLIC_STATUS_QIDS: readonly string[] = [
  "Q12774503",
  "Q108801814",
  "Q108803172",
  "Q7402454",
  "Q5464477",
  "Q6569751",
  "Q4087714",
  "Q2389950",
];

/** P140 items meaning "Catholic". */
export const CATHOLIC_RELIGION_QIDS: readonly string[] = ["Q9592", "Q1841", "Q49376"];

/** P140 items meaning an Orthodox / Anglican / Coptic / Protestant body. */
export const NON_CATHOLIC_RELIGION_QIDS: readonly string[] = [
  "Q3333484", // Eastern Orthodoxy
  "Q35032", // Eastern Orthodox Church
  "Q60995", // Russian Orthodox Church
  "Q7970362", // Greek Orthodoxy
  "Q211004", // Ecumenical Patriarchate of Constantinople
  "Q192173", // Georgian Orthodox Church
  "Q242758", // Bulgarian Orthodox Church
  "Q683724", // Armenian Apostolic Church
  "Q179829", // Ethiopian Orthodox Tewahedo Church
  "Q210540", // Syriac Orthodox Church
  "Q198998", // Coptic Orthodox Church
  "Q49377", // Oriental Orthodox churches
  "Q111464733", // Oriental Orthodoxy
  "Q6423963", // Anglicanism
  "Q82708", // Church of England
  "Q75809", // Lutheranism
];

/** Label fallback for religions whose QID is not enumerated above. */
const NON_CATHOLIC_RELIGION_LABEL_RE =
  /orthodox|anglican|coptic|lutheran|episcopal|protestant|presbyterian|methodist|calvinis|reformed church|church of (england|sweden|norway|denmark|ireland|scotland)/i;

const MARTYR_OCCUPATION_QIDS = ["Q6498826", "Q107013"]; // martyr · Christian martyr
// hieromartyr · great martyr · Reverend Martyr · New Martyr · passion bearer
const MARTYR_STATUS_QIDS = ["Q2993173", "Q3332786", "Q4377390", "Q2389950", "Q2032316"];
const DOCTOR_AWARD_QID = "Q192499";
const APOSTLE_QID = "Q43412";
const EVANGELIST_QID = "Q1381391";
const POPE_QID = "Q19546";
// bishop · Catholic bishop · archbishop · diocesan bishop
const BISHOP_QIDS = ["Q29182", "Q611644", "Q49476", "Q1144278"];
const FOUNDER_QID = "Q4479442";
const MISSIONARY_QID = "Q219477";
const CONSECRATED_VIRGIN_QID = "Q1520404";
const CONFESSOR_STATUS_QID = "Q2354129";
const RELIGIOUS_QIDS = [
  "Q733786", // monk
  "Q191808", // nun
  "Q42603", // priest
  "Q250867", // Catholic priest
  "Q1469535", // Latin Catholic priest
  "Q103163", // abbot
  "Q1646408", // abbess
  "Q548320", // friar
  "Q189829", // hermit
  "Q2138822", // regular cleric
  "Q2109894", // Christian monk
  "Q161944", // deacon
  "Q25393460", // Catholic deacon
  "Q105169902", // Latin Catholic deacon
  "Q831474", // presbyter
];

/** Apostles and evangelists all died in the first century. */
const APOSTOLIC_AGE_LAST_YEAR = 150;

/* ── SPARQL projection shared by the ingestor and the repair sweep ─────── */

/**
 * SELECT columns for the saint facts. `?s` must be the entity variable and the
 * caller must `GROUP BY ?s`.
 */
export const SAINT_FACTS_SELECT = `?s (SAMPLE(?sLabel) AS ?label) (SAMPLE(?sDesc) AS ?description)
  (GROUP_CONCAT(DISTINCT ?feastKey; SEPARATOR="||") AS ?feasts)
  (GROUP_CONCAT(DISTINCT ?statusItem; SEPARATOR="||") AS ?statuses)
  (GROUP_CONCAT(DISTINCT ?religion; SEPARATOR="||") AS ?religions)
  (GROUP_CONCAT(DISTINCT ?religionLabel; SEPARATOR="||") AS ?religionLabels)
  (GROUP_CONCAT(DISTINCT ?position; SEPARATOR="||") AS ?positions)
  (GROUP_CONCAT(DISTINCT ?occupation; SEPARATOR="||") AS ?occupations)
  (GROUP_CONCAT(DISTINCT ?award; SEPARATOR="||") AS ?awards)
  (SAMPLE(?bishopSee) AS ?bishopSee) (SAMPLE(?founded) AS ?founded)
  (SAMPLE(?born) AS ?born) (SAMPLE(?died) AS ?died)
  (SAMPLE(?article) AS ?art) (GROUP_CONCAT(DISTINCT ?altArticle; SEPARATOR="||") AS ?altArts)
  (SAMPLE(?website) AS ?site)`;

/**
 * WHERE patterns for the saint facts (all OPTIONAL except the English label).
 * Feast values are projected as their English calendar-date label when the
 * value is an item ("23 August") and as the raw literal otherwise.
 *
 * COST NOTE — why `bishopSee` / `founded` are `EXISTS` and not OPTIONAL joins.
 * Every OPTIONAL here joins on the same `?s`, so one saint's intermediate
 * result is the CROSS PRODUCT of its statement counts. For John Paul II
 * (Q989: 7 positions × 15 occupations × 29 awards × 11 founded organisations ×
 * 7 episcopal sees × 3 religions × 5 alt articles) that is millions of rows for
 * a single entity, and the Query Service hit its 60s cap and returned HTTP 504
 * even when he was the ONLY entity bound — measured. Both of these facts are
 * read as booleans (`SaintFacts.bishopSee` / `.founded`), never as lists, so
 * asking `EXISTS` instead of joining removes two whole factors from that
 * product and leaves the answer identical. Measured on the same page:
 * 504 after 65s → HTTP 200 in 3.1s for Q989 alone, 8.9s for the 59-entity page
 * containing him. Do NOT turn either back into an OPTIONAL join.
 */
export const SAINT_FACTS_PATTERNS = `?s rdfs:label ?sLabel . FILTER(LANG(?sLabel) = "en")
  BIND(EXISTS { ?s wdt:P39 ?seeItem . ?seeItem wdt:P279* wd:Q29182 } AS ?bishopSee)
  BIND(EXISTS { ?foundedOrg wdt:P112 ?s } AS ?founded)
  OPTIONAL { ?s schema:description ?sDesc . FILTER(LANG(?sDesc) = "en") }
  OPTIONAL { ?s wdt:P841 ?feast . OPTIONAL { ?feast rdfs:label ?feastName0 . FILTER(LANG(?feastName0) = "en") } BIND(COALESCE(?feastName0, STR(?feast)) AS ?feastKey) }
  OPTIONAL { ?s wdt:P411 ?statusItem . }
  OPTIONAL { ?s wdt:P140 ?religion . OPTIONAL { ?religion rdfs:label ?religionLabel . FILTER(LANG(?religionLabel) = "en") } }
  OPTIONAL { ?s wdt:P39 ?position . }
  OPTIONAL { ?s wdt:P106 ?occupation . }
  OPTIONAL { ?s wdt:P166 ?award . }
  OPTIONAL { ?s wdt:P569 ?born . }
  OPTIONAL { ?s wdt:P570 ?died . }
  OPTIONAL { ?article schema:about ?s ; schema:isPartOf <https://en.wikipedia.org/> . }
  OPTIONAL { ?altArticle schema:about ?s ; schema:isPartOf ?altWiki . VALUES ?altWiki { <https://it.wikipedia.org/> <https://es.wikipedia.org/> <https://fr.wikipedia.org/> <https://de.wikipedia.org/> <https://pl.wikipedia.org/> } }
  OPTIONAL { ?s wdt:P856 ?website . }`;

/**
 * One SPARQL query for the full facts of an EXPLICIT set of entities.
 *
 * This is the hydration half of the two-phase saint ingest: the entity set is
 * bounded by `VALUES`, so the aggregate work is proportional to the page rather
 * than to the whole corpus. The projection and patterns are the ones above, so
 * the row shape `parseSaintFacts` consumes is exactly the one it always was.
 */
export function saintFactsSparqlForQids(qids: string[]): string {
  return `SELECT ${SAINT_FACTS_SELECT} WHERE {
  VALUES ?s { ${qids.map((q) => `wd:${q}`).join(" ")} }
  ${SAINT_FACTS_PATTERNS}
}
GROUP BY ?s
ORDER BY ?s`;
}

/** Preference order for a non-English article when there is no enwiki one. */
export const ALT_ARTICLE_LANGS = ["it", "es", "fr", "de", "pl"] as const;

export interface SaintFacts {
  qid: string;
  entityUri: string;
  label: string;
  description: string | null;
  /** Raw feast values ("23 August" labels or date literals). */
  feasts: string[];
  /** P411 items (QIDs). */
  statuses: string[];
  /** P140 items (QIDs) + their English labels. */
  religions: string[];
  religionLabels: string[];
  positions: string[];
  occupations: string[];
  awards: string[];
  bishopSee: boolean;
  founded: boolean;
  birthYear: number | null;
  deathYear: number | null;
  enArticle: string | null;
  altArticles: string[];
  website: string | null;
}

/**
 * Truthiness of a binding that may be an `EXISTS` boolean literal ("true" /
 * "false") or — from an older projection that joined the value — a bound entity
 * URI. Both forms must read the same way: unbound and the literal "false" are
 * false, anything else is true. (`Boolean("false")` is `true` in JS, which is
 * exactly the trap this closes.)
 */
function truthy(value: string | undefined): boolean {
  if (!value) return false;
  return value.toLowerCase() !== "false" && value !== "0";
}

function yearOf(literal: string | undefined): number | null {
  if (!literal) return null;
  const m = literal.match(/^([+-]?)(\d{1,4})-/);
  if (!m) return null;
  const y = Number(m[2]);
  if (!Number.isFinite(y) || y === 0) return null;
  return m[1] === "-" ? -y : y;
}

/** Parse one SPARQL row (projected with SAINT_FACTS_SELECT) into facts. */
export function parseSaintFacts(row: SparqlBinding): SaintFacts | null {
  const entityUri = bindingValue(row, "s");
  const qid = qidOf(entityUri);
  const label = bindingValue(row, "label");
  if (!entityUri || !qid || !label || /^Q\d+$/.test(label)) return null;
  const qids = (key: string) =>
    bindingList(row, key)
      .map((v) => qidOf(v))
      .filter((v): v is string => Boolean(v));
  return {
    qid,
    entityUri,
    label,
    description: bindingValue(row, "description") ?? null,
    feasts: bindingList(row, "feasts"),
    statuses: qids("statuses"),
    religions: qids("religions"),
    religionLabels: bindingList(row, "religionLabels"),
    positions: qids("positions"),
    occupations: qids("occupations"),
    awards: qids("awards"),
    bishopSee: truthy(bindingValue(row, "bishopSee")),
    founded: truthy(bindingValue(row, "founded")),
    birthYear: yearOf(bindingValue(row, "born")),
    deathYear: yearOf(bindingValue(row, "died")),
    enArticle: bindingValue(row, "art") ?? null,
    altArticles: bindingList(row, "altArts"),
    website: bindingValue(row, "site") ?? null,
  };
}

/** Pick the preferred non-English article (it → es → fr → de → pl). */
export function preferredAltArticle(altArticles: string[]): { url: string; lang: string } | null {
  for (const lang of ALT_ARTICLE_LANGS) {
    const url = altArticles.find((u) => u.startsWith(`https://${lang}.wikipedia.org/`));
    if (url) return { url, lang };
  }
  return null;
}

/* ── Status resolution ─────────────────────────────────────────────────── */

const STATUS_RANK: CanonizationStatus[] = ["canonized", "beatified", "venerable", "servant_of_god"];

function hasAny(list: readonly string[], wanted: readonly string[]): boolean {
  return wanted.some((q) => list.includes(q));
}

/** True when P140 carries a Catholic body. */
export function hasCatholicReligion(
  facts: Pick<SaintFacts, "religions" | "religionLabels">,
): boolean {
  return (
    hasAny(facts.religions, CATHOLIC_RELIGION_QIDS) ||
    facts.religionLabels.some((l) => /catholic/i.test(l) && !/old catholic/i.test(l))
  );
}

/** True when P140 carries an Orthodox / Anglican / Coptic / Protestant body. */
export function hasNonCatholicReligion(
  facts: Pick<SaintFacts, "religions" | "religionLabels">,
): boolean {
  return (
    hasAny(facts.religions, NON_CATHOLIC_RELIGION_QIDS) ||
    facts.religionLabels.some((l) => NON_CATHOLIC_RELIGION_LABEL_RE.test(l))
  );
}

/** True when P411 carries a Catholic-specific status item (any rank). */
export function hasCatholicStatus(facts: Pick<SaintFacts, "statuses">): boolean {
  return STATUS_RANK.some((s) => hasAny(facts.statuses, CATHOLIC_STATUS_QIDS[s]));
}

export interface StatusResolution {
  status: CanonizationStatus;
  /** Which rule produced it (for logs / repair reasons). */
  basis: "catholic-status" | "generic-saint-catholic-religion";
}

/**
 * The Catholic canonization status proven by the structured record, or null.
 * Multi-valued P411 (e.g. "blessed" kept alongside "Catholic saint" after a
 * canonization) resolves to the HIGHEST rank, never an arbitrary sample.
 */
export function resolveCanonizationStatus(facts: SaintFacts): StatusResolution | null {
  const nonCatholic = hasNonCatholicReligion(facts) && !hasCatholicReligion(facts);
  for (const status of STATUS_RANK) {
    if (!hasAny(facts.statuses, CATHOLIC_STATUS_QIDS[status])) continue;
    // "Venerable" (Q51619) is also used by Orthodox and Protestant bodies —
    // it only proves the Catholic stage when the record isn't Orthodox-only.
    if (status === "venerable" && nonCatholic) continue;
    return { status, basis: "catholic-status" };
  }
  if (facts.statuses.includes(GENERIC_SAINT_QID) && hasCatholicReligion(facts)) {
    return { status: "canonized", basis: "generic-saint-catholic-religion" };
  }
  return null;
}

/**
 * True when the structured record PROVES the veneration is not Catholic: an
 * explicitly Orthodox / Anglican / Coptic / folk status, or a generic status
 * with an Orthodox / Anglican / Coptic religion — and no Catholic status or
 * religion anywhere on the entity. This is the only condition under which the
 * repair sweep unpublishes; everything weaker is left alone (skip-on-doubt).
 */
export function isProvenNonCatholic(facts: SaintFacts): boolean {
  if (hasCatholicStatus(facts) || hasCatholicReligion(facts)) return false;
  if (hasAny(facts.statuses, NON_CATHOLIC_STATUS_QIDS)) return true;
  return hasNonCatholicReligion(facts);
}

/* ── Saint type ────────────────────────────────────────────────────────── */

export interface SaintTypeContext {
  /** Wikipedia abstract (English); only its first sentence is consulted. */
  abstract?: string;
  /** Infobox `titles` value ("Virgin and Martyr", "Bishop and Confessor"). */
  infoboxTitles?: string;
}

function firstSentence(text: string | undefined): string {
  if (!text) return "";
  const t = text.replace(/\s+/g, " ").trim();
  const m = t.match(/^(.+?[.!?])(?:\s|$)/);
  return (m ? m[1] : t).toLowerCase();
}

/**
 * Derive the schema `saintType` from the structured record (most specific
 * first). Prose is consulted ONLY for "martyr" in the first sentence and the
 * exact phrase "Doctor of the Church"; apostle / pope / virgin never come from
 * prose. Falls back to the always-valid "other".
 */
export function deriveSaintType(facts: SaintFacts, ctx: SaintTypeContext = {}): SaintType {
  const titles = (ctx.infoboxTitles ?? "").toLowerCase();
  const lead = firstSentence(ctx.abstract);
  const roles = [...facts.positions, ...facts.occupations];

  if (
    hasAny(facts.occupations, MARTYR_OCCUPATION_QIDS) ||
    hasAny(facts.statuses, MARTYR_STATUS_QIDS) ||
    /\bmartyr/.test(titles) ||
    /\bmartyr/.test(lead)
  ) {
    return "martyr";
  }
  if (facts.awards.includes(DOCTOR_AWARD_QID) || /doctor of the church/.test(lead)) {
    return "doctor_of_the_church";
  }
  // "Apostle" is also an honorific position ("Apostle of the Indies" on
  // Francis Xavier), so it needs the apostolic-age death year as well.
  const apostolicAge = facts.deathYear != null && facts.deathYear <= APOSTOLIC_AGE_LAST_YEAR;
  if (roles.includes(APOSTLE_QID) && apostolicAge) return "apostle";
  if (facts.occupations.includes(EVANGELIST_QID) && apostolicAge) return "evangelist";
  if (facts.positions.includes(POPE_QID)) return "pope";
  if (hasAny(roles, BISHOP_QIDS) || facts.bishopSee) return "bishop";
  if (facts.founded || facts.occupations.includes(FOUNDER_QID)) return "founder";
  if (facts.occupations.includes(MISSIONARY_QID)) return "missionary";
  if (facts.statuses.includes(CONSECRATED_VIRGIN_QID) || /\bvirgin\b/.test(titles)) {
    return "virgin";
  }
  if (hasAny(facts.occupations, RELIGIOUS_QIDS)) return "religious";
  if (facts.statuses.includes(CONFESSOR_STATUS_QID) || /\bconfessor\b/.test(titles)) {
    return "confessor";
  }
  // Low-risk prose fallbacks for the descriptive kinds only.
  if (/\b(founder|foundress|co-founder)\b|\bfounded the\b/.test(lead)) return "founder";
  if (/\bmissionar/.test(lead)) return "missionary";
  if (/\b(priest|monk|nun|friar|abbot|abbess|hermit|religious order)\b/.test(lead)) {
    return "religious";
  }
  return "other";
}

/* ── Display title ─────────────────────────────────────────────────────── */

const HONORIFIC_PREFIX_RE =
  /^(saint|st\.?|blessed|bl\.?|venerable|ven\.?|servant of god|pope|antipope|blessed virgin)\b/i;

/**
 * The display title for a structured saint: the bare Wikidata label prefixed
 * with the honorific its canonization status earns ("Saint Rose of Lima",
 * "Blessed Anne of Saint Bartholomew"), unless the label already carries one.
 * The bare label stays in `canonicalName` for dedup (normalizeName strips the
 * prefix anyway).
 */
export function saintDisplayTitle(label: string, status: CanonizationStatus): string {
  const name = label.trim();
  if (HONORIFIC_PREFIX_RE.test(name)) return name;
  switch (status) {
    case "canonized":
      return `Saint ${name}`;
    case "beatified":
      return `Blessed ${name}`;
    case "venerable":
      return `Venerable ${name}`;
    case "servant_of_god":
      return `Servant of God ${name}`;
  }
}

/* ── English biography from structured facts (non-English article branch) ── */

const STATUS_PHRASE: Record<CanonizationStatus, string> = {
  canonized: "a saint",
  beatified: "a Blessed (beatified)",
  venerable: "a Venerable (declared of heroic virtue)",
  servant_of_god: "a Servant of God",
};

const LANG_NAME: Record<string, string> = {
  it: "Italian",
  es: "Spanish",
  fr: "French",
  de: "German",
  pl: "Polish",
};

/**
 * Compose a short, factual ENGLISH biography from structured, cited facts for
 * a saint whose only Wikipedia article is in another language. Nothing is
 * inferred: the description is Wikidata's own English description, the years
 * and feast are the entity's own statements, and the article is named as the
 * fuller source. Returns null when there is no description to build on (a
 * name and a date alone are not a biography).
 */
export function composeStructuredBiography(input: {
  facts: SaintFacts;
  status: CanonizationStatus;
  feastText: string;
  articleLang: string;
}): string | null {
  const { facts } = input;
  const desc = (facts.description ?? "").trim().replace(/\.$/, "");
  if (desc.length < 12) return null;
  const years =
    facts.birthYear != null && facts.deathYear != null
      ? ` (${facts.birthYear}–${facts.deathYear})`
      : facts.deathYear != null
        ? ` (died ${facts.deathYear})`
        : "";
  const article = /^[aeiou]/i.test(desc) ? `an ${desc}` : `a ${desc}`;
  const langName = LANG_NAME[input.articleLang] ?? input.articleLang;
  return (
    `${facts.label}${years} was ${article}. ` +
    `The Catholic Church venerates ${facts.label} as ${STATUS_PHRASE[input.status]}; ` +
    `the feast day is ${input.feastText}. ` +
    `A fuller biography is recorded in the ${langName}-language Wikipedia article and on Wikidata.`
  );
}
