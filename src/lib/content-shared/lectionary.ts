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

/** Default heading for each kind; the table may override it (Easter Vigil). */
const KIND_LABEL: Record<ReadingKind, string> = {
  FIRST_READING: "First Reading",
  PSALM: "Responsorial Psalm",
  SECOND_READING: "Second Reading",
  ACCLAMATION: "Gospel Acclamation",
  GOSPEL: "Gospel",
  OTHER: "Reading",
};

/** One reading the Lectionary offers for a section ("A or B" gives two). */
export interface ReadingAlternative {
  /** The lectionary citation, exactly as the Lectionary prints it. */
  citation: string;
  /** Douay-Rheims text, or null when the alignment is not certain. */
  body: string | null;
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
  /** Text of the primary alternative; null when it is citation-only. */
  body: string | null;
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

/** Resolve one citation (a single alternative) to its Douay-Rheims text. */
export function resolveAlternative(citation: string): ReadingAlternative {
  const passage = resolveDouayPassage(citation);
  return {
    citation,
    body: passage.text && passage.text.length > 0 ? passage.text : null,
    douayCitation: passage.douayCitation,
    alignment: passage.alignment,
    partialVerses: readsPartialVerses(citation),
    note: passage.note ?? null,
  };
}

/** Resolve one table section (citations only) into a rendered section. */
export function resolveLectionarySection(section: LectionarySection): ResolvedReadingSection {
  const alternatives = splitAlternatives(section.citation).map(resolveAlternative);
  // A citation that does not split at all still has one alternative; a citation
  // that somehow yields none must not crash the day.
  const primary = alternatives[0] ?? resolveAlternative(section.citation);
  const response = responseCitation(section);
  return {
    kind: section.kind,
    label: section.label ?? KIND_LABEL[section.kind] ?? KIND_LABEL.OTHER,
    citation: section.citation,
    body: primary.body,
    douayCitation: primary.douayCitation,
    alignment: primary.alignment,
    partialVerses: primary.partialVerses,
    note: primary.note,
    alternatives: alternatives.length > 0 ? alternatives : [primary],
    response: response ? resolveAlternative(response) : null,
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
      number: lookup.number,
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
