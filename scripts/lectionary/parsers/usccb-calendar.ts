/**
 * Parser for the USCCB "Liturgical Calendar for the Dioceses of the United
 * States of America" (the annual PDF, converted to text). It is the official
 * source for the celebration observed on each date and for its Lectionary
 * number, and it reaches a year further forward than the readings dataset.
 *
 * Layout, after the front matter:
 *   NOVEMBER–DECEMBER 2025            ← a month heading
 *   30 SUN FIRST SUNDAY OF ADVENT violet
 *   Is 2:1-5/Rom 13:11-14/Mt 24:37-44 (1) Pss I
 * The day number restarts each month, so the running month is advanced whenever
 * a day number goes backwards, and every date is CHECKED against the weekday
 * the calendar prints — a heading the converter dropped would otherwise shift
 * a whole month of readings onto the wrong dates.
 */

import type { ReadingKind } from "../../../src/lib/content-shared/daily-readings";
import { normaliseCitation, stripAnnotations } from "./citations";

export interface UsccbMass {
  /** Lectionary number, e.g. "1", "690A". */
  number: string;
  /** Mass formulary named on the line, when the calendar distinguishes several. */
  variant: string | null;
  /**
   * The celebration of the BLOCK this Mass belongs to. The calendar repeats the
   * day line for a celebration observed only in some provinces ("14 Thu THE
   * ASCENSION…" then "14 Thu Saint Matthias, Apostle"), so each block carries
   * its own title and the join can pick the one the engine actually observes.
   */
  celebration: string;
  /** First/Second/Gospel only — the calendar omits psalm and acclamation. */
  sections: Array<{ kind: ReadingKind; citation: string }>;
}

export interface UsccbCalendarDay {
  date: string;
  /** The celebration of the first block, e.g. "FIRST SUNDAY OF ADVENT". */
  celebration: string;
  masses: UsccbMass[];
}

export interface UsccbCalendarParseResult {
  days: Map<string, UsccbCalendarDay>;
  warnings: string[];
}

const MONTH_NAMES = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
];

const DOW_TOKENS: Record<string, number> = {
  SUN: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const MONTH_HEADING_RE = new RegExp(
  `^(?:(${MONTH_NAMES.join("|")})[–—-])?(${MONTH_NAMES.join("|")})\\s+(\\d{4})$`,
);
const DAY_RE = /^(\d{1,2})\s+(SUN|Mon|Tue|Wed|Thu|Fri|Sat)\b\s*(.*)$/;
/**
 * A footnote: its marker is a bare number and its text is prose. Footnotes quote
 * Lectionary numbers ("The following readings may be used … (243)"), so one that
 * reached the day it follows would file the wrong formulary under that date.
 */
const FOOTNOTE_RE = /^\d{1,2}\s+(?:[A-Z"“][a-z]|[a-z])/;
/** A citation line: "Is 2:1-5/Rom 13:11-14/Mt 24:37-44 (1) Pss I". */
const NUMBER_RE = /\((\d{1,4}[A-Z]?)\)/;

/** Drop the trailing vestment colour the calendar prints after every title. */
function stripColour(text: string): string {
  return text
    .replace(/\s+(violet|white|red|green|rose)(\s*\/\s*(violet|white|red|green|rose))?\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dayOfWeek(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** The Mass formulary a Christmas / solemnity line names, if any. */
function lineVariant(text: string): string | null {
  const t = text.toLowerCase();
  // Christmas prints its four formularies as "Vigil:", "Night:", "Dawn:", "Day:".
  const labelled = t.match(/^(vigil|night|dawn|day|chrism)\s*:/);
  if (labelled) return labelled[1];
  // "or, for Year A, Ez 37:12-14/…" — the Lent scrutiny formulary a parish may
  // use in Years B and C.
  const year = t.match(/\bfor\s+year\s+([abc])\b|\byear\s+([abc])\s+readings\b/);
  if (year) return `year-${year[1] ?? year[2]}`;
  if (/chrism/.test(t)) return "chrism";
  if (/extended (form|vigil)/.test(t)) return "extended-vigil";
  if (/vigil/.test(t)) return "vigil";
  if (/during the night|at night/.test(t)) return "night";
  if (/at dawn/.test(t)) return "dawn";
  if (/during the day/.test(t)) return "day";
  return null;
}

/**
 * Split a citation line into its readings. The calendar joins them with "/",
 * and the last one carries the Lectionary number in parentheses.
 */
function parseCitationLine(line: string): Array<{ kind: ReadingKind; citation: string }> {
  const body = line
    // "Chrism Mass: Is 61:1-3a…", "Vigil: Is 62:1-5…" — a formulary label. The
    // colon of a chapter:verse always follows a DIGIT, so a colon after a letter
    // can only end a label.
    .replace(/^[^/]*?[A-Za-z]\s*:\s+/, "")
    .replace(NUMBER_RE, " ")
    .replace(/\bPss\b.*$/, " ");
  const parts = body
    .split("/")
    .map((p) => stripAnnotations(p))
    .filter((p) => p.length > 0);
  if (parts.length < 2) return [];
  const out: Array<{ kind: ReadingKind; citation: string }> = [];
  parts.forEach((part, index) => {
    // Two readings = First + Gospel (a weekday); three = First + Second + Gospel.
    const kind: ReadingKind =
      index === parts.length - 1 ? "GOSPEL" : index === 0 ? "FIRST_READING" : "SECOND_READING";
    const citation = normaliseCitation(part);
    if (citation) out.push({ kind, citation });
  });
  return out;
}

export function parseUsccbCalendar(text: string): UsccbCalendarParseResult {
  const days = new Map<string, UsccbCalendarDay>();
  const warnings: string[] = [];
  let year: number | null = null;
  let month: number | null = null;
  let lastDay = 0;
  let current: UsccbCalendarDay | null = null;
  let blockCelebration = "";
  let blockMasses = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/ /g, " ").trim();
    if (line.length === 0) continue;

    const heading = line.match(MONTH_HEADING_RE);
    if (heading) {
      // "NOVEMBER–DECEMBER 2025" starts in the FIRST of the two months.
      month = MONTH_NAMES.indexOf(heading[1] ?? heading[2]) + 1;
      year = Number(heading[3]);
      lastDay = 0;
      current = null;
      blockMasses = 0;
      continue;
    }
    if (year === null || month === null) continue;

    if (FOOTNOTE_RE.test(line) && !DAY_RE.test(line)) {
      current = null;
      continue;
    }

    const dayMatch = line.match(DAY_RE);
    if (dayMatch) {
      const day = Number(dayMatch[1]);
      let m: number = month;
      let y: number = year;
      if (day < lastDay) {
        m += 1;
        if (m > 12) {
          m = 1;
          y += 1;
        }
      }
      // The printed weekday is the check that the running month is still right.
      if (dayOfWeek(y, m, day) !== DOW_TOKENS[dayMatch[2]]) {
        warnings.push(`${iso(y, m, day)} is not ${dayMatch[2]} — month tracking lost`);
        current = null;
        continue;
      }
      month = m;
      year = y;
      lastDay = day;
      const date = iso(y, m, day);
      const rest = dayMatch[3];
      // A short day often prints its celebration AND its readings on one line
      // ("6 Mon Monday within the Octave of Easter Acts 2:14, 22-33/… (261)").
      const inlineLabel = rest.match(/^[^/]*?[A-Za-z]\s*:\s+/);
      blockCelebration = stripColour(
        NUMBER_RE.test(rest)
          ? inlineLabel
            ? rest.slice(0, inlineLabel[0].length - 1)
            : rest
          : rest,
      );
      blockMasses = 0;
      current = days.get(date) ?? { date, celebration: blockCelebration, masses: [] };
      days.set(date, current);
      const inlineNumber = rest.match(NUMBER_RE)?.[1];
      if (inlineNumber) {
        blockMasses += 1;
        current.masses.push({
          number: inlineNumber,
          variant: lineVariant(rest),
          celebration: blockCelebration,
          sections: parseCitationLine(rest),
        });
      }
      continue;
    }

    if (!current) continue;
    if (!NUMBER_RE.test(line)) {
      // The PDF wraps a long celebration name and prints its rank on the next
      // line; a line with a digit is a citation or a footnote, never a title.
      if (blockMasses === 0 && !/\d/.test(line) && line.length < 90 && /^[A-Za-z[]/.test(line)) {
        blockCelebration = stripColour(`${blockCelebration} ${line}`);
      }
      continue;
    }
    const number = line.match(NUMBER_RE)?.[1];
    if (!number) continue;
    blockMasses += 1;
    current.masses.push({
      number,
      variant: lineVariant(line),
      celebration: blockCelebration,
      sections: parseCitationLine(line),
    });
  }
  return { days, warnings };
}
