/**
 * Pure helpers for daily liturgical readings (no DB, no network).
 *
 * Shared by the public readings page and the worker's refresh job so both
 * agree on the structure of a day's readings and its liturgical framing.
 * The actual reading *text* is only ever supplied from a trusted source by
 * the worker — these helpers never invent it.
 */

import { resolveLiturgicalDay, usccbReadingsUrl } from "./liturgical-calendar";

export type ReadingKind =
  | "FIRST_READING"
  | "PSALM"
  | "SECOND_READING"
  | "ACCLAMATION"
  | "GOSPEL"
  | "OTHER";

export interface ReadingSection {
  kind: ReadingKind;
  label: string;
  /** Scripture citation, e.g. "Is 7:10-14". Null until a source fills it. */
  citation: string | null;
  /** The reading text. Null until verified from a trusted source. */
  body: string | null;
}

export interface ReadingFraming {
  /** ISO civil date (YYYY-MM-DD). */
  date: string;
  /** The exact liturgical celebration, e.g. "The Most Holy Trinity",
   *  "Tuesday of the 23rd Week in Ordinary Time" (General Roman Calendar). */
  celebration: string;
  /** Stable Proper-of-Time key the lectionary is indexed on. */
  lectionaryKey: string;
  /** "SOLEMNITY" | "FEAST" | "SUNDAY" | "WEEKDAY". */
  rank: string;
  seasonLabel: string;
  sundayCycle: string;
  weekdayCycle: string;
  color: string;
  isJubileeYear: boolean;
  isSunday: boolean;
  sourceUrl: string;
  sourceName: string;
  sections: ReadingSection[];
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isSunday(date: Date): boolean {
  return date.getUTCDay() === 0;
}

/**
 * The standard Roman-Rite Mass section skeleton. Sundays and solemnities
 * add a Second Reading; we include it on Sundays (solemnity detection
 * requires the full calendar, which a trusted source supplies). Bodies and
 * citations start null and are filled only from a verified source.
 */
export function buildReadingSkeleton(
  date: Date,
  opts?: { secondReading?: boolean },
): ReadingSection[] {
  const sections: ReadingSection[] = [
    { kind: "FIRST_READING", label: "First Reading", citation: null, body: null },
    { kind: "PSALM", label: "Responsorial Psalm", citation: null, body: null },
  ];
  // Sundays AND solemnities carry a Second Reading (the latter even on
  // weekdays — e.g. the Ascension, the Nativity, Mary Mother of God). When the
  // caller hasn't resolved the rank, fall back to the Sunday rule.
  if (opts?.secondReading ?? isSunday(date)) {
    sections.push({ kind: "SECOND_READING", label: "Second Reading", citation: null, body: null });
  }
  sections.push({ kind: "ACCLAMATION", label: "Gospel Acclamation", citation: null, body: null });
  sections.push({ kind: "GOSPEL", label: "Gospel", citation: null, body: null });
  return sections;
}

/** Deterministic liturgical framing + skeleton for a date (no network). */
export function buildReadingFraming(date: Date): ReadingFraming {
  const day = resolveLiturgicalDay(date);
  return {
    date: isoDate(date),
    celebration: day.celebration,
    lectionaryKey: day.lectionaryKey,
    rank: day.rank,
    seasonLabel: day.seasonLabel,
    sundayCycle: day.sundayCycle,
    weekdayCycle: day.weekdayCycle,
    color: day.color,
    isJubileeYear: day.isJubileeYear,
    isSunday: isSunday(date),
    sourceUrl: usccbReadingsUrl(date),
    sourceName: "USCCB",
    sections: buildReadingSkeleton(date, {
      secondReading: day.rank === "SOLEMNITY" || isSunday(date),
    }),
  };
}

/**
 * Overlay stored sections (which may carry verified bodies/citations) onto
 * the skeleton, matching by kind. Keeps skeleton order; ignores stored
 * sections with no usable content.
 */
export function mergeSections(
  skeleton: ReadingSection[],
  stored: ReadingSection[] | null | undefined,
): ReadingSection[] {
  if (!stored || stored.length === 0) return skeleton;
  const byKind = new Map<string, ReadingSection>();
  for (const s of stored) byKind.set(s.kind, s);
  const merged = skeleton.map((sk) => {
    const st = byKind.get(sk.kind);
    if (!st) return sk;
    return {
      kind: sk.kind,
      label: st.label || sk.label,
      citation: st.citation ?? sk.citation,
      body: st.body ?? sk.body,
    };
  });
  // Include any extra stored sections the skeleton didn't anticipate.
  for (const st of stored) {
    if (!merged.some((m) => m.kind === st.kind)) merged.push(st);
  }
  return merged;
}

export function hasAnyBody(sections: ReadingSection[]): boolean {
  return sections.some((s) => typeof s.body === "string" && s.body.trim().length > 0);
}
