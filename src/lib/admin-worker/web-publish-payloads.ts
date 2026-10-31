/**
 * Schema-correct publish payloads for web-extracted artifacts (R1).
 *
 * The web path used to publish an artifact's raw extractor fields for every
 * type except PRAYER: a saint went live as {saintName, background, …} with no
 * canonicalName, biography or citations, an apparition as {apparitionTitle,
 * approvalStatus, …}. The same content type was stored in different shapes
 * depending on the path, public pages and derived columns read through
 * fallbacks, and schema rules (≥2 citations, an MM-DD feast, an approvedStatus
 * value, nine novena days) were never checked on this path.
 *
 * This registry maps each web-extractable type's extractor fields onto its zod
 * schema in src/lib/checklist/schemas and validates the result. Every value is
 * the extractor's own field, a deterministic re-statement of one (an "MM-DD"
 * feast as month + day, a prose date as ISO, an honorific as a canonization
 * status), a type the title itself names, or a citation the pipeline actually
 * holds — the source page plus independent pages whose stored cross-source
 * evidence confirmed the artifact. Nothing is invented: a required field the
 * extraction did not produce stays missing and the payload is refused, with
 * the schema's own error naming it.
 *
 * Pure and deterministic; no database access.
 */

import type { ChecklistContentType } from "@prisma/client";

import { validatePayload } from "@/lib/checklist/schemas";
import { canonizationStatusFromHonorific, saintSchemaPayloadFromFields } from "./extractors";
import { buildPrayerPublishPayload, cleanSourceTitle } from "./web-extraction-helpers";

export interface WebPayloadInput {
  /** The artifact's stored display fields (extractor field names). */
  fields: Record<string, unknown>;
  /** The artifact's normalized title — the fallback display title. */
  title: string;
  /** The artifact's normalized slug — the publish identity, kept as-is. */
  slug: string;
  /** Host and URL of the page the artifact was read from. */
  host?: string | null;
  sourceUrl?: string | null;
  /**
   * Independent pages whose stored cross-source evidence confirmed this
   * artifact (MATCH rows on another host). They are the second witness the
   * stricter schemas require.
   */
  corroboratingUrls?: readonly string[];
}

export type WebPayloadFailureCode =
  /** A required field the extraction did not produce (or produced invalid). */
  | "SCHEMA_FIELDS_MISSING"
  /** Every field is there, but fewer citations than the schema requires. */
  | "INSUFFICIENT_CITATIONS"
  /** The type has no schema mapping (not web-publishable). */
  | "NO_SCHEMA_MAPPING";

export type WebPayloadResult =
  | {
      ok: true;
      /** Schema-valid payload (zod defaults applied) plus its sourceUrl. */
      payload: Record<string, unknown>;
      /** The display title the payload names (title / canonicalName). */
      title: string;
    }
  | { ok: false; code: WebPayloadFailureCode; errors: string[] };

type Mapper = (input: WebPayloadInput, citations: string[]) => Record<string, unknown>;

/** Extractor-only types publish under a catalog type (classifier mapping). */
const PUBLISH_TYPE: Readonly<Record<string, ChecklistContentType>> = {
  ROSARY: "SPIRITUAL_PRACTICE",
  CONSECRATION: "SPIRITUAL_PRACTICE",
};

// ── shared helpers ─────────────────────────────────────────────────────

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** Display title: the cleaned field the extractor named it with, else the artifact's. */
function displayTitle(input: WebPayloadInput, field: unknown): string {
  return (
    cleanSourceTitle(str(field), input.host) ??
    cleanSourceTitle(input.title, input.host) ??
    input.title
  );
}

/** The source page first, then independent confirmations; http(s) only, de-duplicated. */
export function webCitations(input: WebPayloadInput): string[] {
  const raw = [
    input.sourceUrl,
    ...(input.corroboratingUrls ?? []),
    ...(Array.isArray(input.fields.citations) ? input.fields.citations : []),
  ];
  return [
    ...new Set(
      raw
        .filter((c): c is string => typeof c === "string")
        .map((c) => c.trim())
        .filter((c) => /^https?:\/\//i.test(c)),
    ),
  ];
}

/**
 * Titles abbreviated before a name, whose period ends no sentence ("St.
 * Ignatius", "Fr. Faber", "Bl. Pier Giorgio"). Read as a sentence end, a
 * practice page opening "St. Ignatius of Loyola taught …" had the summary "St.".
 */
const TITLE_ABBREVIATIONS: ReadonlySet<string> = new Set([
  "st",
  "sts",
  "bl",
  "ven",
  "fr",
  "frs",
  "br",
  "sr",
  "msgr",
  "rev",
  "bp",
  "abp",
  "card",
  "dr",
  "mr",
  "mrs",
  "ms",
  "mt",
]);

/** The first sentence of a passage, verbatim (null when it has none). */
function firstSentence(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const t = text.trim();
  const end = /[.!?](?=\s|$)/g;
  for (let m = end.exec(t); m; m = end.exec(t)) {
    if (m[0] === ".") {
      // The word the period closes: an abbreviated title or an initial
      // ("John H. Newman") continues the sentence.
      const word = (/(\S+)$/.exec(t.slice(0, m.index))?.[1] ?? "").replace(/^[^\p{L}]+/u, "");
      if (/^\p{Lu}$/u.test(word) || TITLE_ABBREVIATIONS.has(word.toLowerCase())) continue;
    }
    return t.slice(0, m.index + 1);
  }
  return undefined;
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

/** "10-04" or "October 4" → the schema's feast shape; null when neither. */
function feastParts(
  v: unknown,
): { feastDay: string; feastMonth: number; feastDayOfMonth: number } | null {
  const s = str(v);
  if (!s) return null;
  let month = NaN;
  let day = NaN;
  const iso = /^(\d{2})-(\d{2})$/.exec(s);
  if (iso) {
    month = Number(iso[1]);
    day = Number(iso[2]);
  } else {
    const named = /^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?$/.exec(s);
    if (named) {
      month = MONTHS.indexOf(named[1].toLowerCase()) + 1;
      day = Number(named[2]);
    }
  }
  if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31)) return null;
  return {
    feastDay: `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    feastMonth: month,
    feastDayOfMonth: day,
  };
}

/** "May 15, 1891" / "15 May 1891" / "1891-05-15" → "1891-05-15"; null otherwise. */
function isoDate(v: unknown): string | undefined {
  const s = str(v);
  if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m =
    /^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/.exec(s) ??
    /^(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([A-Za-z]+),?\s+(\d{4})$/.exec(s);
  if (!m) return undefined;
  const dayFirst = /^\d/.test(m[1]);
  const month = MONTHS.indexOf((dayFirst ? m[2] : m[1]).toLowerCase()) + 1;
  const day = Number(dayFirst ? m[1] : m[2]);
  if (!(month >= 1 && day >= 1 && day <= 31)) return undefined;
  return `${m[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The first four-digit year in a date or period ("1917-1918" → 1917). */
function firstYear(v: unknown): number | undefined {
  const m = /\b(\d{4})\b/.exec(str(v) ?? "");
  return m ? Number(m[1]) : undefined;
}

// ── countries (for "Town, Country" apparition locations) ───────────────

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Names that write a country differently from the ICU region list. */
const COUNTRY_ALIASES = [
  "usa",
  "u s a",
  "united states of america",
  "england",
  "scotland",
  "wales",
  "great britain",
  "holy see",
  "czech republic",
  "ivory coast",
  "democratic republic of the congo",
  "republic of the congo",
  "bosnia and herzegovina",
  "korea",
];

let countryNames: ReadonlySet<string> | null = null;

/** English names of every ISO-3166 region, from the runtime's ICU data. */
function knownCountries(): ReadonlySet<string> {
  if (countryNames) return countryNames;
  const names = new Set<string>(COUNTRY_ALIASES);
  try {
    const display = new Intl.DisplayNames(["en"], { type: "region" });
    for (let a = 65; a <= 90; a++) {
      for (let b = 65; b <= 90; b++) {
        const code = String.fromCharCode(a, b);
        try {
          const name = display.of(code);
          if (name && name !== code) names.add(normalizeName(name));
        } catch {
          // not a region code
        }
      }
    }
  } catch {
    // No ICU region data: only the aliases are recognised.
  }
  countryNames = names;
  return names;
}

/**
 * Split an extracted apparition location ("Lourdes, France") into the place
 * and the country the source itself named. The country is taken only when the
 * last segment IS a country name; nothing is inferred from the town.
 */
function splitLocation(v: unknown): { location?: string; country?: string } {
  const s = str(v);
  if (!s) return {};
  const parts = s
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const last = parts[parts.length - 1];
  if (parts.length >= 2 && knownCountries().has(normalizeName(last))) {
    return { location: parts.slice(0, -1).join(", "), country: last };
  }
  return { location: s };
}

// ── per-type enum cues (from the title the source gave the page) ───────

/**
 * Apparition approval as the extractor captured it ("approved",
 * "recognized", "under investigation", …). "not approved" is NOT mapped: the
 * schema distinguishes non_constat from not_supernatural and the page does
 * not say which, so the field stays missing.
 */
function approvedStatusFor(v: unknown): string | undefined {
  const s = (str(v) ?? "").toLowerCase();
  if (s === "approved" || s === "recognized") return "approved";
  if (s === "under investigation" || s === "under review") return "under_investigation";
  return undefined;
}

/** CHURCH_DOCUMENT documentType from the extractor's historyType (+ title for papal acts). */
function documentTypeFor(historyType: unknown, title: string): string | undefined {
  switch (str(historyType)) {
    case "encyclicals":
      return "encyclical";
    case "councils":
      return "council_document";
    case "catechisms":
      return "catechism_section";
    case "code_of_canon_law":
      return "code_of_canon_law";
    case "major_papal_acts": {
      const t = title.toLowerCase();
      if (t.includes("motu proprio")) return "motu_proprio";
      if (t.includes("apostolic constitution")) return "apostolic_constitution";
      if (t.includes("apostolic exhortation")) return "apostolic_exhortation";
      if (t.includes("apostolic letter")) return "apostolic_letter";
      return undefined;
    }
    default:
      // schisms, foundings, definitions, consecrations: events, not documents.
      return undefined;
  }
}

/** LITURGICAL kind when the page title names one; undefined otherwise. */
const LITURGICAL_KIND_CUES: ReadonlyArray<{ kind: string; cue: RegExp }> = [
  { kind: "optional_memorial", cue: /\boptional memorial\b/i },
  { kind: "memorial", cue: /\bmemorial of\b/i },
  { kind: "solemnity", cue: /\bsolemnity\b/i },
  { kind: "feast", cue: /\bfeast of\b/i },
  { kind: "liturgical_year", cue: /\b(liturgical|church) (year|calendar)\b/i },
  { kind: "liturgical_season", cue: /\b(advent|lent|ordinary time|christmastide|eastertide)\b/i },
  {
    kind: "mass_structure",
    cue: /\b(order of (the )?mass|parts of the mass|structure of the mass)\b/i,
  },
  { kind: "marriage_rite", cue: /\b(rite of marriage|order of celebrating matrimony)\b/i },
  { kind: "funeral_rite", cue: /\b(order of christian funerals|funeral rite|rite of funerals)\b/i },
  { kind: "ordination_rite", cue: /\b(rite of ordination|ordination rite)\b/i },
  { kind: "symbolism", cue: /\bsymbol(ism|s)?\b/i },
  { kind: "glossary_term", cue: /\bglossary\b/i },
];

function liturgicalKindFor(title: string): string | undefined {
  return LITURGICAL_KIND_CUES.find((c) => c.cue.test(title))?.kind;
}

/** SPIRITUAL_PRACTICE kind when the title names one; "other" (the schema's catch-all) otherwise. */
const PRACTICE_KIND_CUES: ReadonlyArray<{ kind: string; cue: RegExp }> = [
  { kind: "lectio_divina", cue: /\blectio divina\b/i },
  { kind: "examen", cue: /\bexamen\b/i },
  { kind: "liturgy_of_the_hours", cue: /\b(liturgy of the hours|divine office)\b/i },
  { kind: "stations_of_the_cross", cue: /\b(stations|way) of the cross\b/i },
  { kind: "spiritual_direction", cue: /\bspiritual direction\b/i },
  { kind: "spiritual_reading", cue: /\bspiritual reading\b/i },
  { kind: "contemplative_prayer", cue: /\bcontemplati(ve|on)\b/i },
  { kind: "eucharistic", cue: /\beucharistic adoration\b/i },
  { kind: "almsgiving", cue: /\balmsgiving\b/i },
  { kind: "fasting", cue: /\bfasting\b/i },
  { kind: "pilgrimage", cue: /\bpilgrimage\b/i },
  { kind: "discernment", cue: /\bdiscernment\b/i },
  { kind: "vocation", cue: /\bvocations?\b/i },
  { kind: "mortification", cue: /\bmortification\b/i },
  { kind: "penance", cue: /\bpenance\b/i },
  { kind: "mercy", cue: /\bworks of mercy\b/i },
  { kind: "silence", cue: /\bsilence\b/i },
];

function practiceKindFor(title: string): string {
  return PRACTICE_KIND_CUES.find((c) => c.cue.test(title))?.kind ?? "other";
}

/** SacramentExtractor key (BAPTISM, HOLY_ORDERS, …) → schema enum. */
function sacramentKeyFor(v: unknown): string | undefined {
  const k = (str(v) ?? "").toLowerCase();
  return [
    "baptism",
    "confirmation",
    "eucharist",
    "reconciliation",
    "anointing_of_the_sick",
    "holy_orders",
    "matrimony",
  ].includes(k)
    ? k
    : undefined;
}

// ── the registry ───────────────────────────────────────────────────────

const MAPPERS: Readonly<Record<string, Mapper>> = {
  SAINT: (input, citations) => {
    const f = input.fields;
    const canonicalName = displayTitle(input, f.saintName);
    const feast = feastParts(f.feastDay);
    const payload = saintSchemaPayloadFromFields(
      {
        ...f,
        saintName: canonicalName,
        feastDay: feast?.feastDay,
        feastMonth: feast?.feastMonth,
        feastDayOfMonth: feast?.feastDayOfMonth,
      } as never,
      {
        citations,
        canonizationStatus:
          canonizationStatusFromHonorific(canonicalName) ??
          canonizationStatusFromHonorific(str(f.saintName)),
      },
    );
    // The artifact's slug is the publish identity (the row, the checklist
    // item and every dedupe check key on it); the payload must agree.
    return { ...payload, slug: input.slug };
  },
  APPARITION: (input, citations) => {
    const f = input.fields;
    const { location, country } = splitLocation(f.apparitionLocation);
    return {
      slug: input.slug,
      title: displayTitle(input, f.apparitionTitle),
      location,
      country,
      approvedStatus: approvedStatusFor(f.approvalStatus),
      yearOfApparition: firstYear(f.apparitionDate),
      summary: str(f.background),
      citations,
    };
  },
  NOVENA: (input, citations) => {
    const f = input.fields;
    const purpose = str(f.purpose);
    const days =
      f.days && typeof f.days === "object" && !Array.isArray(f.days)
        ? Object.entries(f.days as Record<string, { title?: unknown; prayer?: unknown }>)
            .map(([key, d]) => ({
              day: Number(key.replace(/^day/, "")),
              title: str(d?.title),
              prayerText: str(d?.prayer),
              // Each day's meditation is never extracted: it stays missing.
            }))
            .sort((a, b) => a.day - b.day)
        : undefined;
    return {
      slug: input.slug,
      title: displayTitle(input, f.novenaTitle),
      summary: purpose,
      intentionTheme: purpose,
      days,
      citations,
    };
  },
  DEVOTION: (input, citations) => {
    const f = input.fields;
    return {
      slug: input.slug,
      title: displayTitle(input, f.devotionTitle),
      summary: str(f.background),
      devotionType: str(f.devotionType),
      practiceInstructions: str(f.howToPractice),
      citations,
    };
  },
  CHURCH_DOCUMENT: (input, citations) => {
    const f = input.fields;
    const title = displayTitle(input, f.title);
    return {
      slug: input.slug,
      title,
      documentType: documentTypeFor(f.historyType, title),
      // Never extracted from the page: the issuing authority and key themes
      // stay missing rather than guessed from the host or the title.
      issuingAuthority: undefined,
      keyThemes: undefined,
      issuedDate: isoDate(f.dateOrEra),
      summary: str(f.summary),
      canonicalUrl: str(input.sourceUrl),
      citations,
    };
  },
  LITURGICAL: (input, citations) => {
    const f = input.fields;
    const title = displayTitle(input, f.liturgyTitle);
    return {
      slug: input.slug,
      title,
      kind: liturgicalKindFor(title),
      summary: str(f.summary),
      body: str(f.formationBody),
      citations,
    };
  },
  SPIRITUAL_PRACTICE: (input, citations) => {
    const f = input.fields;
    const title = displayTitle(input, f.title);
    const body = str(f.body);
    return {
      slug: input.slug,
      title,
      summary: firstSentence(body),
      practiceKind: practiceKindFor(title),
      instructions: str(f.howToPractice),
      background: body,
      citations,
    };
  },
  // The Rosary and consecration extractors fill their how-to / opening /
  // closing text with fixed worker-written strings, not the page's words, so
  // none of it may become the published summary or instructions: those stay
  // missing and the payload is refused until an extractor reads them.
  ROSARY: (input, citations) => {
    const title = displayTitle(input, input.fields.title);
    return { slug: input.slug, title, practiceKind: practiceKindFor(title), citations };
  },
  CONSECRATION: (input, citations) => {
    const title = displayTitle(input, input.fields.consecrationTitle);
    return { slug: input.slug, title, practiceKind: practiceKindFor(title), citations };
  },
  SACRAMENT: (input, citations) => {
    const f = input.fields;
    return {
      slug: input.slug,
      title: displayTitle(input, f.sacramentTitle),
      sacramentKey: sacramentKeyFor(f.sacramentKey),
      summary: str(f.description),
      preparation: str(f.preparation),
      citations,
    };
  },
  POPE: (input, citations) => {
    const f = input.fields;
    return {
      slug: input.slug,
      title: displayTitle(input, f.popeName),
      papacyStart: str(f.papacyStart),
      papacyEnd: str(f.papacyEnd),
      background: str(f.background),
      citations,
    };
  },
  DOCTOR: (input, citations) => {
    const f = input.fields;
    const feast = feastParts(f.feastDay);
    return {
      slug: input.slug,
      title: displayTitle(input, f.doctorName),
      doctorTitle: str(f.doctorTitle),
      ...(feast ?? {}),
      background: str(f.background),
      citations,
    };
  },
  RITE: (input, citations) => {
    const f = input.fields;
    return {
      slug: input.slug,
      title: displayTitle(input, f.riteName),
      history: str(f.history),
      background: str(f.background),
      citations,
    };
  },
};

/**
 * Schema fields a type's mapping above never fills, because its extractor
 * never reads them from a page (the mapper leaves them missing rather than
 * guess). A refusal naming one of these is a gap of the TYPE, not of the page:
 * every source of the type is refused alike until the extractor learns to read
 * the field, so another source of it is no remedy. Paths are written as the
 * schema reports them, without array indexes ("days.meditation").
 */
const NEVER_EXTRACTED: Readonly<Record<string, readonly string[]>> = {
  NOVENA: ["days.meditation"],
  CHURCH_DOCUMENT: ["issuingAuthority", "keyThemes"],
  SACRAMENT: [
    "theologicalOverview",
    "institution",
    "matterAndForm",
    "minister",
    "recipient",
    "effects",
  ],
  ROSARY: ["summary", "instructions"],
  CONSECRATION: ["summary", "instructions"],
};

/** The catalog type an artifact of this extractor type publishes as. */
export function webPublishType(artifactType: string): string {
  return PUBLISH_TYPE[artifactType] ?? artifactType;
}

/** True when the registry maps this artifact type. */
export function hasWebSchemaMapping(artifactType: string): boolean {
  return artifactType === "PRAYER" || artifactType in MAPPERS;
}

/** The required schema fields this type's web mapping never fills (none for most types). */
export function fieldsNeverExtracted(artifactType: string): readonly string[] {
  return NEVER_EXTRACTED[artifactType] ?? [];
}

/** Errors that only concern the citations array (the count, or a URL in it). */
function citationOnly(errors: string[]): boolean {
  return errors.length > 0 && errors.every((e) => e.startsWith("citations"));
}

/**
 * Map one artifact's fields onto its schema and validate them. Returns the
 * schema-valid payload (zod defaults applied, plus `sourceUrl` for provenance
 * and the publish-safety gate) or the schema's errors, classified: a payload
 * whose only problem is the citation count needs another witness (research),
 * anything else is an extraction gap (repair).
 */
export function buildWebPublishPayload(
  artifactType: string,
  input: WebPayloadInput,
): WebPayloadResult {
  const citations = webCitations(input);
  if (artifactType === "PRAYER") {
    const prayer = buildPrayerPublishPayload({
      fields: input.fields,
      title: input.title,
      slug: input.slug,
      host: input.host,
      sourceUrl: input.sourceUrl,
      corroboratingUrls: input.corroboratingUrls,
    });
    if (!prayer.ok) {
      return {
        ok: false,
        code: citationOnly(prayer.errors) ? "INSUFFICIENT_CITATIONS" : "SCHEMA_FIELDS_MISSING",
        errors: prayer.errors,
      };
    }
    const sourceUrl = str(input.sourceUrl);
    const payload = sourceUrl ? { ...prayer.payload, sourceUrl } : prayer.payload;
    return { ok: true, payload, title: String(prayer.payload.title) };
  }
  const mapper = MAPPERS[artifactType];
  if (!mapper) {
    return {
      ok: false,
      code: "NO_SCHEMA_MAPPING",
      errors: [`${artifactType} has no web publish mapping`],
    };
  }
  const candidate = mapper(input, citations);
  // Drop the keys the mapper left empty so the schema reports them missing.
  for (const [k, v] of Object.entries(candidate)) if (v === undefined) delete candidate[k];
  const validated = validatePayload(
    webPublishType(artifactType) as ChecklistContentType,
    candidate,
  );
  if (!validated.ok) {
    return {
      ok: false,
      code: citationOnly(validated.errors) ? "INSUFFICIENT_CITATIONS" : "SCHEMA_FIELDS_MISSING",
      errors: validated.errors,
    };
  }
  const payload: Record<string, unknown> = { ...candidate, ...validated.data };
  const sourceUrl = str(input.sourceUrl);
  if (sourceUrl) payload.sourceUrl = sourceUrl;
  const title = str(payload.title) ?? str(payload.canonicalName) ?? input.title;
  return { ok: true, payload, title };
}
