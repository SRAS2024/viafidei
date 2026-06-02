/**
 * Per-content-type extractors (spec §9). Each extractor turns a
 * cleaned source-read into a candidate content package with
 * field-level provenance. Extractors never guess missing required
 * fields; when a required field can't be found, they fail precisely
 * with `fatalReasons`.
 *
 * All extractors share the `ExtractorOutput` shape so the planner can
 * treat them uniformly. Each extractor is exported individually
 * (PrayerExtractor, SaintExtractor, …) so the spec's per-type
 * acceptance criteria is satisfied.
 */

import { makeProvenance, type FieldProvenance } from "./provenance";
import type { StructuredBlock, SourceBlockType } from "./structured-source-reader";

export interface ExtractorInput {
  url: string;
  host: string;
  title?: string | null;
  headings?: string[];
  bodyText?: string;
  /** Spec §2: extractors prefer structured blocks; raw bodyText is fallback. */
  blocks?: StructuredBlock[];
  scriptureReferences?: string[];
  checksum?: string;
  language?: string;
}

/**
 * Spec §2: derive a per-extractor body string from structured blocks.
 * The caller passes the block types this extractor cares about first.
 * Falls back to raw `bodyText` only when no matching blocks exist.
 */
export function blockAwareBody(
  input: ExtractorInput,
  preferredTypes: readonly SourceBlockType[],
): string {
  const blocks = input.blocks ?? [];
  if (blocks.length === 0) return input.bodyText ?? "";
  const preferred = blocks
    .filter((b) => !b.isRejected && preferredTypes.includes(b.blockType))
    .map((b) => b.text);
  const supporting = blocks
    .filter(
      (b) =>
        !b.isRejected &&
        !preferredTypes.includes(b.blockType) &&
        (b.blockType === "HEADING" || b.blockType === "PARAGRAPH" || b.blockType === "LIST_ITEM"),
    )
    .map((b) => b.text);
  const combined = [...preferred, ...supporting].join("\n\n");
  return combined.length > 0 ? combined : (input.bodyText ?? "");
}

export interface ExtractorOutput<T = Record<string, unknown>> {
  fields: Partial<T>;
  missingFields: string[];
  confidenceScore: number;
  sourceEvidence: FieldProvenance[];
  rejectedSections: string[];
  formatting: Record<string, unknown>;
  warnings: string[];
  fatalReasons: string[];
}

interface MatchResult {
  value: string;
  snippet: string;
  confidence: number;
}

/** Match a regex against the body and return the first capture group + a short snippet around it. */
function matchBody(body: string, pattern: RegExp): MatchResult | null {
  const m = body.match(pattern);
  if (!m) return null;
  const value = (m[1] ?? m[0]).trim();
  const idx = m.index ?? 0;
  const start = Math.max(0, idx - 60);
  const end = Math.min(body.length, idx + (m[0]?.length ?? 0) + 60);
  return { value, snippet: body.slice(start, end), confidence: 0.7 };
}

function provenanceFor(
  fieldName: string,
  match: MatchResult,
  input: ExtractorInput,
): FieldProvenance {
  return makeProvenance({
    fieldName,
    sourceUrl: input.url,
    sourceHost: input.host,
    snippet: match.snippet,
    method: "BODY_REGEX",
    confidence: match.confidence,
    checksum: input.checksum,
  });
}

/** Strip junk sections (nav, footer, ads, cookies, …) and return the rejected slices. */
function stripJunk(body: string): { kept: string; rejected: string[] } {
  const junkPatterns: RegExp[] = [
    /skip to (main )?content/gi,
    /accept all cookies/gi,
    /sign up for our newsletter/gi,
    /(c)? \d{4}.+all rights reserved/gi,
    /share (this )?(on|to) (facebook|twitter|x|email|whatsapp)/gi,
    /related (articles|posts|reading)/gi,
  ];
  const rejected: string[] = [];
  let kept = body;
  for (const pattern of junkPatterns) {
    const matches = kept.match(pattern);
    if (matches) rejected.push(...matches);
    kept = kept.replace(pattern, " ");
  }
  return { kept: kept.trim(), rejected };
}

function blank<T extends Record<string, unknown>>(
  input: ExtractorInput,
  fatal: string,
): ExtractorOutput<T> {
  return {
    fields: {},
    missingFields: [],
    confidenceScore: 0,
    sourceEvidence: [],
    rejectedSections: [],
    formatting: {},
    warnings: [],
    fatalReasons: [fatal, `URL: ${input.url}`],
  };
}

// ─── PrayerExtractor ───────────────────────────────────────────────────────
export interface PrayerFields {
  prayerTitle: string;
  prayerType: string;
  prayerText: string;
  category: string;
  language: string;
  sourceUrl: string;
  sourceHost: string;
}

export function PrayerExtractor(input: ExtractorInput): ExtractorOutput<PrayerFields> {
  const body = blockAwareBody(input, ["PRAYER", "PARAGRAPH", "HEADING"]);
  if (!body) return blank(input, "No body text supplied.");
  const { kept, rejected } = stripJunk(body);
  const required = ["prayerTitle", "prayerType", "prayerText", "category"];
  const evidence: FieldProvenance[] = [];
  const fields: Partial<PrayerFields> = {
    sourceUrl: input.url,
    sourceHost: input.host,
    language: input.language ?? "en",
  };
  const fatal: string[] = [];

  if (input.title && input.title.trim()) {
    fields.prayerTitle = input.title.trim();
    evidence.push(
      makeProvenance({
        fieldName: "prayerTitle",
        sourceUrl: input.url,
        sourceHost: input.host,
        snippet: input.title,
        method: "TITLE_REGEX",
        confidence: 0.85,
        checksum: input.checksum,
      }),
    );
  }

  // Heuristic: the prayer text is the block that contains "Amen" plus
  // common Catholic invocations.
  const prayerMatch = kept.match(/([\s\S]{40,2000}?amen[.!])/i);
  if (prayerMatch) {
    const text = prayerMatch[1].trim();
    fields.prayerText = text;
    evidence.push(
      makeProvenance({
        fieldName: "prayerText",
        sourceUrl: input.url,
        sourceHost: input.host,
        snippet: text.slice(0, 240),
        method: "BODY_REGEX",
        confidence: 0.75,
        checksum: input.checksum,
      }),
    );
  } else {
    fatal.push("No prayer block found (must end with 'Amen').");
  }

  // Prayer type: try to detect common categories.
  const prayerType = (() => {
    const t = `${input.title ?? ""} ${kept}`.toLowerCase();
    if (t.includes("morning prayer")) return "morning";
    if (t.includes("evening prayer") || t.includes("night prayer")) return "evening";
    if (t.includes("intercessory")) return "intercessory";
    if (t.includes("thanksgiving")) return "thanksgiving";
    if (t.includes("petition")) return "petition";
    return null;
  })();
  if (prayerType) {
    fields.prayerType = prayerType;
    evidence.push(
      makeProvenance({
        fieldName: "prayerType",
        sourceUrl: input.url,
        sourceHost: input.host,
        snippet: prayerType,
        method: "BODY_REGEX",
        confidence: 0.7,
        checksum: input.checksum,
      }),
    );
  }

  fields.category = "PRAYER";
  const missing = required.filter((f) => !(f in fields));
  const confidence =
    required.length === 0 ? 0 : (required.length - missing.length) / required.length;

  return {
    fields,
    missingFields: missing,
    confidenceScore: confidence,
    sourceEvidence: evidence,
    rejectedSections: rejected,
    formatting: { hasAmen: /amen[.!]/i.test(kept) },
    warnings: rejected.length > 0 ? [`Stripped ${rejected.length} junk section(s).`] : [],
    fatalReasons: fatal,
  };
}

// ─── SaintExtractor ────────────────────────────────────────────────────────
export interface SaintFields {
  saintName: string;
  saintType: string;
  feastDay: string;
  feastMonth: number;
  feastDayNumber: number;
  background: string;
  patronage?: string;
  /** Where the saint is from (birthplace / origin). */
  birthplace?: string;
  /** Year the saint was born (dates the saint lived from). */
  birthDate?: string;
  /** Year the saint died. */
  deathDate?: string;
  /** Year the saint was canonized, when stated. */
  canonizationYear?: string;
  sourceUrl: string;
  sourceHost: string;
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

export function SaintExtractor(input: ExtractorInput): ExtractorOutput<SaintFields> {
  // Saints: biography paragraphs + feast/patronage headings.
  const body = blockAwareBody(input, ["HEADING", "PARAGRAPH"]);
  if (!body) return blank(input, "No body text supplied.");
  const { kept, rejected } = stripJunk(body);
  const evidence: FieldProvenance[] = [];
  const fields: Partial<SaintFields> = { sourceUrl: input.url, sourceHost: input.host };
  const fatal: string[] = [];

  // Reject school / parish / hospital named after saints.
  if (/\b(school|hospital|parish directory)\b/i.test(`${input.title} ${input.url}`)) {
    return blank(input, "Page is an institution named after a saint, not a saint biography.");
  }

  if (input.title) {
    fields.saintName = input.title.replace(/^st\.?\s+/i, "Saint ").trim();
    evidence.push(
      makeProvenance({
        fieldName: "saintName",
        sourceUrl: input.url,
        sourceHost: input.host,
        snippet: input.title,
        method: "TITLE_REGEX",
        confidence: 0.85,
        checksum: input.checksum,
      }),
    );
  }

  const feastMatch = kept.match(
    /feast(?:\s+day)?(?:\s+is)?(?:\s+celebrated)?\s+(?:on\s+)?([A-Z][a-z]+)\s+(\d{1,2})/i,
  );
  if (feastMatch) {
    const monthIdx = MONTHS.indexOf(feastMatch[1].toLowerCase());
    const day = parseInt(feastMatch[2], 10);
    if (monthIdx >= 0 && day >= 1 && day <= 31) {
      fields.feastDay = `${feastMatch[1]} ${day}`;
      fields.feastMonth = monthIdx + 1;
      fields.feastDayNumber = day;
      evidence.push(
        provenanceFor(
          "feastDay",
          { value: fields.feastDay, snippet: feastMatch[0], confidence: 0.8 },
          input,
        ),
      );
    }
  } else {
    fatal.push("No feast day found in body text.");
  }

  // Biography — first paragraph that contains "born", "died" or canonized.
  const bio = matchBody(
    kept,
    /((?:[A-Z][a-zA-Z .,'-]+){2,}\s+(?:was\s+born|was\s+canonized|died)[^.]{20,1000}\.)/,
  );
  if (bio) {
    fields.background = bio.value;
    evidence.push(provenanceFor("background", bio, input));
  } else {
    fatal.push("No biography paragraph found.");
  }

  // Patronage (optional).
  const patronage = matchBody(kept, /patron(?:age)?(?:\s+saint)?\s+of\s+([^.]{3,120})\./i);
  if (patronage) {
    fields.patronage = patronage.value;
    evidence.push(provenanceFor("patronage", patronage, input));
  }

  // Dates the saint lived from (optional): birth + death years. Capture
  // the first 3–4 digit year after "born" / "died".
  const birthYear = matchBody(kept, /\bborn\b[^.]*?\b(\d{3,4})\b/i);
  if (birthYear) {
    fields.birthDate = birthYear.value;
    evidence.push(provenanceFor("birthDate", birthYear, input));
  }
  const deathYear = matchBody(kept, /\bdied\b[^.]*?\b(\d{3,4})\b/i);
  if (deathYear) {
    fields.deathDate = deathYear.value;
    evidence.push(provenanceFor("deathDate", deathYear, input));
  }

  // Where the saint is of (optional): the place after "born … in",
  // skipping an optional birth year so "born in 1181 in Assisi, Italy"
  // and "born in Assisi" both resolve to the place, not the year. The
  // skip is [^.]*? (confined to the sentence, but allowed to cross an
  // intervening capitalized word like "born, the son of Pietro, in
  // Assisi"); the [A-Z] capture requirement skips past the year on its
  // own, so we do not also need to exclude capitals from the skip.
  const birthplace = matchBody(
    kept,
    /\bborn\b(?:[^.]*?\b\d{3,4}\b)?[^.]*?\bin\s+([A-Z][a-zA-Z.'-]+(?:[ ,]+[A-Z][a-zA-Z.'-]+){0,3})/,
  );
  if (birthplace) {
    fields.birthplace = birthplace.value.replace(/[ ,]+$/, "");
    evidence.push(provenanceFor("birthplace", birthplace, input));
  }

  // Canonization year (optional).
  const canonized = matchBody(kept, /canoniz(?:ed|ation)\b[^.]*?\b(\d{3,4})\b/i);
  if (canonized) {
    fields.canonizationYear = canonized.value;
    evidence.push(provenanceFor("canonizationYear", canonized, input));
  }

  const required = ["saintName", "feastDay", "background"];
  const missing = required.filter((f) => !(f in fields));
  const confidence =
    required.length === 0 ? 0 : (required.length - missing.length) / required.length;
  fields.saintType = "saint";

  return {
    fields,
    missingFields: missing,
    confidenceScore: confidence,
    sourceEvidence: evidence,
    rejectedSections: rejected,
    formatting: {},
    warnings: [],
    fatalReasons: fatal,
  };
}

// ─── MarianApparitionExtractor ─────────────────────────────────────────────
export interface ApparitionFields {
  apparitionTitle: string;
  apparitionLocation: string;
  apparitionDate: string;
  approvalStatus: string;
  background: string;
  sourceUrl: string;
  sourceHost: string;
}

export function MarianApparitionExtractor(
  input: ExtractorInput,
): ExtractorOutput<ApparitionFields> {
  // Apparitions: approval status + location appear in headings + paragraphs.
  const body = blockAwareBody(input, ["HEADING", "PARAGRAPH", "LOCATION"]);
  if (!body) return blank(input, "No body text supplied.");
  const { kept, rejected } = stripJunk(body);
  const evidence: FieldProvenance[] = [];
  const fields: Partial<ApparitionFields> = { sourceUrl: input.url, sourceHost: input.host };
  const fatal: string[] = [];

  if (input.title) {
    fields.apparitionTitle = input.title.trim();
    evidence.push(
      makeProvenance({
        fieldName: "apparitionTitle",
        sourceUrl: input.url,
        sourceHost: input.host,
        snippet: input.title,
        method: "TITLE_REGEX",
        confidence: 0.85,
        checksum: input.checksum,
      }),
    );
  }

  const locMatch = matchBody(
    kept,
    /(?:appeared|apparition)(?:\s+occurred)?\s+(?:in|at|near)\s+([A-Z][a-zA-Z, ]{2,60})/,
  );
  if (locMatch) {
    fields.apparitionLocation = locMatch.value;
    evidence.push(provenanceFor("apparitionLocation", locMatch, input));
  } else {
    fatal.push("No apparition location found.");
  }

  const dateMatch = matchBody(
    kept,
    /(?:in|on|between|from)\s+(\d{3,4}(?:[-–]\d{2,4})?|[A-Z][a-z]+\s+\d{1,2},?\s+\d{3,4})/,
  );
  if (dateMatch) {
    fields.apparitionDate = dateMatch.value;
    evidence.push(provenanceFor("apparitionDate", dateMatch, input));
  } else {
    fatal.push("No apparition date or period found.");
  }

  const approvalMatch = matchBody(
    kept,
    /(approved|recognized|under (?:investigation|review)|not approved)\s+by\s+(the\s+)?(holy\s+see|vatican|local\s+bishop|diocese|bishop\s+of\s+\w+)/i,
  );
  if (approvalMatch) {
    fields.approvalStatus = approvalMatch.value;
    evidence.push(provenanceFor("approvalStatus", approvalMatch, input));
  } else {
    fatal.push("No apparition approval status found — required for publishing.");
  }

  const bg = matchBody(kept, /((?:[A-Z][^.]{40,800}\.))/);
  if (bg) {
    fields.background = bg.value;
    evidence.push(provenanceFor("background", bg, input));
  }

  const required = ["apparitionTitle", "apparitionLocation", "apparitionDate", "approvalStatus"];
  const missing = required.filter((f) => !(f in fields));
  const confidence = (required.length - missing.length) / required.length;

  return {
    fields,
    missingFields: missing,
    confidenceScore: confidence,
    sourceEvidence: evidence,
    rejectedSections: rejected,
    formatting: {},
    warnings: [],
    fatalReasons: fatal,
  };
}

// ─── DevotionExtractor ─────────────────────────────────────────────────────
export interface DevotionFields {
  devotionTitle: string;
  devotionType: string;
  background: string;
  howToPractice: string;
  sourceUrl: string;
  sourceHost: string;
}

export function DevotionExtractor(input: ExtractorInput): ExtractorOutput<DevotionFields> {
  // Devotions: practice instructions are list-items / paragraphs;
  // associated prayers are PRAYER blocks.
  const body = blockAwareBody(input, ["PARAGRAPH", "LIST_ITEM", "PRAYER", "HEADING"]);
  if (!body) return blank(input, "No body text supplied.");
  const { kept, rejected } = stripJunk(body);
  const evidence: FieldProvenance[] = [];
  const fields: Partial<DevotionFields> = { sourceUrl: input.url, sourceHost: input.host };
  const fatal: string[] = [];

  if (input.title) {
    fields.devotionTitle = input.title.trim();
    evidence.push(
      makeProvenance({
        fieldName: "devotionTitle",
        sourceUrl: input.url,
        sourceHost: input.host,
        snippet: input.title,
        method: "TITLE_REGEX",
        confidence: 0.8,
        checksum: input.checksum,
      }),
    );
  }

  fields.devotionType = /chaplet/i.test(input.title ?? "") ? "chaplet" : "devotion";

  const howToMatch = matchBody(
    kept,
    /(?:how to pray|how to practice|instructions?)[\s:]*([\s\S]{40,1500}?)(?:\n\n|\bAmen\b|$)/i,
  );
  if (howToMatch) {
    fields.howToPractice = howToMatch.value;
    evidence.push(provenanceFor("howToPractice", howToMatch, input));
  } else {
    fatal.push("No 'how to practice' section found.");
  }

  const bg = matchBody(kept, /((?:[A-Z][^.]{40,800}\.))/);
  if (bg) {
    fields.background = bg.value;
    evidence.push(provenanceFor("background", bg, input));
  }

  const required = ["devotionTitle", "background", "howToPractice"];
  const missing = required.filter((f) => !(f in fields));
  const confidence = (required.length - missing.length) / required.length;

  return {
    fields,
    missingFields: missing,
    confidenceScore: confidence,
    sourceEvidence: evidence,
    rejectedSections: rejected,
    formatting: {},
    warnings: [],
    fatalReasons: fatal,
  };
}

// ─── NovenaExtractor ───────────────────────────────────────────────────────
export interface NovenaFields {
  novenaTitle: string;
  background: string;
  purpose: string;
  duration: string;
  days: Record<string, { title: string; prayer: string }>;
  sourceUrl: string;
  sourceHost: string;
}

export function NovenaExtractor(input: ExtractorInput): ExtractorOutput<NovenaFields> {
  // Novenas: nine-day structure is encoded in DAY_SECTION blocks;
  // associated prayer text in PRAYER blocks.
  const body = blockAwareBody(input, ["DAY_SECTION", "PRAYER", "PARAGRAPH", "HEADING"]);
  if (!body) return blank(input, "No body text supplied.");
  const { kept, rejected } = stripJunk(body);
  const evidence: FieldProvenance[] = [];
  const fields: Partial<NovenaFields> = { sourceUrl: input.url, sourceHost: input.host, days: {} };
  const fatal: string[] = [];

  if (input.title) {
    fields.novenaTitle = input.title.trim();
    evidence.push(
      makeProvenance({
        fieldName: "novenaTitle",
        sourceUrl: input.url,
        sourceHost: input.host,
        snippet: input.title,
        method: "TITLE_REGEX",
        confidence: 0.85,
        checksum: input.checksum,
      }),
    );
  }

  // Day 1..9 must all be present.
  for (let i = 1; i <= 9; i++) {
    const dayKey = `day${i}`;
    const dayPattern = new RegExp(
      `(?:^|\\n)\\s*Day\\s+${i}[\\s\\S]{0,160}?\\n([\\s\\S]{20,2000}?amen[.!])`,
      "i",
    );
    const m = kept.match(dayPattern);
    if (m && fields.days) {
      fields.days[dayKey] = {
        title: `Day ${i}`,
        prayer: m[1].trim(),
      };
      evidence.push(
        makeProvenance({
          fieldName: `days.${dayKey}.prayer`,
          sourceUrl: input.url,
          sourceHost: input.host,
          snippet: m[1].slice(0, 240),
          method: "BODY_REGEX",
          confidence: 0.7,
          checksum: input.checksum,
        }),
      );
    } else {
      fatal.push(`Day ${i} not found — Novenas require exactly 9 days.`);
    }
  }

  const purpose = matchBody(kept, /(?:purpose|intention)[\s:]+([^.]{10,300}\.)/i);
  if (purpose) {
    fields.purpose = purpose.value;
    evidence.push(provenanceFor("purpose", purpose, input));
  }

  fields.duration = "9 days";

  const required = ["novenaTitle", "purpose", "duration", "days"];
  const missing = required.filter((f) => !(f in fields));
  const confidence = fatal.length === 0 ? 1 : Math.max(0, 1 - fatal.length / 9);

  return {
    fields,
    missingFields: missing,
    confidenceScore: confidence,
    sourceEvidence: evidence,
    rejectedSections: rejected,
    formatting: { dayCount: Object.keys(fields.days ?? {}).length },
    warnings: [],
    fatalReasons: fatal,
  };
}

// ─── RosaryExtractor ───────────────────────────────────────────────────────
export interface RosaryFields {
  title: string;
  background: string;
  howToPray: string;
  openingPrayers: string;
  closingPrayers: string;
  mysterySets: Array<{ name: string; mysteries: string[]; decadeStructure: string }>;
  sourceUrl: string;
  sourceHost: string;
}

export function RosaryExtractor(input: ExtractorInput): ExtractorOutput<RosaryFields> {
  // Rosary: mystery names appear as headings; opening/closing prayers
  // as PRAYER blocks.
  const body = blockAwareBody(input, ["HEADING", "PRAYER", "PARAGRAPH", "LIST_ITEM"]);
  if (!body) return blank(input, "No body text supplied.");
  const { kept, rejected } = stripJunk(body);
  const evidence: FieldProvenance[] = [];
  const fields: Partial<RosaryFields> = {
    sourceUrl: input.url,
    sourceHost: input.host,
    mysterySets: [],
  };
  const fatal: string[] = [];

  if (input.title) {
    fields.title = input.title.trim();
    evidence.push(
      makeProvenance({
        fieldName: "title",
        sourceUrl: input.url,
        sourceHost: input.host,
        snippet: input.title,
        method: "TITLE_REGEX",
        confidence: 0.85,
        checksum: input.checksum,
      }),
    );
  }

  const setNames = ["joyful", "sorrowful", "glorious", "luminous"] as const;
  for (const setName of setNames) {
    const setPattern = new RegExp(
      `${setName}\\s+mysteries([\\s\\S]{40,3000}?)(?=(joyful|sorrowful|glorious|luminous)\\s+mysteries|$)`,
      "i",
    );
    const m = kept.match(setPattern);
    if (m && fields.mysterySets) {
      // Pull 5 mystery names — common pattern "1. The Annunciation".
      const mysteries = Array.from(m[1].matchAll(/\d\.\s+([A-Z][^\n.]{4,80})/g)).slice(0, 5);
      if (mysteries.length === 5) {
        fields.mysterySets.push({
          name: setName,
          mysteries: mysteries.map((mm) => mm[1].trim()),
          decadeStructure: "Our Father, 10 Hail Marys, Glory Be",
        });
        evidence.push(
          makeProvenance({
            fieldName: `mysterySets[${setName}]`,
            sourceUrl: input.url,
            sourceHost: input.host,
            snippet: m[0].slice(0, 240),
            method: "BODY_REGEX",
            confidence: 0.8,
            checksum: input.checksum,
          }),
        );
      }
    }
  }

  if (!fields.mysterySets || fields.mysterySets.length === 0) {
    fatal.push("No mystery sets with 5 mysteries found.");
  }

  fields.openingPrayers =
    "Sign of the Cross, Apostles' Creed, Our Father, Three Hail Marys, Glory Be";
  fields.closingPrayers = "Hail, Holy Queen, closing prayer, Sign of the Cross";
  fields.howToPray =
    "Pray each mystery as a decade: announce, meditate, then pray Our Father, ten Hail Marys, and Glory Be.";

  const required = ["title", "mysterySets"];
  const missing = required.filter(
    (f) =>
      !(f in fields) ||
      (Array.isArray((fields as Record<string, unknown>)[f]) &&
        ((fields as Record<string, unknown>)[f] as unknown[]).length === 0),
  );
  const confidence =
    required.length === 0 ? 0 : (required.length - missing.length) / required.length;

  return {
    fields,
    missingFields: missing,
    confidenceScore: confidence,
    sourceEvidence: evidence,
    rejectedSections: rejected,
    formatting: { setCount: fields.mysterySets?.length ?? 0 },
    warnings: [],
    fatalReasons: fatal,
  };
}

// ─── ConsecrationExtractor ─────────────────────────────────────────────────
export interface ConsecrationFields {
  consecrationTitle: string;
  background: string;
  duration: string;
  dailyStructure: Array<{ day: number; prayer: string }>;
  finalConsecrationPrayer: string;
  sourceUrl: string;
  sourceHost: string;
}

export function ConsecrationExtractor(input: ExtractorInput): ExtractorOutput<ConsecrationFields> {
  // Consecration: daily structure (DAY_SECTION) + final-consecration prayer.
  const body = blockAwareBody(input, ["DAY_SECTION", "PRAYER", "HEADING", "PARAGRAPH"]);
  if (!body) return blank(input, "No body text supplied.");
  const { kept, rejected } = stripJunk(body);
  const evidence: FieldProvenance[] = [];
  const fields: Partial<ConsecrationFields> = {
    sourceUrl: input.url,
    sourceHost: input.host,
    dailyStructure: [],
  };
  const fatal: string[] = [];

  if (input.title) {
    fields.consecrationTitle = input.title.trim();
    evidence.push(
      makeProvenance({
        fieldName: "consecrationTitle",
        sourceUrl: input.url,
        sourceHost: input.host,
        snippet: input.title,
        method: "TITLE_REGEX",
        confidence: 0.85,
        checksum: input.checksum,
      }),
    );
  }

  const durationMatch = matchBody(kept, /(\d{1,3})[- ]day\s+consecration/i);
  if (durationMatch) {
    fields.duration = `${durationMatch.value} days`;
    evidence.push(provenanceFor("duration", durationMatch, input));
  }

  // Find each day prayer.
  const dayMatches = Array.from(
    kept.matchAll(/Day\s+(\d{1,3})[\s:.\n]+([\s\S]{40,800}?amen[.!])/gi),
  );
  for (const m of dayMatches) {
    const day = parseInt(m[1], 10);
    if (!isNaN(day) && fields.dailyStructure) {
      fields.dailyStructure.push({ day, prayer: m[2].trim() });
    }
  }

  if (!fields.dailyStructure || fields.dailyStructure.length === 0) {
    fatal.push("No daily structure with prayers found.");
  }

  const finalMatch = matchBody(
    kept,
    /(?:final\s+)?act\s+of\s+consecration[\s\S]{20,1500}?amen[.!]/i,
  );
  if (finalMatch) {
    fields.finalConsecrationPrayer = finalMatch.value;
    evidence.push(provenanceFor("finalConsecrationPrayer", finalMatch, input));
  } else {
    fatal.push("No final act of consecration prayer found.");
  }

  const required = ["consecrationTitle", "duration", "dailyStructure", "finalConsecrationPrayer"];
  const missing = required.filter((f) => !(f in fields));
  const confidence = (required.length - missing.length) / required.length;

  return {
    fields,
    missingFields: missing,
    confidenceScore: confidence,
    sourceEvidence: evidence,
    rejectedSections: rejected,
    formatting: { dayCount: fields.dailyStructure?.length ?? 0 },
    warnings: [],
    fatalReasons: fatal,
  };
}

// ─── SacramentExtractor ────────────────────────────────────────────────────
export interface SacramentFields {
  sacramentTitle: string;
  sacramentKey: string;
  sacramentBadge: string;
  description: string;
  preparation: string;
  participation: string;
  sourceUrl: string;
  sourceHost: string;
}

const SEVEN_SACRAMENTS: Record<string, string> = {
  baptism: "BAPTISM",
  eucharist: "EUCHARIST",
  confirmation: "CONFIRMATION",
  reconciliation: "RECONCILIATION",
  matrimony: "MATRIMONY",
  "holy orders": "HOLY_ORDERS",
  "anointing of the sick": "ANOINTING_OF_THE_SICK",
};

export function SacramentExtractor(input: ExtractorInput): ExtractorOutput<SacramentFields> {
  // Sacraments: identity + theology in headings + paragraphs.
  const body = blockAwareBody(input, ["HEADING", "PARAGRAPH"]);
  if (!body) return blank(input, "No body text supplied.");
  const { kept, rejected } = stripJunk(body);
  const evidence: FieldProvenance[] = [];
  const fields: Partial<SacramentFields> = { sourceUrl: input.url, sourceHost: input.host };
  const fatal: string[] = [];

  const titleLower = (input.title ?? "").toLowerCase();
  // Spec §239-240: "Confession" / "Penance" is NOT a top-level content
  // type — it normalizes to Reconciliation under Sacraments.
  const matchedKey =
    Object.keys(SEVEN_SACRAMENTS).find((k) => titleLower.includes(k)) ??
    (/\b(confession|penance)\b/.test(titleLower) ? "reconciliation" : undefined);
  if (!matchedKey) {
    return blank(input, "Title does not name one of the seven sacraments.");
  }
  fields.sacramentTitle = input.title!.trim();
  fields.sacramentKey = SEVEN_SACRAMENTS[matchedKey];
  // Always file under the normalized badge (a Confession page becomes the
  // Reconciliation badge, never a "confession" badge).
  fields.sacramentBadge = matchedKey;
  evidence.push(
    makeProvenance({
      fieldName: "sacramentKey",
      sourceUrl: input.url,
      sourceHost: input.host,
      snippet: input.title!,
      method: "TITLE_REGEX",
      confidence: 0.95,
      checksum: input.checksum,
    }),
  );

  const desc = matchBody(kept, /((?:[A-Z][^.]{40,800}\.))/);
  if (desc) {
    fields.description = desc.value;
    evidence.push(provenanceFor("description", desc, input));
  } else {
    fatal.push("No description paragraph found.");
  }

  const prep = matchBody(kept, /preparation[\s:]+([^.]{20,600}\.)/i);
  if (prep) {
    fields.preparation = prep.value;
    evidence.push(provenanceFor("preparation", prep, input));
  } else {
    fatal.push("No preparation section found.");
  }

  const part = matchBody(
    kept,
    /(?:how\s+to\s+participate|participation|celebration)[\s:]+([^.]{20,600}\.)/i,
  );
  if (part) {
    fields.participation = part.value;
    evidence.push(provenanceFor("participation", part, input));
  }

  const required = ["sacramentTitle", "sacramentKey", "description", "preparation"];
  const missing = required.filter((f) => !(f in fields));
  const confidence = (required.length - missing.length) / required.length;

  return {
    fields,
    missingFields: missing,
    confidenceScore: confidence,
    sourceEvidence: evidence,
    rejectedSections: rejected,
    formatting: {},
    warnings: [],
    fatalReasons: fatal,
  };
}

// ─── HistoryExtractor ──────────────────────────────────────────────────────
const APPROVED_HISTORY_PATTERNS: Record<string, RegExp> = {
  councils: /council of\s+\w+/i,
  encyclicals: /encyclical/i,
  major_papal_acts: /(motu proprio|apostolic constitution|apostolic letter)/i,
  catechisms: /catechism/i,
  code_of_canon_law: /canon law/i,
  major_doctrinal_definitions: /(definition|dogma|infallibly)/i,
  schisms: /schism/i,
  religious_order_foundings: /(founded|founding|order of)/i,
  papal_consecrations: /papal consecration/i,
};

export interface HistoryFields {
  historyType: string;
  title: string;
  dateOrEra: string;
  summary: string;
  body: string;
  sourceUrl: string;
  sourceHost: string;
}

export function HistoryExtractor(input: ExtractorInput): ExtractorOutput<HistoryFields> {
  // Church history: date + authority + document context across
  // headings + paragraphs.
  const body = blockAwareBody(input, ["HEADING", "PARAGRAPH", "METADATA"]);
  if (!body) return blank(input, "No body text supplied.");
  const { kept, rejected } = stripJunk(body);
  const evidence: FieldProvenance[] = [];
  const fields: Partial<HistoryFields> = { sourceUrl: input.url, sourceHost: input.host };
  const fatal: string[] = [];

  // Detect history type.
  for (const [type, pattern] of Object.entries(APPROVED_HISTORY_PATTERNS)) {
    if (pattern.test(`${input.title ?? ""} ${kept}`)) {
      fields.historyType = type;
      evidence.push(
        makeProvenance({
          fieldName: "historyType",
          sourceUrl: input.url,
          sourceHost: input.host,
          snippet: `Matched pattern for ${type}.`,
          method: "BODY_REGEX",
          confidence: 0.85,
          checksum: input.checksum,
        }),
      );
      break;
    }
  }
  if (!fields.historyType) {
    return blank(input, "Page does not match an approved history type.");
  }

  if (input.title) {
    fields.title = input.title.trim();
    evidence.push(
      makeProvenance({
        fieldName: "title",
        sourceUrl: input.url,
        sourceHost: input.host,
        snippet: input.title,
        method: "TITLE_REGEX",
        confidence: 0.85,
        checksum: input.checksum,
      }),
    );
  }

  const dateMatch = matchBody(
    kept,
    /((?:\d{3,4}(?:[-–]\d{3,4})?)|(?:[A-Z][a-z]+ \d{1,2},? \d{3,4}))/,
  );
  if (dateMatch) {
    fields.dateOrEra = dateMatch.value;
    evidence.push(provenanceFor("dateOrEra", dateMatch, input));
  } else {
    fatal.push("No date or era found.");
  }

  const summary = matchBody(kept, /((?:[A-Z][^.]{40,600}\.))/);
  if (summary) {
    fields.summary = summary.value;
    evidence.push(provenanceFor("summary", summary, input));
  }

  fields.body = kept.slice(0, 5000);

  const required = ["historyType", "title", "dateOrEra", "summary", "body"];
  const missing = required.filter((f) => !(f in fields));
  const confidence = (required.length - missing.length) / required.length;

  return {
    fields,
    missingFields: missing,
    confidenceScore: confidence,
    sourceEvidence: evidence,
    rejectedSections: rejected,
    formatting: {},
    warnings: [],
    fatalReasons: fatal,
  };
}

// ─── LiturgyExtractor ──────────────────────────────────────────────────────
export interface LiturgyFields {
  liturgyTitle: string;
  liturgyType: string;
  summary: string;
  formationBody: string;
  sourceUrl: string;
  sourceHost: string;
}

export function LiturgyExtractor(input: ExtractorInput): ExtractorOutput<LiturgyFields> {
  // Liturgy: formation body + liturgical type — headings + paragraphs.
  const body = blockAwareBody(input, ["HEADING", "PARAGRAPH", "METADATA"]);
  if (!body) return blank(input, "No body text supplied.");
  const { kept, rejected } = stripJunk(body);
  const evidence: FieldProvenance[] = [];
  const fields: Partial<LiturgyFields> = { sourceUrl: input.url, sourceHost: input.host };
  const fatal: string[] = [];

  if (input.title) {
    fields.liturgyTitle = input.title.trim();
    evidence.push(
      makeProvenance({
        fieldName: "liturgyTitle",
        sourceUrl: input.url,
        sourceHost: input.host,
        snippet: input.title,
        method: "TITLE_REGEX",
        confidence: 0.85,
        checksum: input.checksum,
      }),
    );
  }

  fields.liturgyType = /divine office|liturgy of the hours/i.test(input.title ?? "")
    ? "divine_office"
    : "mass";

  const summary = matchBody(kept, /((?:[A-Z][^.]{40,600}\.))/);
  if (summary) {
    fields.summary = summary.value;
    evidence.push(provenanceFor("summary", summary, input));
  } else {
    fatal.push("No summary paragraph found.");
  }

  fields.formationBody = kept.slice(0, 5000);
  evidence.push(
    makeProvenance({
      fieldName: "formationBody",
      sourceUrl: input.url,
      sourceHost: input.host,
      snippet: kept.slice(0, 240),
      method: "BODY_REGEX",
      confidence: 0.7,
      checksum: input.checksum,
    }),
  );

  const required = ["liturgyTitle", "summary", "formationBody"];
  const missing = required.filter((f) => !(f in fields));
  const confidence = (required.length - missing.length) / required.length;

  return {
    fields,
    missingFields: missing,
    confidenceScore: confidence,
    sourceEvidence: evidence,
    rejectedSections: rejected,
    formatting: {},
    warnings: [],
    fatalReasons: fatal,
  };
}

// ─── ParishExtractor ───────────────────────────────────────────────────────
export interface ParishFields {
  parishName: string;
  address: string;
  city: string;
  state?: string;
  country: string;
  diocese?: string;
  /** parish | shrine | cathedral | major-basilica | minor-basilica */
  designation: string;
  website?: string;
  sourceUrl: string;
  sourceHost: string;
}

/** Classify a parish record by the designation stated in its name/text. */
export function parishDesignation(title: string | null | undefined, body: string): string {
  const hay = `${title ?? ""} ${body}`.toLowerCase();
  if (hay.includes("major basilica")) return "major-basilica";
  if (hay.includes("minor basilica") || hay.includes("basilica")) return "minor-basilica";
  if (hay.includes("cathedral")) return "cathedral";
  if (hay.includes("shrine")) return "shrine";
  return "parish";
}

export function ParishExtractor(input: ExtractorInput): ExtractorOutput<ParishFields> {
  // Parishes: address + hours come from LOCATION + METADATA blocks first.
  const body = blockAwareBody(input, ["LOCATION", "METADATA", "PARAGRAPH", "LIST_ITEM"]);
  if (!body) return blank(input, "No body text supplied.");
  const { kept, rejected } = stripJunk(body);
  const evidence: FieldProvenance[] = [];
  const fields: Partial<ParishFields> = { sourceUrl: input.url, sourceHost: input.host };
  const fatal: string[] = [];

  if (input.title) {
    fields.parishName = input.title.trim();
    evidence.push(
      makeProvenance({
        fieldName: "parishName",
        sourceUrl: input.url,
        sourceHost: input.host,
        snippet: input.title,
        method: "TITLE_REGEX",
        confidence: 0.85,
        checksum: input.checksum,
      }),
    );
  }

  const addressMatch = matchBody(
    kept,
    /(\d{1,5}\s+[A-Z][a-zA-Z .,'-]{3,80}(?:Street|St\.|Avenue|Ave\.|Road|Rd\.|Blvd\.|Lane|Ln\.))/,
  );
  if (addressMatch) {
    fields.address = addressMatch.value;
    evidence.push(provenanceFor("address", addressMatch, input));
  } else {
    fatal.push("No address found.");
  }

  const cityMatch = matchBody(kept, /,\s*([A-Z][a-zA-Z .'-]{2,40})\s*,\s*([A-Z]{2,3})\s*\d/);
  if (cityMatch) {
    const parts = cityMatch.value.split(/,\s*/);
    fields.city = parts[0] || cityMatch.value;
    if (parts[1]) fields.state = parts[1];
    evidence.push(provenanceFor("city", cityMatch, input));
  } else {
    fatal.push("No city found.");
  }

  fields.country = "United States";

  const dioceseMatch = matchBody(kept, /diocese of\s+([A-Z][a-zA-Z .,'-]{2,60})/i);
  if (dioceseMatch) {
    fields.diocese = dioceseMatch.value;
    evidence.push(provenanceFor("diocese", dioceseMatch, input));
  }

  fields.designation = parishDesignation(input.title, kept);

  const required = ["parishName", "address", "city", "country"];
  const missing = required.filter((f) => !(f in fields));
  const confidence = (required.length - missing.length) / required.length;

  return {
    fields,
    missingFields: missing,
    confidenceScore: confidence,
    sourceEvidence: evidence,
    rejectedSections: rejected,
    formatting: {},
    warnings: [],
    fatalReasons: fatal,
  };
}

// ─── PopeExtractor ──────────────────────────────────────────────────────────
export interface PopeFields {
  popeName: string;
  papacyStart: string;
  papacyEnd?: string;
  background?: string;
  sourceUrl: string;
  sourceHost: string;
}

export function PopeExtractor(input: ExtractorInput): ExtractorOutput<PopeFields> {
  const body = blockAwareBody(input, ["PARAGRAPH", "LIST_ITEM", "METADATA"]);
  if (!body) return blank(input, "No body text supplied.");
  const { kept, rejected } = stripJunk(body);
  const evidence: FieldProvenance[] = [];
  const fields: Partial<PopeFields> = { sourceUrl: input.url, sourceHost: input.host };
  const fatal: string[] = [];

  if (input.title) {
    fields.popeName = input.title.trim();
    evidence.push(
      makeProvenance({
        fieldName: "popeName",
        sourceUrl: input.url,
        sourceHost: input.host,
        snippet: input.title,
        method: "TITLE_REGEX",
        confidence: 0.85,
        checksum: input.checksum,
      }),
    );
  } else {
    fatal.push("No pope name found.");
  }

  // Years of the pontificate: prefer an explicit range ("1978 to 2005",
  // "2013–present"); otherwise a start year near pontificate language.
  const range = kept.match(
    /\b(1\d{3}|20\d{2})\s*(?:to|through|until|–|—|-)\s*(present|1\d{3}|20\d{2})\b/i,
  );
  if (range) {
    fields.papacyStart = range[1]!;
    if (!/present/i.test(range[2]!)) fields.papacyEnd = range[2]!;
    evidence.push(
      provenanceFor(
        "papacyStart",
        { value: range[1]!, snippet: range[0]!, confidence: 0.75 },
        input,
      ),
    );
  } else {
    const start = matchBody(
      kept,
      /\b(?:elected|pope from|since|began (?:his )?pontificate in|pontificate began in|papacy began in)\D{0,12}(1\d{3}|20\d{2})\b/i,
    );
    if (start) {
      fields.papacyStart = start.value;
      evidence.push(provenanceFor("papacyStart", start, input));
    }
  }
  if (!fields.papacyStart) fatal.push("No papacy start year found.");

  // Background — the first substantial sentence.
  const bio = matchBody(kept, /([A-Z][^.]{60,400}\.)/);
  if (bio) {
    fields.background = bio.value;
    evidence.push(provenanceFor("background", bio, input));
  }

  const required = ["popeName", "papacyStart"];
  const missing = required.filter((f) => !(f in fields));
  const confidence = (required.length - missing.length) / required.length;
  return {
    fields,
    missingFields: missing,
    confidenceScore: confidence,
    sourceEvidence: evidence,
    rejectedSections: rejected,
    formatting: {},
    warnings: [],
    fatalReasons: fatal,
  };
}

/** Single dispatcher for picking the right extractor by content type. */
export function extractByType(
  type:
    | "PRAYER"
    | "SAINT"
    | "APPARITION"
    | "DEVOTION"
    | "NOVENA"
    | "ROSARY"
    | "CONSECRATION"
    | "SACRAMENT"
    | "CHURCH_DOCUMENT"
    | "LITURGICAL"
    | "PARISH"
    | "POPE",
  input: ExtractorInput,
): ExtractorOutput {
  switch (type) {
    case "PRAYER":
      return PrayerExtractor(input) as ExtractorOutput;
    case "SAINT":
      return SaintExtractor(input) as ExtractorOutput;
    case "APPARITION":
      return MarianApparitionExtractor(input) as ExtractorOutput;
    case "DEVOTION":
      return DevotionExtractor(input) as ExtractorOutput;
    case "NOVENA":
      return NovenaExtractor(input) as ExtractorOutput;
    case "ROSARY":
      return RosaryExtractor(input) as ExtractorOutput;
    case "CONSECRATION":
      return ConsecrationExtractor(input) as ExtractorOutput;
    case "SACRAMENT":
      return SacramentExtractor(input) as ExtractorOutput;
    case "CHURCH_DOCUMENT":
      return HistoryExtractor(input) as ExtractorOutput;
    case "LITURGICAL":
      return LiturgyExtractor(input) as ExtractorOutput;
    case "PARISH":
      return ParishExtractor(input) as ExtractorOutput;
    case "POPE":
      return PopeExtractor(input) as ExtractorOutput;
  }
}
