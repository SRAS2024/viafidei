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

import { categorizePrayer } from "@/lib/content-shared/prayer-categories";
import type { ExtractableContentType } from "./content-types";
import { makeProvenance, type FieldProvenance } from "./provenance";
import type { StructuredFacts } from "./structured-data-extractors";
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
  /**
   * Normalised facts lifted from the page's machine-readable structured data
   * (schema.org JSON-LD, OpenGraph, microdata, Dublin Core meta). Optional and
   * advisory — present only when a page carries structured data. See
   * `structured-data-extractors.ts`.
   */
  structuredData?: StructuredFacts;
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

/**
 * prayerType cue table. Every emitted value is a member of the PRAYER schema
 * enum (schemas/prayer.ts) — the old extractor emitted "thanksgiving" /
 * "petition" which the schema rejects, and left prayerType MISSING for any page
 * that did not literally say "morning prayer", so almost no web prayer could
 * reach CHECKLIST_READY. Ordered most-specific first: a "Litany of Our Lady"
 * is a litany before it is Marian, a "Rosary Novena" is a novena.
 */
const PRAYER_TYPE_CUES: ReadonlyArray<{ type: string; cue: RegExp }> = [
  { type: "litany", cue: /\blitan(?:y|ies|iae)\b/i },
  { type: "novena", cue: /\bnovena\b/i },
  { type: "chaplet", cue: /\bchaplet\b/i },
  { type: "rosary", cue: /\brosary\b/i },
  { type: "consecration", cue: /\bconsecrat/i },
  {
    type: "act",
    cue: /\bact of (?:contrition|faith|hope|love|charity|spiritual communion|resignation|humility|thanksgiving|adoration|reparation|abandonment)\b/i,
  },
  { type: "psalm", cue: /\bpsalm\b/i },
  { type: "canticle", cue: /\b(?:canticle|magnificat|benedictus|nunc dimittis)\b/i },
  {
    type: "hymn",
    cue: /\b(?:hymn|tantum ergo|pange lingua|o salutaris|veni creator|veni sancte spiritus|adoro te|ave maris stella|stabat mater|te deum|dies irae|anima christi)\b/i,
  },
  {
    type: "marian",
    cue: /\b(?:hail,? mary|ave maria|memorare|our lady|blessed virgin|virgin mary|angelus|regina c(?:a|o)eli|salve regina|hail,? holy queen|mother of god|immaculate (?:heart|conception)|f[aá]tima|lourdes|guadalupe|sub tuum|marian)\b/i,
  },
  {
    type: "meal",
    cue: /\b(?:grace (?:before|after|at) meals?|before meals?|after meals?|meal ?time|bless us,? o lord)\b/i,
  },
  {
    type: "morning",
    cue: /\b(?:morning (?:prayer|offering)|lauds|at the start of the day|upon (?:rising|waking))\b/i,
  },
  {
    type: "evening",
    cue: /\b(?:evening prayer|night prayer|compline|vespers|before (?:sleep|bed|retiring)|bedtime)\b/i,
  },
  {
    type: "intercession",
    cue: /\b(?:intercess|petition|prayers? of the faithful|prayers? for (?:the |a |an )?[a-z])/i,
  },
];

/** Litany call-and-response lines ("pray for us", "have mercy on us", …). */
const LITANY_RESPONSE_RE =
  /\b(?:pray for us|have mercy(?: on us)?|deliver us|graciously hear us|hear us|spare us|save us|we beseech thee|ora pro nobis|miserere nobis|libera nos)\b/gi;
const LITANY_MIN_RESPONSES = 8;

/** Prose that talks ABOUT a prayer (intro / history) rather than being one. */
const PROSE_CUE_RE =
  /\b(?:this prayer|the prayer (?:is|was|has|can|may|should)|was (?:composed|written|attributed|popularized|popularised|approved|added|introduced)|is attributed|originat|dates? (?:from|back)|century|history of|traditionally (?:said|prayed|recited|attributed)|according to|is (?:one of the|a (?:traditional|popular|short|beautiful|powerful|catholic|classic|simple))|indulgence|pope [a-z]+ (?:i|v|x)*[a-z]* (?:approved|granted|wrote)|first appeared|is prayed|is recited|is often)\b/i;
/** Second-person address / petition language that marks prayer text. */
const PRAYER_VOICE_RE =
  /\b(?:thee|thou|thy|thine|we (?:pray|beseech|ask|adore|praise|thank)|grant (?:us|that|me)|have mercy|pray for us|hear us|amen|hail|o (?:god|lord|mary|jesus|blessed|most|sacred|holy|glorious)|i (?:believe|confess|adore|love you)|forgive us|bless us|come,? holy)\b/i;
/** Page chrome that survived the reader (nav / share / footer fragments). */
const CHROME_RE =
  /\b(?:home|menu|search|share|print|email|sign up|subscribe|newsletter|cookie|copyright|all rights reserved|read more|related|previous|next|donate|log ?in|privacy policy|terms of use|skip to)\b|©/i;

interface PrayerTextUnit {
  text: string;
  /** Separator to use when joining this unit to the previous one. */
  sep: string;
}

const AMEN_END_RE = /\bamen[.!]?\s*$/i;
const AMEN_ANY_RE = /\bamen[.!]/gi;

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function countLitanyResponses(text: string): number {
  return (text.match(LITANY_RESPONSE_RE) ?? []).length;
}

function isProseUnit(text: string): boolean {
  if (PROSE_CUE_RE.test(text)) return true;
  // A long paragraph with no prayer voice at all is narration, not prayer.
  return wordCount(text) > 40 && !PRAYER_VOICE_RE.test(text);
}

function isChromeUnit(text: string): boolean {
  const words = wordCount(text);
  if (words === 0) return true;
  if (words < 12 && CHROME_RE.test(text) && !PRAYER_VOICE_RE.test(text)) return true;
  return false;
}

/**
 * Turn the input into ordered text units: structured blocks when the reader
 * supplied them (PRAYER / PARAGRAPH / LIST_ITEM only — HEADING blocks are page
 * structure, never prayer text), otherwise bodyText paragraphs. A single
 * unbroken blob (no newlines) is split into sentences so an intro sentence can
 * be dropped without dropping the prayer that follows it.
 */
function prayerTextUnits(input: ExtractorInput): PrayerTextUnit[] {
  const blocks = (input.blocks ?? []).filter(
    (b) =>
      !b.isRejected &&
      (b.blockType === "PRAYER" || b.blockType === "PARAGRAPH" || b.blockType === "LIST_ITEM"),
  );
  if (blocks.length > 0) {
    return [...blocks]
      .sort((a, b) => a.blockOrder - b.blockOrder)
      .map((b) => ({ text: b.text.trim(), sep: "\n\n" }))
      .filter((u) => u.text.length > 0);
  }
  const raw = (input.bodyText ?? "").trim();
  if (!raw) return [];
  const paragraphs = raw
    .split(/\n\s*\n|\n/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (paragraphs.length > 1) return paragraphs.map((text) => ({ text, sep: "\n\n" }));
  return raw
    .split(/(?<=[.!?])\s+(?=[A-Z"“(])/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text) => ({ text, sep: " " }));
}

/**
 * Select the run of units that IS the prayer: everything from the first unit
 * after the intro / chrome up to the last unit ending in "Amen" (or, for a
 * litany, the last call-and-response line). Never a heading, never the page
 * intro, never anything after the closing Amen.
 */
function selectPrayerRun(
  units: PrayerTextUnit[],
  title: string | null | undefined,
  litany: boolean,
): { text: string; endsWithAmen: boolean } | null {
  if (units.length === 0) return null;
  const normalisedTitle = (title ?? "").trim().toLowerCase();
  const isEnd = (u: PrayerTextUnit) =>
    AMEN_END_RE.test(u.text) || (litany && countLitanyResponses(u.text) > 0);

  let end = -1;
  for (let i = units.length - 1; i >= 0; i--) {
    if (isEnd(units[i])) {
      end = i;
      break;
    }
  }
  const work = units.map((u) => ({ ...u }));
  if (end < 0) {
    // No unit ENDS with Amen — maybe one contains it mid-unit ("… Amen. Share
    // this prayer"). Cut that unit at its last Amen and end there.
    for (let i = work.length - 1; i >= 0; i--) {
      const matches = [...work[i].text.matchAll(AMEN_ANY_RE)];
      if (matches.length > 0) {
        const last = matches[matches.length - 1];
        work[i].text = work[i].text.slice(0, (last.index ?? 0) + last[0].length).trim();
        end = i;
        break;
      }
    }
  }
  if (end < 0) return null;

  // Walk back from the end, stopping at the first intro / chrome unit.
  let start = end;
  for (let i = end - 1; i >= 0; i--) {
    const u = work[i];
    if (isProseUnit(u.text) || isChromeUnit(u.text)) break;
    start = i;
  }
  // Drop a leading repeat of the title (the reader keeps <h1> text out of
  // paragraphs, but many pages echo the title as the first line).
  while (start < end && work[start].text.trim().toLowerCase() === normalisedTitle) start += 1;
  // A single Amen-unit that is prose ("… was approved in 1900. Amen.") is not
  // a prayer either — the end unit itself must read as prayer.
  if (start === end && isProseUnit(work[end].text) && !litany) return null;

  let text = "";
  for (let i = start; i <= end; i++) {
    text = i === start ? work[i].text : `${text}${work[i].sep}${work[i].text}`;
  }
  text = text.trim();
  if (text.length > PRAYER_TEXT_MAX_CHARS) {
    // Keep the tail — it is the part that ends with Amen.
    const cut = text.length - PRAYER_TEXT_MAX_CHARS;
    const nl = text.indexOf("\n", cut);
    text = text.slice(nl >= 0 ? nl + 1 : cut).trim();
  }
  if (text.length < PRAYER_TEXT_MIN_CHARS) return null;
  return { text, endsWithAmen: AMEN_END_RE.test(text) };
}

const PRAYER_TEXT_MIN_CHARS = 40;
const PRAYER_TEXT_MAX_CHARS = 12_000;

/**
 * Detect the prayer type from title, URL, litany structure, and (last) the
 * opening of the prayer text. Always returns a schema-enum value; "general"
 * when nothing more specific applies.
 */
export function detectPrayerType(input: {
  title?: string | null;
  url?: string;
  prayerText?: string | null;
  bodyText?: string | null;
}): { type: string; cue: string } {
  const urlWords = (() => {
    try {
      return decodeURIComponent(new URL(input.url ?? "").pathname).replace(/[-_/.+]+/g, " ");
    } catch {
      return "";
    }
  })();
  const titleAndUrl = `${input.title ?? ""} ${urlWords}`;
  for (const c of PRAYER_TYPE_CUES) {
    const m = titleAndUrl.match(c.cue);
    if (m) return { type: c.type, cue: m[0] };
  }
  const structural = `${input.prayerText ?? ""}\n${input.bodyText ?? ""}`;
  if (countLitanyResponses(structural) >= LITANY_MIN_RESPONSES) {
    return { type: "litany", cue: "call-and-response structure" };
  }
  // Title-less pages: the opening of the prayer itself still tells us what it
  // is ("O my God, I am heartily sorry" → act of contrition).
  const opening = (input.prayerText ?? "").slice(0, 400);
  const openingCues: Array<{ type: string; cue: RegExp }> = [
    { type: "act", cue: /\bi am (?:heartily )?sorry\b|\bo my god,? i (?:believe|hope|love)\b/i },
    { type: "consecration", cue: /\bi consecrate\b/i },
    { type: "meal", cue: /\bbless us,? o lord,? and these,? thy gifts\b/i },
  ];
  for (const c of openingCues) {
    const m = opening.match(c.cue);
    if (m) return { type: c.type, cue: m[0] };
  }
  return { type: "general", cue: "default" };
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

  // Litanies end in a versicle/response, not "Amen" — decide that first so the
  // run selector knows a response line may close the prayer.
  const units = prayerTextUnits(input);
  const litanyByTitle = /\blitan(?:y|ies|iae)\b/i.test(`${input.title ?? ""} ${input.url}`);
  const litanyByStructure =
    countLitanyResponses(units.map((u) => u.text).join("\n")) >= LITANY_MIN_RESPONSES;
  const litany = litanyByTitle || litanyByStructure;

  const run = selectPrayerRun(units, input.title, litany);
  if (run) {
    fields.prayerText = run.text;
    evidence.push(
      makeProvenance({
        fieldName: "prayerText",
        sourceUrl: input.url,
        sourceHost: input.host,
        snippet: run.text.slice(0, 240),
        method: "BODY_REGEX",
        confidence: litany && !run.endsWithAmen ? 0.7 : 0.75,
        checksum: input.checksum,
      }),
    );
  } else {
    fatal.push(
      litany
        ? "No litany block found (needs call-and-response lines or a closing 'Amen')."
        : "No prayer block found (must end with 'Amen').",
    );
  }

  const detected = detectPrayerType({
    title: input.title,
    url: input.url,
    prayerText: fields.prayerText,
    bodyText: kept,
  });
  fields.prayerType = detected.type;
  evidence.push(
    makeProvenance({
      fieldName: "prayerType",
      sourceUrl: input.url,
      sourceHost: input.host,
      snippet: detected.cue,
      method: "BODY_REGEX",
      confidence: detected.cue === "default" ? 0.6 : 0.7,
      checksum: input.checksum,
    }),
  );

  // Canonical /prayers filter category, derived the same way the public site
  // derives it — so the stored category is already one the filter understands.
  fields.category = categorizePrayer({
    title: fields.prayerTitle,
    prayerType: fields.prayerType,
    body: fields.prayerText,
  });

  const missing = required.filter((f) => !(f in fields));
  const confidence =
    required.length === 0 ? 0 : (required.length - missing.length) / required.length;

  return {
    fields,
    missingFields: missing,
    confidenceScore: confidence,
    sourceEvidence: evidence,
    rejectedSections: rejected,
    formatting: {
      hasAmen: /amen[.!]/i.test(kept),
      isLitany: litany,
      prayerTypeCue: detected.cue,
    },
    warnings: rejected.length > 0 ? [`Stripped ${rejected.length} junk section(s).`] : [],
    fatalReasons: fatal,
  };
}

// ─── SaintExtractor ────────────────────────────────────────────────────────
export interface SaintFields {
  saintName: string;
  saintType: string;
  /** "MM-DD" — the SAINT schema shape (also what /saints/today reads). */
  feastDay: string;
  feastMonth: number;
  /** Day of the month, under the schema's name … */
  feastDayOfMonth: number;
  /** … and under the legacy name the verifier / packaging tables still list. */
  feastDayNumber: number;
  /** Human-readable "October 4" for renderers / verification probes. */
  feastDayLabel: string;
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
/** Capitalised month names, indexed like MONTHS. */
const MONTH_LABELS = MONTHS.map((m) => m[0].toUpperCase() + m.slice(1));

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
      const month = monthIdx + 1;
      // Emit the SAINT schema's shape directly ("MM-DD" + feastMonth +
      // feastDayOfMonth). The old "August 23" text + `feastDayNumber` could
      // never satisfy validatePayload("SAINT") or the feast-day derived
      // columns, so no web-extracted saint could count toward the goal.
      fields.feastDay = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      fields.feastMonth = month;
      fields.feastDayOfMonth = day;
      fields.feastDayNumber = day;
      // Keep the prose form too: a renderer that wants "October 4" and the
      // validation fetcher (which matches dates as dates) both read it.
      fields.feastDayLabel = `${MONTH_LABELS[monthIdx]} ${day}`;
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

const SAINT_TYPE_ENUM = new Set([
  "martyr",
  "doctor_of_the_church",
  "virgin",
  "confessor",
  "religious",
  "lay",
  "bishop",
  "pope",
  "apostle",
  "evangelist",
  "founder",
  "missionary",
  "other",
]);

/**
 * Canonization status a source's own honorific states ("Blessed X" → beatified,
 * "Venerable X" → venerable, "Servant of God X" → servant_of_god, "Saint X" /
 * "St. X" → canonized). The status MUST be sourced, and the page title is the
 * source's statement; a bare name yields undefined (never guessed).
 */
export function canonizationStatusFromHonorific(
  name: string | undefined,
): "canonized" | "beatified" | "venerable" | "servant_of_god" | undefined {
  const n = (name ?? "").trim();
  if (/^servant of god\b/i.test(n)) return "servant_of_god";
  if (/^(venerable|ven\.)\s/i.test(n)) return "venerable";
  if (/^(blessed|bl\.)\s/i.test(n)) return "beatified";
  if (/^(saint|st\.?)\s/i.test(n)) return "canonized";
  return undefined;
}

/**
 * Shape a web-extracted saint into the SAINT content schema's payload
 * (`canonicalName` / `biography` / "MM-DD" feast / enum `saintType` /
 * `canonizationStatus` / ≥2 citations). Pure and deterministic: every value is
 * the extractor's own field or a caller-supplied citation; nothing is invented.
 * The caller validates the result with `validatePayload("SAINT", …)`.
 */
export function saintSchemaPayloadFromFields(
  fields: Partial<SaintFields>,
  extra: {
    /** Additional citation URLs (validation sources); sourceUrl is always first. */
    citations?: string[];
    canonizationStatus?: "canonized" | "beatified" | "venerable" | "servant_of_god";
  } = {},
): Record<string, unknown> {
  const name = (fields.saintName ?? "").trim();
  const bare = name.replace(/^(saint|st\.?|blessed|bl\.?|venerable|ven\.?|servant of god)\s+/i, "");
  const slugBase = bare
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const citations = [...new Set([fields.sourceUrl, ...(extra.citations ?? [])].filter(Boolean))];
  const payload: Record<string, unknown> = {
    slug: `saint-${slugBase}`,
    canonicalName: name,
    feastDay: fields.feastDay,
    feastMonth: fields.feastMonth,
    feastDayOfMonth: fields.feastDayOfMonth,
    patronages: (fields.patronage ?? "")
      .split(/[;,]| and /)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && s.length <= 80),
    biography: fields.background,
    saintType: SAINT_TYPE_ENUM.has(fields.saintType ?? "") ? fields.saintType : "other",
    relatedPrayers: [],
    relatedDevotions: [],
    citations,
  };
  const status = extra.canonizationStatus ?? canonizationStatusFromHonorific(name);
  if (status) payload.canonizationStatus = status;
  if (fields.birthDate) payload.birthDate = fields.birthDate;
  if (fields.deathDate) payload.deathDate = fields.deathDate;
  if (fields.canonizationYear) payload.canonizationDate = fields.canonizationYear;
  return payload;
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

// ─── DoctorExtractor ────────────────────────────────────────────────────────
export interface DoctorFields {
  doctorName: string;
  doctorTitle?: string;
  feastDay?: string;
  background?: string;
  sourceUrl: string;
  sourceHost: string;
}

export function DoctorExtractor(input: ExtractorInput): ExtractorOutput<DoctorFields> {
  const body = blockAwareBody(input, ["PARAGRAPH", "LIST_ITEM", "METADATA"]);
  if (!body) return blank(input, "No body text supplied.");
  const { kept, rejected } = stripJunk(body);
  const evidence: FieldProvenance[] = [];
  const fields: Partial<DoctorFields> = { sourceUrl: input.url, sourceHost: input.host };
  const fatal: string[] = [];

  if (input.title) {
    fields.doctorName = input.title.trim();
    evidence.push(
      makeProvenance({
        fieldName: "doctorName",
        sourceUrl: input.url,
        sourceHost: input.host,
        snippet: input.title,
        method: "TITLE_REGEX",
        confidence: 0.85,
        checksum: input.checksum,
      }),
    );
  } else {
    fatal.push("No doctor name found.");
  }

  // Honorific epithet, e.g. "Doctor of Grace", "Angelic Doctor".
  const epithet = matchBody(
    kept,
    /\b((?:Angelic|Seraphic|Common|Universal|Marian|Eucharistic|Mellifluous)\s+Doctor|Doctor\s+of\s+(?:the\s+)?[A-Z][a-zA-Z ]{2,40})\b/,
  );
  if (epithet) {
    fields.doctorTitle = epithet.value;
    evidence.push(provenanceFor("doctorTitle", epithet, input));
  }

  const feast = matchBody(
    kept,
    /\bfeast(?:\s+day)?\s+(?:is\s+)?(?:on\s+)?((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2})/i,
  );
  if (feast) {
    fields.feastDay = feast.value;
    evidence.push(provenanceFor("feastDay", feast, input));
  }

  const bio = matchBody(kept, /([A-Z][^.]{60,400}\.)/);
  if (bio) {
    fields.background = bio.value;
    evidence.push(provenanceFor("background", bio, input));
  }

  const required = ["doctorName"];
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

// ─── RiteExtractor ──────────────────────────────────────────────────────────
export interface RiteFields {
  riteName: string;
  history?: string;
  background?: string;
  sourceUrl: string;
  sourceHost: string;
}

export function RiteExtractor(input: ExtractorInput): ExtractorOutput<RiteFields> {
  const body = blockAwareBody(input, ["PARAGRAPH", "LIST_ITEM", "METADATA"]);
  if (!body) return blank(input, "No body text supplied.");
  const { kept, rejected } = stripJunk(body);
  const evidence: FieldProvenance[] = [];
  const fields: Partial<RiteFields> = { sourceUrl: input.url, sourceHost: input.host };
  const fatal: string[] = [];

  if (input.title) {
    fields.riteName = input.title.trim();
    evidence.push(
      makeProvenance({
        fieldName: "riteName",
        sourceUrl: input.url,
        sourceHost: input.host,
        snippet: input.title,
        method: "TITLE_REGEX",
        confidence: 0.85,
        checksum: input.checksum,
      }),
    );
  } else {
    fatal.push("No rite name found.");
  }

  // History: prefer the paragraph after a "History" heading; otherwise the
  // first substantial sentence becomes the background.
  const historyBlock = matchBody(kept, /history[:\s]+([A-Z][^]{80,800}?\.)(?:\s|$)/i);
  if (historyBlock) {
    fields.history = historyBlock.value;
    evidence.push(provenanceFor("history", historyBlock, input));
  }
  const bio = matchBody(kept, /([A-Z][^.]{60,400}\.)/);
  if (bio) {
    fields.background = bio.value;
    evidence.push(provenanceFor("background", bio, input));
  }

  const required = ["riteName"];
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

// ─── MarianTitleExtractor ────────────────────────────────────────────────────
export interface MarianTitleFields {
  marianTitleName: string;
  background?: string;
  feastDay?: string;
  patronage?: string;
  sourceUrl: string;
  sourceHost: string;
}

export function MarianTitleExtractor(input: ExtractorInput): ExtractorOutput<MarianTitleFields> {
  const body = blockAwareBody(input, ["PARAGRAPH", "LIST_ITEM", "METADATA"]);
  if (!body) return blank(input, "No body text supplied.");
  const { kept, rejected } = stripJunk(body);
  const evidence: FieldProvenance[] = [];
  const fields: Partial<MarianTitleFields> = { sourceUrl: input.url, sourceHost: input.host };
  const fatal: string[] = [];

  if (input.title && input.title.trim()) {
    fields.marianTitleName = input.title.trim();
    evidence.push(
      makeProvenance({
        fieldName: "marianTitleName",
        sourceUrl: input.url,
        sourceHost: input.host,
        snippet: input.title,
        method: "TITLE_REGEX",
        confidence: 0.85,
        checksum: input.checksum,
      }),
    );
  } else {
    fatal.push("No Marian title found.");
  }

  // Background: the first substantial sentence describing the title.
  const bio = matchBody(kept, /([A-Z][^.]{60,400}\.)/);
  if (bio) {
    fields.background = bio.value;
    evidence.push(provenanceFor("background", bio, input));
  }

  const feast = matchBody(
    kept,
    /\bfeast(?:\s+day)?\s+(?:is\s+)?(?:on\s+)?((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2})/i,
  );
  if (feast) {
    fields.feastDay = feast.value;
    evidence.push(provenanceFor("feastDay", feast, input));
  }

  const patron = matchBody(
    kept,
    /patron(?:ess)?\s+(?:saint\s+)?of\s+([A-Za-z][A-Za-z ,'-]{2,60})/i,
  );
  if (patron) {
    fields.patronage = patron.value;
    evidence.push(provenanceFor("patronage", patron, input));
  }

  const required = ["marianTitleName", "background"];
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

// ─── GuideExtractor ──────────────────────────────────────────────────────────
export interface GuideFields {
  title: string;
  body?: string;
  summary?: string;
  sourceUrl: string;
  sourceHost: string;
}

export function GuideExtractor(input: ExtractorInput): ExtractorOutput<GuideFields> {
  const body = blockAwareBody(input, ["PARAGRAPH", "HEADING", "LIST_ITEM"]);
  if (!body) return blank(input, "No body text supplied.");
  const { kept, rejected } = stripJunk(body);
  const evidence: FieldProvenance[] = [];
  const fields: Partial<GuideFields> = { sourceUrl: input.url, sourceHost: input.host };
  const fatal: string[] = [];

  if (input.title && input.title.trim()) {
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
  } else {
    fatal.push("No guide title found.");
  }

  // The guide body must be a substantial prose passage — a single line is
  // not a guide, so an absent body is fatal (proves junk fails).
  const prose = matchBody(kept, /([A-Z][\s\S]{120,4000}\.)/);
  if (prose) {
    fields.body = prose.value.trim();
    evidence.push(provenanceFor("body", prose, input));
    const summary = matchBody(kept, /([A-Z][^.]{40,300}\.)/);
    if (summary) {
      fields.summary = summary.value;
      evidence.push(provenanceFor("summary", summary, input));
    }
  } else {
    fatal.push("No substantial guide body found.");
  }

  const required = ["title", "body"];
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

// ─── SpiritualPracticeExtractor ──────────────────────────────────────────────
export interface SpiritualPracticeFields {
  title: string;
  body?: string;
  howToPractice?: string;
  sourceUrl: string;
  sourceHost: string;
}

export function SpiritualPracticeExtractor(
  input: ExtractorInput,
): ExtractorOutput<SpiritualPracticeFields> {
  const body = blockAwareBody(input, ["PARAGRAPH", "LIST_ITEM", "HEADING"]);
  if (!body) return blank(input, "No body text supplied.");
  const { kept, rejected } = stripJunk(body);
  const evidence: FieldProvenance[] = [];
  const fields: Partial<SpiritualPracticeFields> = {
    sourceUrl: input.url,
    sourceHost: input.host,
  };
  const fatal: string[] = [];

  if (input.title && input.title.trim()) {
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
  } else {
    fatal.push("No spiritual-practice title found.");
  }

  const prose = matchBody(kept, /([A-Z][\s\S]{120,4000}\.)/);
  if (prose) {
    fields.body = prose.value.trim();
    evidence.push(provenanceFor("body", prose, input));
  } else {
    fatal.push("No substantial spiritual-practice body found.");
  }

  // Optional step-by-step instructions ("how to practice").
  const how = matchBody(
    kept,
    /(?:how to (?:practice|pray|begin)|to (?:practice|begin))[:\s]+([A-Za-z][\s\S]{40,800}?\.)/i,
  );
  if (how) {
    fields.howToPractice = how.value.trim();
    evidence.push(provenanceFor("howToPractice", how, input));
  }

  const required = ["title", "body"];
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
  type: ExtractableContentType,
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
    case "DOCTOR":
      return DoctorExtractor(input) as ExtractorOutput;
    case "RITE":
      return RiteExtractor(input) as ExtractorOutput;
    case "MARIAN_TITLE":
      return MarianTitleExtractor(input) as ExtractorOutput;
    case "GUIDE":
      return GuideExtractor(input) as ExtractorOutput;
    case "SPIRITUAL_PRACTICE":
      return SpiritualPracticeExtractor(input) as ExtractorOutput;
  }
}
