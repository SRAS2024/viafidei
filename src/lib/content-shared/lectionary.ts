/**
 * Lectionary — the "liturgical day → Scripture readings" resolver.
 *
 * This is the TEXT layer. The citations themselves come from the committed
 * Lectionary tables (./lectionary/index.ts: the Lectionary for Mass for the
 * Dioceses of the United States, keyed by the `lectionaryKey` the calendar
 * engine produces); this module turns a day + its cycles into the day's
 * sections in proclamation order, each with the public-domain Douay-Rheims
 * (Challoner) text resolved per citation by `resolveDouayPassage`
 * (./bible/dra.ts), which maps the lectionary's modern chapter:verse numbering
 * onto the Vulgate numbering with a verified alignment table.
 *
 * Accuracy posture (agreed with the site owner):
 *   - A key that is not in the table resolves to null. Readings are never
 *     borrowed from a neighbouring day and never invented.
 *   - A citation the resolver cannot align with certainty carries its citation
 *     only (`body: null`), never a shifted passage.
 *   - Where the Lectionary reads only PART of a verse (a/b/c) the Douay-Rheims
 *     verse is shown whole; that is surfaced as `partialVerses` + the
 *     resolver's note, never passed off as an exact pericope.
 *   - Where the Lectionary offers alternatives ("Jn 1:1-18 or Jn 1:1-5, 9-14")
 *     every alternative is resolved, so the page can show them as a choice
 *     instead of silently dropping one.
 *
 * Import note: the bare specifier "./lectionary" resolves to THIS file, so the
 * table package must always be imported as "./lectionary/index".
 */

import { parseCitation } from "./bible/citation";
import { type BookCode, bookByCode, findBook } from "./bible/books";
import { type DouayAlignment, resolveDouayPassage } from "./bible/dra";
import type { ReadingKind, ReadingSection } from "./daily-readings";
import {
  LECTIONARY_ATTRIBUTION,
  lectionaryKeys,
  lookupLectionary,
  type KeyMapMass,
  type LectionarySection,
  type LectionarySource,
  type SundayCycle,
  type WeekdayCycle,
} from "./lectionary/index";

export { LECTIONARY_ATTRIBUTION };
export type { KeyMapMass, SundayCycle, WeekdayCycle };

type SanctoralReadings = "proper" | "proper-first" | "proper-gospel" | "ferial";

/** Default heading for each kind; the table may override it (Easter Vigil). */
const KIND_LABEL: Record<ReadingKind, string> = {
  FIRST_READING: "First Reading",
  PSALM: "Responsorial Psalm",
  SECOND_READING: "Second Reading",
  ACCLAMATION: "Gospel Acclamation",
  GOSPEL: "Gospel",
  OTHER: "Reading",
};

/**
 * How a reading's text is set. The words are always the Douay-Rheims verses,
 * whole and in order; only the line and paragraph breaks are chosen here.
 *  - "verse": one line per verse, in stanzas. Psalms, canticles and the poetry of
 *    the prophets and wisdom books.
 *  - "prose": paragraphs that break between verses.
 */
export type ReadingLayout =
  | { form: "verse"; stanzas: string[][] }
  | { form: "prose"; paragraphs: string[] };

/** One reading the Lectionary offers for a section ("A or B" gives two). */
export interface ReadingAlternative {
  /** The lectionary citation, exactly as the Lectionary prints it. */
  citation: string;
  /** The citation with its book written out, for reading aloud: "John 1:1-18". */
  reference: string;
  /** Douay-Rheims text, or null when the alignment is not certain. */
  body: string | null;
  /** The same text with its verse structure; null when `body` is null. */
  layout: ReadingLayout | null;
  /** The Douay-Rheims reference the text was taken from ("" if unresolved). */
  douayCitation: string;
  alignment: DouayAlignment;
  /**
   * True when the citation reads only part of a verse (a/b/c). The Douay-Rheims
   * verse is then shown WHOLE — the page must say so rather than imply the
   * pericope is exact.
   */
  partialVerses: boolean;
  /** The resolver's note (Vulgate renumbering, whole-verse notice, …). */
  note: string | null;
}

export interface ResolvedReadingSection {
  kind: ReadingKind;
  label: string;
  /** The full lectionary citation, alternatives included. */
  citation: string;
  /** The primary alternative's citation with its book written out. */
  reference: string;
  /** Text of the primary alternative; null when it is citation-only. */
  body: string | null;
  /** The primary alternative's text with its verse structure. */
  layout: ReadingLayout | null;
  douayCitation: string;
  alignment: DouayAlignment;
  partialVerses: boolean;
  note: string | null;
  /** Every alternative in order; `alternatives[0]` is the primary reading. */
  alternatives: ReadingAlternative[];
  /** The Responsorial Psalm's response verse, when the table carries one. */
  response: ReadingAlternative | null;
  /** Which source the citation came from (audit trail). */
  source: LectionarySource;
}

export interface ResolvedReadings {
  /** The engine `lectionaryKey` these readings were resolved for. */
  key: string;
  /** Lectionary number, for the "Lectionary: N" line. */
  number: string;
  /** Day label as printed in the Lectionary ("Christmas: Mass during the Day - ABC"). */
  label: string;
  cycle: SundayCycle | null;
  /** The Mass formulary resolved (null = the day has a single formulary). */
  variant: string | null;
  /** Every formulary of the day, principal first — the "or" Masses. */
  masses: readonly KeyMapMass[];
  /** Sections in proclamation order. */
  sections: ResolvedReadingSection[];
  /** 0..1 — share of sections whose verified text resolved. */
  confidence: number;
}

export interface ResolveReadingsOptions {
  sundayCycle?: SundayCycle;
  weekdayCycle?: WeekdayCycle;
  /** Mass formulary; omit for the principal Mass of the day. */
  variant?: string | null;
}

/**
 * A table section may carry a response verse for the psalm. The generated
 * tables do not yet supply one (the printed index does not give it for every
 * day), so this is read defensively rather than typed into the table shape.
 */
function responseCitation(section: LectionarySection): string | null {
  const raw = (section as { response?: unknown }).response;
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

/**
 * Split a lectionary citation into the alternatives it offers. The build
 * normalises every alternative to repeat its own book, so each part is a
 * self-contained citation.
 */
export function splitAlternatives(citation: string): string[] {
  return citation
    .split(/\s+or\s+/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** True when any verse of the citation is read only in part (a/b/c). */
function readsPartialVerses(citation: string): boolean {
  const parsed = parseCitation(citation);
  if (!parsed) return false;
  return parsed.alternatives.some((alt) =>
    alt.segments.some((seg) => seg.verses !== "all" && seg.verses.some((range) => range.partial)),
  );
}

/**
 * "Jn 1:1-18" as "John 1:1-18", and "cf. Ps 80:4" as "See Psalm 80:4". The tables
 * keep the Lectionary's abbreviations, which a screen reader can only spell out.
 */
export function citationReference(citation: string): string {
  return citation
    .replace(/^cf\.\s+/i, "See ")
    .replace(/(?:[1-3]\s+)?[A-Z][a-z]+(?=\s+(?:\d|[A-F]:))/g, (token) => {
      const book = findBook(token);
      return book ? bookByCode(book.code).name : token;
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Setting the text
// ─────────────────────────────────────────────────────────────────────────────

/** Books the Lectionary sets as poetry, apart from their narrative chapters. */
const POETIC_BOOKS: ReadonlySet<BookCode> = new Set<BookCode>([
  "PSA",
  "PRO",
  "SNG",
  "WIS",
  "SIR",
  "LAM",
  "JOB",
  "ISA",
  "HOS",
  "JOL",
  "AMO",
  "MIC",
  "NAM",
  "HAB",
  "ZEP",
]);

const NARRATIVE_CHAPTERS: Partial<Record<BookCode, readonly number[]>> = {
  ISA: [6, 7, 36, 37, 38, 39],
  JOB: [1, 2, 42],
  AMO: [7],
  HOS: [1, 3],
};

function isPoetry(citation: string): boolean {
  const segments = parseCitation(citation)?.alternatives[0]?.segments ?? [];
  if (segments.length === 0) return false;
  return segments.every(
    (seg) =>
      POETIC_BOOKS.has(seg.book) &&
      !(typeof seg.chapter === "number" && NARRATIVE_CHAPTERS[seg.book]?.includes(seg.chapter)),
  );
}

const SENTENCE_END = /[.!?]["'”’)\]]*$/;
const CLAUSE_END = /[:;]["'”’)\]]*$/;

/** A paragraph may end at a sentence once it reaches this many characters. */
const PARAGRAPH_MIN = 400;
/** Past this it may end at a colon or semicolon, the Douay's long sentences' joints. */
const PARAGRAPH_SOFT_MAX = 600;
/** Past this it ends at the next verse, whatever closes it. */
const PARAGRAPH_HARD_MAX = 900;
/** Where the Lectionary skips verses a new paragraph is natural, if this one has any length. */
const PARAGRAPH_AT_GAP = 240;

/**
 * Paragraphs that break only between verses, never inside one: at a sentence's
 * end once the paragraph is long enough to read as a paragraph.
 */
export function proseParagraphs(groups: readonly (readonly string[])[]): string[] {
  const paragraphs: string[] = [];
  let current: string[] = [];
  let length = 0;
  const flush = () => {
    if (current.length > 0) paragraphs.push(current.join(" "));
    current = [];
    length = 0;
  };
  for (const group of groups) {
    for (const verse of group) {
      current.push(verse);
      length += verse.length + 1;
      if (
        (length >= PARAGRAPH_MIN && SENTENCE_END.test(verse)) ||
        (length >= PARAGRAPH_SOFT_MAX && CLAUSE_END.test(verse)) ||
        length >= PARAGRAPH_HARD_MAX
      ) {
        flush();
      }
    }
    if (length >= PARAGRAPH_AT_GAP) flush();
  }
  flush();
  // A stray last line reads better with the paragraph it finishes.
  if (paragraphs.length > 1 && paragraphs[paragraphs.length - 1].length < 120) {
    const last = paragraphs.pop() as string;
    paragraphs[paragraphs.length - 1] += ` ${last}`;
  }
  return paragraphs;
}

/** A stanza longer than this many lines may break at the end of a sentence. */
const STANZA_MIN_LINES = 3;
/** Past this many lines it breaks at the next verse. */
const STANZA_MAX_LINES = 8;

/**
 * Stanzas of one verse per line. The citation's own items are the stanzas where
 * it has them (a responsorial psalm's strophes). An unbroken run of poetry, which
 * the Douay-Rheims does not divide, breaks at a sentence's end.
 */
export function verseStanzas(groups: readonly (readonly string[])[]): string[][] {
  const stanzas: string[][] = [];
  for (const group of groups) {
    let current: string[] = [];
    for (const verse of group) {
      current.push(verse);
      const full = current.length >= STANZA_MAX_LINES;
      if (full || (current.length >= STANZA_MIN_LINES && SENTENCE_END.test(verse))) {
        stanzas.push(current);
        current = [];
      }
    }
    if (current.length > 0) stanzas.push(current);
  }
  return stanzas;
}

function layoutPassage(
  groups: readonly (readonly string[])[],
  form: ReadingLayout["form"],
): ReadingLayout | null {
  if (groups.length === 0) return null;
  return form === "verse"
    ? { form, stanzas: verseStanzas(groups) }
    : { form, paragraphs: proseParagraphs(groups) };
}

/**
 * The layout of text that arrives as one string (a stored row), where the verse
 * boundaries are gone. Its own line breaks are kept; without any, prose breaks at
 * sentences by the same rule as verses, and verse text stays a single stanza.
 */
export function layoutFromText(body: string, form: ReadingLayout["form"]): ReadingLayout {
  const blocks = body
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
  if (form === "verse") {
    return {
      form,
      stanzas: blocks.map((block) =>
        block
          .split(/\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0),
      ),
    };
  }
  if (blocks.length > 1) return { form, paragraphs: blocks };
  const sentences = body.match(/[^.!?]+[.!?]+["'”’)\]]*\s*|[^.!?]+$/g) ?? [body];
  return { form, paragraphs: proseParagraphs([sentences.map((s) => s.trim())]) };
}

/**
 * Resolve one citation (a single alternative) to its Douay-Rheims text. A psalm's
 * text is always verse; `kind` says when the citation is one.
 */
export function resolveAlternative(citation: string, kind?: ReadingKind): ReadingAlternative {
  const passage = resolveDouayPassage(citation);
  const form = kind === "PSALM" || isPoetry(citation) ? "verse" : "prose";
  return {
    citation,
    reference: citationReference(citation),
    body: passage.text && passage.text.length > 0 ? passage.text : null,
    layout: layoutPassage(passage.verseGroups, form),
    douayCitation: passage.douayCitation,
    alignment: passage.alignment,
    partialVerses: readsPartialVerses(citation),
    note: passage.note ?? null,
  };
}

/** Resolve one table section (citations only) into a rendered section. */
export function resolveLectionarySection(section: LectionarySection): ResolvedReadingSection {
  const alternatives = splitAlternatives(section.citation).map((citation) =>
    resolveAlternative(citation, section.kind),
  );
  // A citation that does not split at all still has one alternative; a citation
  // that somehow yields none must not crash the day.
  const primary = alternatives[0] ?? resolveAlternative(section.citation, section.kind);
  const response = responseCitation(section);
  return {
    kind: section.kind,
    label: section.label ?? KIND_LABEL[section.kind] ?? KIND_LABEL.OTHER,
    citation: section.citation,
    reference: primary.reference,
    body: primary.body,
    layout: primary.layout,
    douayCitation: primary.douayCitation,
    alignment: primary.alignment,
    partialVerses: primary.partialVerses,
    note: primary.note,
    alternatives: alternatives.length > 0 ? alternatives : [primary],
    response: response ? resolveAlternative(response, "PSALM") : null,
    source: section.source,
  };
}

// Resolving a day walks the Douay store for every verse of every reading, so
// the result is memoised per (key, cycles, variant) — the readings page and the
// worker's backfill both hit the same handful of days repeatedly.
const memo = new Map<string, ResolvedReadings | null>();
// The table has ~430 keys × 3 Sunday cycles × 2 weekday cycles × a few Masses;
// the cap only guards against an unbounded caller (never reached in practice).
const MEMO_LIMIT = 8_000;

/**
 * Resolve the readings for a liturgical day.
 *
 * `key` is the engine's `lectionaryKey`; pass the day's `sundayCycle` and
 * `weekdayCycle` so cycle-specific readings (Sunday formularies, Ordinary-Time
 * weekday first readings in Year I vs Year II) resolve correctly. Returns null
 * when the key or the requested Mass formulary is not in the table — the caller
 * then shows the celebration and the official source link, never a guess.
 */
export function resolveReadings(
  key: string,
  opts: ResolveReadingsOptions = {},
): ResolvedReadings | null {
  const memoKey = `${key}|${opts.sundayCycle ?? ""}|${opts.weekdayCycle ?? ""}|${opts.variant ?? ""}`;
  const cached = memo.get(memoKey);
  if (cached !== undefined) return cached;

  const lookup = lookupLectionary(key, {
    sundayCycle: opts.sundayCycle,
    weekdayCycle: opts.weekdayCycle,
    variant: opts.variant,
  });
  let out: ResolvedReadings | null = null;
  if (lookup && lookup.sections.length > 0) {
    const sections = lookup.sections.map(resolveLectionarySection);
    const withText = sections.filter((s) => typeof s.body === "string" && s.body.length > 0).length;
    out = {
      key: lookup.key,
      // "62-extended" is a table key; the Lectionary number is still 62.
      number: lookup.number.split("-")[0],
      label: lookup.label,
      cycle: lookup.cycle,
      variant: lookup.variant,
      masses: lookup.masses,
      sections,
      confidence: sections.length > 0 ? withText / sections.length : 0,
    };
  }
  if (memo.size >= MEMO_LIMIT) memo.clear();
  memo.set(memoKey, out);
  return out;
}

/** What `resolveDayReadings` needs to know about a liturgical day. */
export interface DayForReadings {
  lectionaryKey: string;
  temporalKey: string;
  sundayCycle: string;
  weekdayCycle: string;
  sanctoral?: { readings: SanctoralReadings } | null;
}

/**
 * Resolve a whole liturgical day, memorials included. A few memorials own only
 * part of their Mass, and the USCCB prints the two halves together: Saint Martha
 * reads the weekday's first reading and psalm with her own Gospel ("403/607"),
 * Saint Barnabas his own first reading and psalm with the weekday's Gospel.
 * `resolveReadings` knows one Lectionary number at a time, so it is this function
 * that puts them side by side.
 */
export function resolveDayReadings(
  day: DayForReadings,
  opts: { variant?: string | null } = {},
): ResolvedReadings | null {
  const cycles = {
    sundayCycle: day.sundayCycle as SundayCycle,
    weekdayCycle: day.weekdayCycle as WeekdayCycle,
  };
  const proper = resolveReadings(day.lectionaryKey, { ...cycles, variant: opts.variant });
  const mode = day.sanctoral?.readings;
  // A named formulary is that formulary, never a half of it.
  if (opts.variant || (mode !== "proper-gospel" && mode !== "proper-first")) return proper;
  const weekday = resolveReadings(day.temporalKey, cycles);
  if (!proper || !weekday) return proper ?? weekday;

  const [opening, closing] = mode === "proper-gospel" ? [weekday, proper] : [proper, weekday];
  const sections = [
    ...opening.sections.filter((s) => s.kind === "FIRST_READING" || s.kind === "PSALM"),
    ...closing.sections.filter((s) => s.kind === "ACCLAMATION" || s.kind === "GOSPEL"),
  ];
  const withText = sections.filter((s) => s.body).length;
  return {
    ...proper,
    number: `${opening.number}/${closing.number}`,
    sections,
    confidence: sections.length > 0 ? withText / sections.length : 0,
  };
}

/**
 * The compact `ReadingSection[]` shape stored in DailyReading and rendered by
 * the older consumers: kind, label, citation, body. The rich fields
 * (alternatives, alignment, notes) are recomputed on demand and deliberately
 * NOT persisted, so a table correction reaches the page without a DB write.
 */
export function toStoredSections(sections: ResolvedReadingSection[]): ReadingSection[] {
  return sections.map((s) => ({
    kind: s.kind,
    label: s.label,
    citation: s.citation,
    body: s.body,
  }));
}

/** Liturgical-day keys the lectionary tables cover (for diagnostics). */
export function coveredLectionaryKeys(): string[] {
  return lectionaryKeys();
}

/** Test/diagnostic helper: drop the per-day memo. */
export function clearReadingsMemo(): void {
  memo.clear();
}
