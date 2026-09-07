/**
 * Parser for the westhong/catholic-daily-readings dataset (MIT): a JSON map of
 * civil date → the Masses the USCCB published for that date, each with its
 * Lectionary number and the citation of every section.
 *
 * The dataset is DATED, not keyed: it is the join partner that turns the
 * calendar engine's `lectionaryKey` into a Lectionary number (see build-tables).
 */

import type { ReadingKind } from "../../../src/lib/content-shared/daily-readings";
import { isEmptyCitationCell, normaliseCitation, stripAnnotations } from "./citations";

export interface WesthongSection {
  kind: ReadingKind;
  /** Canonical citation; " or " joins the alternatives the USCCB offers. */
  citation: string;
}

export interface WesthongMass {
  date: string;
  /** Lectionary number as a string, or null when the dataset has none. */
  number: string | null;
  /** The dataset's own label for the Mass formulary ("default", "Vigil", "YearA"). */
  mass: string;
  /** USCCB page title for the celebration. */
  feast: string;
  sections: WesthongSection[];
}

export interface WesthongParseResult {
  days: Map<string, WesthongMass[]>;
  unparsed: string[];
}

const FIELD_KINDS: ReadonlyArray<readonly [string, ReadingKind]> = [
  ["first_reading", "FIRST_READING"],
  ["responsorial_psalm", "PSALM"],
  ["second_reading", "SECOND_READING"],
  ["alleluia", "ACCLAMATION"],
  ["gospel", "GOSPEL"],
];

interface RawCitation {
  citation?: unknown;
  sources?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The dataset records every site it scraped a citation from. Only the USCCB is
 * authoritative for the US Lectionary, so a section keeps the USCCB citations
 * when it has any and falls back to the rest only when it has none.
 */
function preferUsccb(entries: RawCitation[]): RawCitation[] {
  const usccb = entries.filter(
    (e) => Array.isArray(e.sources) && e.sources.some((s) => String(s).toUpperCase() === "USCCB"),
  );
  return usccb.length > 0 ? usccb : entries;
}

export function parseWesthong(raw: unknown): WesthongParseResult {
  const days = new Map<string, WesthongMass[]>();
  const unparsed: string[] = [];
  if (!isRecord(raw)) return { days, unparsed };
  for (const [date, value] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(value)) continue;
    const masses: WesthongMass[] = [];
    for (const entry of value) {
      if (!isRecord(entry)) continue;
      const readings = isRecord(entry.readings) ? entry.readings : {};
      const sections: WesthongSection[] = [];
      for (const [field, kind] of FIELD_KINDS) {
        const list = readings[field];
        if (!Array.isArray(list) || list.length === 0) continue;
        const citations: string[] = [];
        for (const item of preferUsccb(list.filter(isRecord) as RawCitation[])) {
          const raw = typeof item.citation === "string" ? item.citation : "";
          // The pages carry editorial notes the tables do not ("Is 61:1 (cited in Lk 4:18)").
          const text = stripAnnotations(raw);
          if (text.length === 0 || isEmptyCitationCell(text)) continue;
          const normalised = normaliseCitation(text, { assumePsalm: kind === "PSALM" });
          if (normalised) citations.push(normalised);
          else unparsed.push(`${date} ${field}: ${raw}`);
        }
        // The USCCB prints alternatives on one line ("Jn 20:1-9 or Mt 28:1-10");
        // the dataset splits them into separate rows, so join them back.
        const unique = [...new Set(citations)];
        if (unique.length > 0) sections.push({ kind, citation: unique.join(" or ") });
      }
      const number = entry.lectionary_number;
      masses.push({
        date,
        number:
          typeof number === "number" && Number.isFinite(number)
            ? String(number)
            : typeof number === "string" && number.trim().length > 0
              ? number.trim()
              : null,
        mass: typeof entry.mass === "string" && entry.mass.length > 0 ? entry.mass : "default",
        feast: typeof entry.feast === "string" ? entry.feast.replace(/\s+/g, " ").trim() : "",
        sections,
      });
    }
    if (masses.length > 0) days.set(date, masses);
  }
  return { days, unparsed };
}
