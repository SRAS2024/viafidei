/**
 * Parser for the catholic-resources.org lectionary index (Rev. Felix Just, S.J.).
 *
 * The pages are hand-written 1990s HTML: one wide table per season whose first
 * row names the columns ("Lect. #", "Day", "First Reading: Year I", …). Several
 * pages repeat that header mid-table to start a new section, so the column map
 * is re-derived every time a header row is seen rather than only once.
 *
 * Material provided by Rev. Felix Just, S.J., at http://catholic-resources.org
 * (free for not-for-profit use with credit).
 */

import type {
  LectionaryCycle,
  LectionaryEntryKind,
  SundayCycle,
} from "../../../src/lib/content-shared/lectionary/types";
import type { ReadingKind } from "../../../src/lib/content-shared/daily-readings";
import { extractTables } from "./html";
import { normaliseCell } from "./citations";

export interface CrSection {
  kind: ReadingKind;
  cycle: LectionaryCycle | null;
  citation: string;
}

export interface CrEntry {
  /** Lectionary number, cleaned of footnote markers ("187*" → "187"). */
  number: string;
  label: string;
  /** Sunday cycle the row is printed for ("… – A"), null for an ABC row. */
  cycle: SundayCycle | null;
  kind: LectionaryEntryKind;
  /** Mass formulary within the day ("vigil", "night", "dawn", "day", …). */
  variant: string | null;
  /** "MM-DD" when the row is anchored to a calendar date (sanctoral, Dec/Jan). */
  monthDay: string | null;
  sections: CrSection[];
}

export interface CrParseResult {
  entries: CrEntry[];
  /** Cells that could not be normalised into a parseable citation. */
  unparsed: string[];
}

interface ColumnMap {
  number: number;
  label: number;
  monthDay: number | null;
  sections: Array<{ index: number; kind: ReadingKind; cycle: LectionaryCycle | null }>;
}

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

/** Cycle a "First Reading: Year I" style column header applies to. */
function columnCycle(header: string): LectionaryCycle | null {
  if (/years?\s+i\s*(&|and)\s*ii/i.test(header)) return null;
  if (/year\s+ii\b/i.test(header)) return "II";
  if (/year\s+i\b/i.test(header)) return "I";
  return null;
}

function classifyColumn(header: string): ReadingKind | null {
  const h = header.toLowerCase();
  if (/^first\s*reading/.test(h)) return "FIRST_READING";
  if (/responsorial/.test(h)) return "PSALM";
  if (/^second\s*reading/.test(h)) return "SECOND_READING";
  if (/alleluia|verse before the gospel/.test(h)) return "ACCLAMATION";
  if (/^gospel/.test(h)) return "GOSPEL";
  return null;
}

/** A row is a header when it names at least two reading columns and a number column. */
function readHeader(row: string[]): ColumnMap | null {
  let number: number | null = null;
  let label: number | null = null;
  let monthDay: number | null = null;
  const sections: ColumnMap["sections"] = [];
  row.forEach((cell, index) => {
    const h = cell.toLowerCase().replace(/\s+/g, " ").trim();
    const kind = classifyColumn(h);
    if (kind) {
      sections.push({ index, kind, cycle: columnCycle(cell) });
      return;
    }
    if (number === null && (/^lect\.?\s*#?$/.test(h) || h === "#")) number = index;
    else if (label === null && /^(day|sunday|sunday or feast|saint|date & name)/.test(h))
      label = index;
    else if (monthDay === null && /^date$/.test(h)) monthDay = index;
  });
  if (number === null || sections.length < 2) return null;
  // "Sunday or Feast - Year" pages put the label after the number; the Solemnities
  // supplement merges the date INTO the label column ("Feb. 2: The Presentation").
  if (label === null) label = number + 1 < row.length ? number + 1 : number;
  return { number, label, monthDay, sections };
}

/** "187*", "697 17", "510/1", "21 †" → "187", "697", "510/1", "21"; bracketed → null. */
export function cleanLectionaryNumber(cell: string): string | null {
  const t = cell.replace(/ /g, " ").trim();
  if (t.startsWith("[")) return null; // a cross-reference to another table, not a formulary
  const m = t.match(/^(\d{1,4}(?:[/.]\d+)?[A-Z]?)/);
  return m ? m[1] : null;
}

const ORDINAL_RE = /(\d+)\s*(?:st|nd|rd|th)\b/gi;

/** "1 st Sunday of Advent - A" → "1st Sunday of Advent - A". */
export function tidyLabel(label: string): string {
  return label
    .replace(/ /g, " ")
    .replace(ORDINAL_RE, (_, n: string) => `${n}${ordinalSuffix(Number(n))}`)
    .replace(/\s+/g, " ")
    .trim();
}

function ordinalSuffix(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

/** Trailing "– A" / "- ABC" / "– Years ABC" cycle marker of a Sunday row. */
export function labelCycle(label: string): SundayCycle | null {
  const m = label.match(/[–—-]\s*(?:years?\s+)?(A|B|C|ABC)\b(?![a-z])/i);
  if (!m) return null;
  const letters = m[1].toUpperCase();
  return letters.length === 1 ? (letters as SundayCycle) : null;
}

/** Mass formulary named inside a day label, e.g. "At the Vigil Mass". */
export function labelVariant(label: string): string | null {
  const l = label.toLowerCase();
  if (/extended (form|vigil)/.test(l)) return "extended-vigil";
  if (/chrism/.test(l)) return "chrism";
  if (/procession with palms/.test(l)) return "procession";
  if (/vigil/.test(l)) return "vigil";
  if (/during the night|easter vigil in the holy night/.test(l)) return "night";
  if (/at dawn/.test(l)) return "dawn";
  if (/during the day|mass of easter day/.test(l)) return "day";
  if (/optional mass/.test(l)) return "optional";
  return null;
}

/** "Jan. 2", "Feb. 2: The Presentation", "Dec. 26 – Feast of St. Stephen" → "01-02". */
export function labelMonthDay(text: string): string | null {
  const m = text.match(
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})\b/,
  );
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  if (!month) return null;
  const day = Number(m[2]);
  if (day < 1 || day > 31) return null;
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Parse one catholic-resources page into lectionary entries. `kind` says which
 * table of the Lectionary the page belongs to (the page itself never says).
 */
export function parseCatholicResourcesPage(html: string, kind: LectionaryEntryKind): CrParseResult {
  const entries: CrEntry[] = [];
  const unparsed: string[] = [];
  for (const table of extractTables(html)) {
    let columns: ColumnMap | null = null;
    for (const row of table) {
      const header = readHeader(row);
      if (header) {
        columns = header;
        continue;
      }
      if (!columns) continue;
      const numberCell = row[columns.number];
      if (numberCell === undefined) continue;
      const number = cleanLectionaryNumber(numberCell);
      if (!number) continue;
      const rawLabel = row[columns.label] ?? "";
      const label = tidyLabel(rawLabel);
      if (label.length === 0) continue;

      const sections: CrSection[] = [];
      for (const column of columns.sections) {
        const cell = row[column.index];
        if (cell === undefined) continue;
        const parsed = normaliseCell(cell, { assumePsalm: column.kind === "PSALM" });
        unparsed.push(...parsed.unparsed);
        for (const citation of parsed.citations) {
          // A cell split "A: … B: … C: …" carries its own Sunday cycle; otherwise
          // the column header's Year I / Year II applies.
          sections.push({
            kind: column.kind,
            cycle: citation.cycle ?? column.cycle,
            citation: citation.citation,
          });
        }
      }
      // Rows that only cross-reference another table ("see the Sunday Lectionary")
      // carry no citations of their own and are not formularies.
      if (sections.length === 0) continue;

      const monthDayCell = columns.monthDay === null ? null : (row[columns.monthDay] ?? null);
      entries.push({
        number,
        label,
        cycle: labelCycle(label),
        kind,
        variant: labelVariant(label),
        monthDay: (monthDayCell ? labelMonthDay(monthDayCell) : null) ?? labelMonthDay(label),
        sections,
      });
    }
  }
  return { entries, unparsed };
}
