/**
 * Build the committed lectionary tables under
 * src/lib/content-shared/lectionary/tables/ from the three offline sources.
 *
 *   npx tsx scripts/lectionary/build-tables.ts [--sources <dir>] [--check]
 *
 * The script is idempotent and OFFLINE: it never fetches anything, and re-running
 * it on the same sources rewrites byte-identical JSON (keys sorted, arrays in a
 * fixed order), so `--check` can assert in CI that the committed tables still
 * match the sources.
 *
 * Sources (not committed — see the README section in the build report):
 *   cr/*.htm                  catholic-resources.org lectionary index
 *                             (Material provided by Rev. Felix Just, S.J., at
 *                             http://catholic-resources.org)
 *   westhong-readings.json    westhong/catholic-daily-readings (MIT), USCCB-derived
 *   usccb-YYYYcal.txt         USCCB Liturgical Calendar for the Dioceses of the USA
 *
 * The tables carry CITATIONS and labels only — never Scripture text.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";

import {
  resolveLiturgicalDay,
  type LiturgicalDayDetail,
} from "../../src/lib/content-shared/liturgical-calendar";
import type { ReadingKind } from "../../src/lib/content-shared/daily-readings";
import type {
  KeyMapEntry,
  KeyMapMass,
  LectionaryByNumber,
  LectionaryCycle,
  LectionaryEntryKind,
  LectionaryIndex,
  LectionarySection,
  LectionarySource,
  SundayCycle,
} from "../../src/lib/content-shared/lectionary/types";
import {
  READING_ORDER,
  compareLectionaryNumbers,
  labelSlug,
} from "../../src/lib/content-shared/lectionary/keys";
import { parseCatholicResourcesPage, type CrEntry } from "./parsers/catholic-resources";
import { parseWesthong, type WesthongMass } from "./parsers/westhong";
import { parseUsccbCalendar, type UsccbMass } from "./parsers/usccb-calendar";
import { keyFromCatholicResourcesLabel } from "./key-labels";

const OUTPUT_DIR = path.join(process.cwd(), "src/lib/content-shared/lectionary/tables");
const DEFAULT_SOURCE_DIR = path.join(process.cwd(), "data/lectionary/sources");
/** The years the dated sources cover; the join runs over all of them. */
const FIRST_YEAR = 2023;
const LAST_YEAR = 2028;

const CR_PAGES: ReadonlyArray<readonly [string, LectionaryEntryKind]> = [
  ["1998USL-Advent.htm", "sunday"],
  ["1998USL-Christmas.htm", "sunday"],
  ["1998USL-Lent.htm", "sunday"],
  ["1998USL-Easter.htm", "sunday"],
  ["1998USL-OrdinaryA.htm", "sunday"],
  ["1998USL-OrdinaryB.htm", "sunday"],
  ["1998USL-OrdinaryC.htm", "sunday"],
  ["1998USL-Solemnities.htm", "sunday"],
  ["2002USL-Weekdays-AdventChristmas.htm", "weekday"],
  ["2002USL-Weekdays-Lent.htm", "weekday"],
  ["2002USL-Weekdays-Easter.htm", "weekday"],
  ["2002USL-Weekdays-OT-I.htm", "weekday"],
  ["2002USL-Weekdays-OT-II.htm", "weekday"],
  ["2002USL-Sanctoral.htm", "sanctoral"],
];

const USCCB_CALENDARS = [2026, 2027, 2028];

// ─────────────────────────────────────────────────────────────────────────────
// Mass formularies
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The readings dataset labels each formulary in its own way. Map those labels
 * onto the variant names the key map uses; `null` means "the principal Mass".
 * "YearA"/"YearB"/"YearC" are resolved against the date's own cycle: the letter
 * that matches the year IS the principal Mass, the others are the alternative
 * formularies (the Year A scrutiny readings kept for parishes with catechumens).
 */
const MASS_VARIANTS: Record<string, string | null> = {
  ascension: null,
  alternate: null,
  chrism: "chrism",
  dawn: "dawn",
  day: "day",
  default: null,
  eveningmass: null,
  extended: "extended-vigil",
  extendedvigil: "extended-vigil",
  mass: null,
  night: "night",
  ord: null,
  sunday: null,
  supper: null,
  thanksgiving: "thanksgiving",
  thurs: null,
  thursday: null,
  vigil: "vigil",
};

/** Priority used to name the principal Mass of a day that has no plain formulary. */
const PRINCIPAL_PRIORITY = ["day", "night", "dawn", "vigil", "chrism", "extended-vigil"];

function massVariant(label: string, sundayCycle: SundayCycle): string | null | undefined {
  const key = label.toLowerCase().replace(/[^a-z]/g, "");
  const year = key.match(/^year([abc])$/);
  if (year) {
    const letter = year[1].toUpperCase() as SundayCycle;
    return letter === sundayCycle ? null : `year-${year[1]}`;
  }
  return MASS_VARIANTS[key];
}

const STOP_WORDS = new Set([
  "the",
  "of",
  "in",
  "a",
  "and",
  "at",
  "for",
  "on",
  "to",
  "mass",
  "solemnity",
  "feast",
  "memorial",
  "day",
  "us",
  "usa",
  "readings",
  "holyday",
  "obligation",
]);

function significantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w)),
  );
}

/** Jaccard overlap of the significant words of two celebration titles. */
function titleSimilarity(a: string, b: string): number {
  const left = significantWords(a);
  const right = significantWords(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / (left.size + right.size - shared);
}

// ─────────────────────────────────────────────────────────────────────────────
// Observations
// ─────────────────────────────────────────────────────────────────────────────

interface Observation {
  date: string;
  day: LiturgicalDayDetail;
  /** Lectionary number → the sections that source gave for it on that date. */
  sections: Array<{ kind: ReadingKind; citation: string }>;
  source: LectionarySource;
  feast: string;
}

interface MassObservation {
  number: string;
  variant: string | null;
  feast: string;
}

/** What the engine calls a key, and the calendar date it was seen on. */
interface KeyIdentity {
  celebration: string;
  monthDay: string;
}

interface KeyObservation {
  day: LiturgicalDayDetail;
  masses: MassObservation[];
  /** How far the source that supplied these numbers is trusted (SOURCE_WEIGHT). */
  weight: number;
}

function tally<T>(values: T[]): Map<T, number> {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

/** Most frequent value; ties break on the value's own sort order for determinism. */
function winner<T extends string>(values: T[]): T | null {
  if (values.length === 0) return null;
  const counts = [...tally(values).entries()].sort(
    (a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])),
  );
  return counts[0][0];
}

/**
 * The official calendar outranks the scraped readings dataset: where a year has
 * both, they agree; where only the dataset covers a year, its Lectionary number
 * is occasionally the vigil's or a neighbouring weekday's. Weighting the vote
 * lets one calendar year settle a tie against one dataset year.
 */
const SOURCE_WEIGHT: Record<LectionarySource, number> = {
  usccb: 1,
  "usccb-calendar": 3,
  "catholic-resources": 1,
};

function weightedWinner(entries: Array<{ value: string; weight: number }>): string | null {
  if (entries.length === 0) return null;
  const totals = new Map<string, number>();
  for (const entry of entries)
    totals.set(entry.value, (totals.get(entry.value) ?? 0) + entry.weight);
  return [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

/**
 * Two citations that name the same verses. The daily pages drop the sub-verse
 * letters the printed Lectionary keeps ("3-4a, 4b-5" → "3-4, 4-5") and write
 * "," where the Lectionary prints a "+" join, so neither difference is a real
 * disagreement about what is read.
 */
function equivalentCitations(a: string, b: string): boolean {
  const strip = (citation: string): string =>
    citation
      .replace(/(\d)[a-f]+/g, "$1")
      .replace(/\s+and\s+/g, ", ")
      .replace(/\s+/g, " ")
      .trim();
  return a === b || strip(a) === strip(b);
}

function entryKindForNumber(number: string): LectionaryEntryKind {
  const n = Number.parseInt(number, 10);
  if (!Number.isFinite(n)) return "common";
  if (n < 175) return "sunday";
  if (n < 510) return "weekday";
  if (n < 700) return "sanctoral";
  return "common";
}

// ─────────────────────────────────────────────────────────────────────────────
// Build
// ─────────────────────────────────────────────────────────────────────────────

interface BuildReport {
  crEntries: number;
  crUnparsed: string[];
  westhongDays: number;
  westhongUnparsed: string[];
  usccbWarnings: string[];
  numbers: number;
  keys: number;
  keysFromDates: number;
  keysFromLabels: number;
  engineKeys: number;
  keysWithoutNumber: string[];
  disagreements: string[];
  citationDisagreements: string[];
}

interface Sources {
  cr: CrEntry[];
  crUnparsed: string[];
  westhong: Map<string, WesthongMass[]>;
  westhongUnparsed: string[];
  usccb: Map<string, UsccbMass[]>;
  usccbCelebration: Map<string, string>;
  usccbWarnings: string[];
}

function readSources(dir: string): Sources {
  const cr: CrEntry[] = [];
  const crUnparsed: string[] = [];
  for (const [file, kind] of CR_PAGES) {
    const full = path.join(dir, "cr", file);
    if (!existsSync(full)) throw new Error(`missing source ${full}`);
    const parsed = parseCatholicResourcesPage(readFileSync(full, "latin1"), kind);
    cr.push(...parsed.entries);
    crUnparsed.push(...parsed.unparsed);
  }

  const westhongPath = path.join(dir, "westhong-readings.json");
  if (!existsSync(westhongPath)) throw new Error(`missing source ${westhongPath}`);
  const westhong = parseWesthong(JSON.parse(readFileSync(westhongPath, "utf8")));

  const usccb = new Map<string, UsccbMass[]>();
  const usccbCelebration = new Map<string, string>();
  const usccbWarnings: string[] = [];
  for (const year of USCCB_CALENDARS) {
    const full = path.join(dir, `usccb-${year}cal.txt`);
    if (!existsSync(full)) throw new Error(`missing source ${full}`);
    const parsed = parseUsccbCalendar(readFileSync(full, "utf8"));
    usccbWarnings.push(...parsed.warnings.map((w) => `${year}: ${w}`));
    for (const [date, day] of parsed.days) {
      // Consecutive calendars overlap at Advent; the later book is the emendation.
      usccb.set(date, day.masses);
      usccbCelebration.set(date, day.celebration);
    }
  }

  return {
    cr,
    crUnparsed,
    westhong: westhong.days,
    westhongUnparsed: westhong.unparsed,
    usccb,
    usccbCelebration,
    usccbWarnings,
  };
}

function eachDate(from: number, to: number): string[] {
  const dates: string[] = [];
  const cursor = new Date(Date.UTC(from, 0, 1));
  const end = Date.UTC(to, 11, 31);
  while (cursor.getTime() <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/**
 * The Masses a date's sources offer, with their variant resolved and the ones
 * belonging to a DIFFERENT celebration dropped. Both sources list the Masses of
 * every option a diocese may take (Ascension Thursday vs Sunday, Thanksgiving,
 * the Year A scrutiny Gospels); only the formulary the engine's celebration
 * names is the principal Mass of that day's key.
 */
function massesForDate(
  day: LiturgicalDayDetail,
  raw: Array<{ number: string | null; label: string; feast: string }>,
): MassObservation[] {
  const classified: MassObservation[] = [];
  for (const mass of raw) {
    if (!mass.number) continue;
    const variant = massVariant(mass.label, day.sundayCycle);
    if (variant === undefined) continue; // an unknown formulary label — ignore it
    if (variant === "thanksgiving") continue; // a civic Mass, not the day's key
    classified.push({ number: mass.number, variant, feast: mass.feast });
  }
  if (classified.length === 0) return [];

  const principals = classified.filter((m) => m.variant === null);
  if (principals.length > 1) {
    // Several plain formularies means the sources list an alternative celebration
    // (e.g. Ascension Thursday alongside St Matthias). Keep the one whose title
    // matches the celebration the engine actually observes.
    const best = principals
      .map((m) => ({
        mass: m,
        score: Math.max(
          titleSimilarity(m.feast, day.celebration),
          titleSimilarity(m.feast, day.temporalCelebration),
        ),
      }))
      .sort((a, b) => b.score - a.score || a.mass.number.localeCompare(b.mass.number))[0];
    for (const other of principals) if (other !== best.mass) other.variant = "__drop__";
  }
  const kept = classified.filter((m) => m.variant !== "__drop__");
  // The principal Mass always comes first.
  if (kept.some((m) => m.variant === null)) {
    return [...kept].sort((a, b) => (a.variant === null ? 0 : 1) - (b.variant === null ? 0 : 1));
  }

  // Christmas and the vigil solemnities have no plain formulary. The Lectionary
  // prints the vigil BEFORE the Mass of the day (13-16, 586/587, 590/591,
  // 621/622), so the highest number is the principal Mass — a rule that survives
  // the sources mislabelling which of the pair is the vigil.
  return [...kept].sort(
    (a, b) =>
      compareLectionaryNumbers(b.number, a.number) ||
      PRINCIPAL_PRIORITY.indexOf(a.variant ?? "") - PRINCIPAL_PRIORITY.indexOf(b.variant ?? ""),
  );
}

function collectObservations(sources: Sources): {
  byNumber: Map<string, Observation[]>;
  byKey: Map<string, KeyObservation[]>;
  identities: Map<string, KeyIdentity>;
} {
  const byNumber = new Map<string, Observation[]>();
  const byKey = new Map<string, KeyObservation[]>();
  const identities = new Map<string, KeyIdentity>();

  for (const date of eachDate(FIRST_YEAR, LAST_YEAR)) {
    const day = resolveLiturgicalDay(new Date(`${date}T00:00:00Z`), { calendar: "roman-us" });
    if (!identities.has(day.lectionaryKey)) {
      identities.set(day.lectionaryKey, {
        celebration: day.celebration,
        monthDay: date.slice(5),
      });
    }
    const westhong = sources.westhong.get(date);
    const usccb = sources.usccb.get(date);
    // NUMBERS come from the official calendar wherever it reaches — the readings
    // dataset carries a scraped number that is wrong on a handful of dates
    // (2026-04-19 files the 3rd Sunday of Easter under #44). CITATIONS come from
    // the dataset, which is the only source with the psalm and the acclamation.
    const raw = usccb
      ? usccb.map((m) => ({
          number: m.number,
          label: m.variant ?? "default",
          feast: m.celebration,
        }))
      : (westhong ?? []).map((m) => ({ number: m.number, label: m.mass, feast: m.feast }));
    if (raw.length === 0) continue;

    const masses = massesForDate(day, raw);
    if (masses.length === 0) continue;
    // A memorial with only a proper GOSPEL keeps the weekday's other readings,
    // so the sources give this date the ferial number, which belongs to the
    // temporal key rather than to the memorial. Those keys are filled from the
    // Proper of Saints instead.
    if (day.sanctoral?.readings !== "proper-gospel") {
      const weight = SOURCE_WEIGHT[usccb ? "usccb-calendar" : "usccb"];
      const list = byKey.get(day.lectionaryKey);
      if (list) list.push({ day, masses, weight });
      else byKey.set(day.lectionaryKey, [{ day, masses, weight }]);
    }

    for (const mass of masses) {
      const fromWesthong =
        westhong?.find((m) => m.number === mass.number) ??
        westhong?.find((m) => massVariant(m.mass, day.sundayCycle) === mass.variant) ??
        (westhong?.length === 1 && masses.length === 1 ? westhong[0] : undefined);
      const sections =
        fromWesthong?.sections ?? usccb?.find((m) => m.number === mass.number)?.sections ?? [];
      if (sections.length === 0) continue;
      const observations = byNumber.get(mass.number) ?? [];
      observations.push({
        date,
        day,
        sections,
        source: fromWesthong ? "usccb" : "usccb-calendar",
        feast: mass.feast,
      });
      byNumber.set(mass.number, observations);
    }
  }
  return { byNumber, byKey, identities };
}

/**
 * Fill the keys the dated join deliberately skipped: a memorial whose Proper of
 * Saints supplies only the Gospel (Martha, the Passion of John the Baptist, Our
 * Lady of Sorrows, the Guardian Angels, the Immaculate Heart). The sources give
 * those dates the FERIAL number, so their own formulary has to come from the
 * Proper of Saints index, matched on the calendar date and the celebration name.
 */
function fillKeyMapFromSanctoral(
  map: Record<string, KeyMapEntry[]>,
  crRows: Map<string, CrEntry[]>,
  identities: Map<string, KeyIdentity>,
  report: BuildReport,
): void {
  const sanctoral: Array<{ number: string; label: string; monthDay: string | null }> = [];
  for (const [number, rows] of crRows) {
    for (const row of rows) {
      if (row.kind !== "sanctoral") continue;
      sanctoral.push({ number, label: row.label, monthDay: row.monthDay });
    }
  }
  for (const [key, identity] of [...identities.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    if (map[key]) continue;
    const sameDay = sanctoral.filter((row) => row.monthDay === identity.monthDay);
    // A movable memorial (the Immaculate Heart) is not printed under a date, so
    // fall back to matching its name across the whole Proper of Saints.
    const candidates = sameDay.length > 0 ? sameDay : sanctoral;
    const best = candidates
      .map((row) => ({ row, score: titleSimilarity(row.label, identity.celebration) }))
      .sort((a, b) => b.score - a.score || compareLectionaryNumbers(a.row.number, b.row.number))[0];
    if (!best || best.score < 0.34) continue;
    map[key] = [
      { cycle: null, masses: [{ number: best.row.number, variant: null }], source: "labels" },
    ];
    report.keysFromLabels += 1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Entries
// ─────────────────────────────────────────────────────────────────────────────

function mergeCrRows(rows: CrEntry[]): {
  label: string;
  kind: LectionaryEntryKind;
  cycle: SundayCycle | null;
  variant: string | null;
  monthDay: string | null;
  sections: Map<ReadingKind, Map<LectionaryCycle | null, string>>;
} {
  const cycles = new Set(rows.map((r) => r.cycle));
  // A number printed once per cycle ("The Holy Family - B") carries its cycle on
  // the SECTION; a number that belongs to one cycle only ("1st Sunday of Advent
  // - A") carries it on the entry, where the key map looks it up.
  const perSectionCycle = cycles.size > 1;
  const sections = new Map<ReadingKind, Map<LectionaryCycle | null, string>>();
  for (const row of rows) {
    for (const section of row.sections) {
      const cycle = section.cycle ?? (perSectionCycle ? row.cycle : null);
      const byCycle = sections.get(section.kind) ?? new Map<LectionaryCycle | null, string>();
      if (!byCycle.has(cycle)) byCycle.set(cycle, section.citation);
      sections.set(section.kind, byCycle);
    }
  }
  const entryCycles = [...cycles].filter((c): c is SundayCycle => c !== null);
  return {
    label: rows[0].label,
    kind: rows[0].kind,
    cycle: perSectionCycle || entryCycles.length === 0 ? null : entryCycles[0],
    variant: rows.find((r) => r.variant !== null)?.variant ?? null,
    monthDay: rows.find((r) => r.monthDay !== null)?.monthDay ?? null,
    sections,
  };
}

/**
 * Which cycles a section of this kind is printed for. The catholic-resources
 * columns are the structural authority (they name "First Reading: Year I"); when
 * a number is not in that index, an Ordinary-Time weekday is assumed to vary by
 * weekday cycle and everything else not to vary.
 */
function cyclesForKind(
  cr: ReturnType<typeof mergeCrRows> | undefined,
  kind: ReadingKind,
  entryKind: LectionaryEntryKind,
): Array<LectionaryCycle | null> {
  const printed = cr?.sections.get(kind);
  if (printed && printed.size > 0) return [...printed.keys()];
  if (entryKind === "weekday" && (kind === "FIRST_READING" || kind === "PSALM")) return ["I", "II"];
  return [null];
}

function observationCycle(day: LiturgicalDayDetail, cycle: LectionaryCycle | null): boolean {
  if (cycle === null) return true;
  if (cycle === "I" || cycle === "II") return day.weekdayCycle === cycle;
  return day.sundayCycle === cycle;
}

function buildEntries(
  crRows: Map<string, CrEntry[]>,
  observations: Map<string, Observation[]>,
  keyForNumber: Map<string, string>,
  report: BuildReport,
): LectionaryByNumber {
  const numbers = new Set([...crRows.keys(), ...observations.keys()]);
  const table: LectionaryByNumber = {};

  for (const number of numbers) {
    const rows = crRows.get(number);
    const cr = rows ? mergeCrRows(rows) : undefined;
    const observed = observations.get(number) ?? [];
    // The Lectionary NUMBER decides which table a formulary belongs to (1-174
    // Proper of Time Sundays, 175-509 weekdays, 510-699 Proper of Saints); the
    // catholic-resources page it was printed on does not — St Stephen (#696) is
    // listed on the Christmas weekday page but belongs to the Proper of Saints.
    const entryKind = entryKindForNumber(number) ?? cr?.kind ?? "common";

    const sections: LectionarySection[] = [];
    for (const kind of READING_ORDER) {
      const cycles = cyclesForKind(cr, kind, entryKind);
      const resolved: Array<{
        cycle: LectionaryCycle | null;
        citation: string;
        source: LectionarySource;
      }> = [];
      // Cycles that have a formulary of their own must not also vote in the
      // shared slot: #17's shared Gospel is the Holy Family's YEAR A Gospel, and
      // a Year B date would otherwise outvote it there.
      const taggedCycles = new Set(cycles.filter((c): c is LectionaryCycle => c !== null));
      for (const cycle of cycles) {
        const votes = observed
          .filter((o) => observationCycle(o.day, cycle))
          .filter(
            (o) =>
              cycle !== null ||
              (!taggedCycles.has(o.day.sundayCycle) && !taggedCycles.has(o.day.weekdayCycle)),
          )
          .flatMap((o) =>
            o.sections
              .filter((s) => s.kind === kind)
              .map((s) => ({ citation: s.citation, source: o.source })),
          );
        const observedCitation = winner(votes.map((v) => v.citation));
        const printedForCycle = cycle === null ? undefined : cr?.sections.get(kind)?.get(cycle);
        const printed = printedForCycle ?? cr?.sections.get(kind)?.get(null);
        // The printed index wins where it is the better witness:
        //  - a formulary the Lectionary prints FOR THIS CYCLE (the Holy Family's
        //    and the Baptism's optional Year B/C readings) — a dated source shows
        //    whichever formulary the parish used that year, not both;
        //  - the same verses with their sub-verse letters kept ("3-4a, 4b-5"
        //    against the daily page's "3-4, 4-5");
        //  - the same reading plus its short form ("… or 4:5-15, 19b-26, …").
        const keepPrinted =
          printed !== undefined &&
          (printedForCycle !== undefined ||
            observedCitation === null ||
            equivalentCitations(printed, observedCitation) ||
            printed.startsWith(`${observedCitation} or `));
        if (keepPrinted && printed) {
          if (observedCitation && !equivalentCitations(printed, observedCitation)) {
            report.citationDisagreements.push(
              `#${number} ${kind}${cycle ? ` (${cycle})` : ""}: kept catholic-resources "${printed}" over USCCB "${observedCitation}"`,
            );
          }
          resolved.push({
            cycle,
            citation: printed,
            // Identical strings: credit the day pages that corroborated it.
            source: votes.find((v) => v.citation === printed)?.source ?? "catholic-resources",
          });
        } else if (observedCitation) {
          if (printed && !equivalentCitations(printed, observedCitation)) {
            report.citationDisagreements.push(
              `#${number} ${kind}${cycle ? ` (${cycle})` : ""}: USCCB "${observedCitation}" vs catholic-resources "${printed}"`,
            );
          }
          const source = votes.find((v) => v.citation === observedCitation)?.source ?? "usccb";
          resolved.push({ cycle, citation: observedCitation, source });
        }
      }
      // Cycles that ended up identical are one section for every year.
      const distinct = new Set(resolved.map((r) => r.citation));
      if (resolved.length > 1 && distinct.size === 1) {
        sections.push({
          kind,
          cycle: null,
          citation: resolved[0].citation,
          source: resolved[0].source,
        });
      } else {
        const shared = resolved.find((r) => r.cycle === null)?.citation;
        for (const r of resolved) {
          // A cycle whose reading is the shared one adds nothing.
          if (r.cycle !== null && r.citation === shared) continue;
          sections.push({ kind, cycle: r.cycle, citation: r.citation, source: r.source });
        }
      }
    }
    if (sections.length === 0) continue;

    const observedCycles = new Set(observed.map((o) => o.day.sundayCycle));
    const label =
      cr?.label ??
      winner(observed.map((o) => o.feast).filter((f) => f.length > 0)) ??
      `Lectionary ${number}`;
    table[number] = {
      number,
      label,
      cycle: cr
        ? cr.cycle
        : entryKind === "sunday" && observedCycles.size === 1
          ? [...observedCycles][0]
          : null,
      kind: entryKind,
      variant: cr?.variant ?? winner(observed.map(() => "").filter((v) => v.length > 0)) ?? null,
      key: keyForNumber.get(number) ?? null,
      sections,
    };
  }
  return table;
}

// ─────────────────────────────────────────────────────────────────────────────
// Key map
// ─────────────────────────────────────────────────────────────────────────────

function massesEqual(a: KeyMapMass[], b: KeyMapMass[]): boolean {
  return (
    a.length === b.length &&
    a.every((m, i) => m.number === b[i].number && m.variant === b[i].variant)
  );
}

function summariseMasses(observations: KeyObservation[]): KeyMapMass[] {
  const principal = weightedWinner(
    observations.map((o) => ({
      value: `${o.masses[0].number}|${o.masses[0].variant ?? ""}`,
      weight: o.weight,
    })),
  );
  if (!principal) return [];
  const [principalNumber, principalVariant] = principal.split("|");
  const masses: KeyMapMass[] = [
    { number: principalNumber, variant: principalVariant.length > 0 ? principalVariant : null },
  ];
  const variants = new Map<string, Array<{ value: string; weight: number }>>();
  for (const observation of observations) {
    for (const mass of observation.masses.slice(1)) {
      if (mass.variant === null) continue;
      variants.set(mass.variant, [
        ...(variants.get(mass.variant) ?? []),
        { value: mass.number, weight: observation.weight },
      ]);
    }
  }
  for (const variant of [...variants.keys()].sort()) {
    const number = weightedWinner(variants.get(variant) ?? []);
    if (number && !masses.some((m) => m.number === number && m.variant === variant)) {
      masses.push({ number, variant });
    }
  }
  return masses;
}

function buildKeyMap(
  byKey: Map<string, KeyObservation[]>,
  report: BuildReport,
): Record<string, KeyMapEntry[]> {
  const map: Record<string, KeyMapEntry[]> = {};
  for (const [key, observations] of byKey) {
    const shared = summariseMasses(observations);
    const perCycle = new Map<SundayCycle, KeyMapMass[]>();
    let consistent = true;
    for (const cycle of ["A", "B", "C"] as const) {
      const forCycle = observations.filter((o) => o.day.sundayCycle === cycle);
      if (forCycle.length === 0) continue;
      const masses = summariseMasses(forCycle);
      perCycle.set(cycle, masses);
      if (!massesEqual(masses, shared)) consistent = false;
    }
    if (consistent) {
      map[key] = [{ cycle: null, masses: shared, source: "dates" }];
    } else {
      map[key] = [...perCycle.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([cycle, masses]) => ({ cycle, masses, source: "dates" as const }));
    }

    // Cross-year consistency: identical (key, cycle) must map to identical
    // numbers. A date whose Masses disagree with the entry chosen for its cycle
    // is either a source slip or a calendar-engine placement bug — report it,
    // never silently prefer one year.
    for (const observation of observations) {
      const entry =
        map[key].find((e) => e.cycle === observation.day.sundayCycle) ??
        map[key].find((e) => e.cycle === null);
      const actual = summariseMasses([observation]);
      if (!entry || entry.masses.length === 0 || actual.length === 0) continue;
      if (entry.masses[0].number !== actual[0].number) {
        report.disagreements.push(
          `${observation.day.date} ${key} (${observation.day.sundayCycle}): expected #${entry.masses[0].number}, source gives #${actual[0].number} — "${observation.day.celebration}"`,
        );
      }
    }
  }
  return map;
}

function fillKeyMapFromLabels(
  map: Record<string, KeyMapEntry[]>,
  crRows: Map<string, CrEntry[]>,
  report: BuildReport,
): void {
  const byKey = new Map<string, Map<SundayCycle | null, KeyMapMass[]>>();
  for (const [number, rows] of crRows) {
    for (const row of rows) {
      const key = keyFromCatholicResourcesLabel(row.label, row.kind);
      if (!key || map[key]) continue;
      const forKey = byKey.get(key) ?? new Map<SundayCycle | null, KeyMapMass[]>();
      const masses = forKey.get(row.cycle) ?? [];
      if (!masses.some((m) => m.number === number && m.variant === row.variant)) {
        masses.push({ number, variant: row.variant });
      }
      forKey.set(row.cycle, masses);
      byKey.set(key, forKey);
    }
  }
  for (const [key, byCycle] of byKey) {
    const entries: KeyMapEntry[] = [...byCycle.entries()]
      .sort((a, b) => String(a[0] ?? "").localeCompare(String(b[0] ?? "")))
      .map(([cycle, masses]) => ({
        cycle,
        // The principal Mass is the one with no formulary name.
        masses: [...masses].sort(
          (a, b) =>
            (a.variant === null ? 0 : 1) - (b.variant === null ? 0 : 1) ||
            compareLectionaryNumbers(a.number, b.number),
        ),
        source: "labels" as const,
      }));
    map[key] = entries;
    report.keysFromLabels += 1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Output
// ─────────────────────────────────────────────────────────────────────────────

function buildIndex(
  table: LectionaryByNumber,
  kind: LectionaryEntryKind,
  byMonthDay: Map<string, string>,
): LectionaryIndex {
  const index: LectionaryIndex = {};
  for (const number of Object.keys(table).sort(compareLectionaryNumbers)) {
    const entry = table[number];
    if (entry.kind !== kind) continue;
    const indexKey =
      kind === "sanctoral"
        ? (byMonthDay.get(number) ?? labelSlug(entry.label))
        : labelSlug(entry.label);
    if (indexKey.length === 0) continue;
    const list = index[indexKey] ?? [];
    list.push({ number, label: entry.label, cycle: entry.cycle, variant: entry.variant });
    index[indexKey] = list;
  }
  return index;
}

/**
 * JSON with object keys emitted in a chosen order, so a rebuild is byte-identical.
 * The text is built by hand rather than with JSON.stringify because a JS object
 * (and JSON.stringify with it) always lists integer-like keys first, which would
 * scatter "510/1" and "510A" away from "510" whatever order they were inserted in.
 */
function stableStringify(
  value: unknown,
  sortKeys: ((a: string, b: string) => number) | null,
): string {
  const render = (input: unknown, indent: string): string => {
    if (Array.isArray(input)) {
      if (input.length === 0) return "[]";
      const inner = indent + "  ";
      return `[\n${input.map((item) => `${inner}${render(item, inner)}`).join(",\n")}\n${indent}]`;
    }
    if (input && typeof input === "object") {
      const record = input as Record<string, unknown>;
      const keys = Object.keys(record).sort(sortKeys ?? undefined);
      if (keys.length === 0) return "{}";
      const inner = indent + "  ";
      const body = keys
        .map((key) => `${inner}${JSON.stringify(key)}: ${render(record[key], inner)}`)
        .join(",\n");
      return `{\n${body}\n${indent}}`;
    }
    return JSON.stringify(input) ?? "null";
  };
  return `${render(value, "")}\n`;
}

function writeTable(
  file: string,
  value: unknown,
  sortKeys: ((a: string, b: string) => number) | null,
  check: boolean,
): boolean {
  const target = path.join(OUTPUT_DIR, file);
  const text = stableStringify(value, sortKeys);
  if (check) {
    const current = existsSync(target) ? readFileSync(target, "utf8") : "";
    if (current !== text) {
      console.error(`✗ ${file} is out of date`);
      return false;
    }
    return true;
  }
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(target, text, "utf8");
  return true;
}

export function main(argv: string[]): number {
  const check = argv.includes("--check");
  const dirIndex = argv.indexOf("--sources");
  const sourceDir =
    dirIndex >= 0 ? argv[dirIndex + 1] : (process.env.LECTIONARY_SOURCE_DIR ?? DEFAULT_SOURCE_DIR);

  const sources = readSources(sourceDir);
  const report: BuildReport = {
    crEntries: sources.cr.length,
    crUnparsed: [...new Set(sources.crUnparsed)],
    westhongDays: sources.westhong.size,
    westhongUnparsed: [...new Set(sources.westhongUnparsed)],
    usccbWarnings: sources.usccbWarnings,
    numbers: 0,
    keys: 0,
    keysFromDates: 0,
    keysFromLabels: 0,
    engineKeys: 0,
    keysWithoutNumber: [],
    disagreements: [],
    citationDisagreements: [],
  };

  const crRows = new Map<string, CrEntry[]>();
  for (const entry of sources.cr) {
    crRows.set(entry.number, [...(crRows.get(entry.number) ?? []), entry]);
  }

  const { byNumber, byKey, identities } = collectObservations(sources);
  const keyMap = buildKeyMap(byKey, report);
  report.keysFromDates = Object.keys(keyMap).length;
  fillKeyMapFromSanctoral(keyMap, crRows, identities, report);
  fillKeyMapFromLabels(keyMap, crRows, report);
  report.keys = Object.keys(keyMap).length;

  const keyForNumber = new Map<string, string>();
  for (const key of Object.keys(keyMap).sort()) {
    for (const entry of keyMap[key]) {
      for (const mass of entry.masses)
        if (!keyForNumber.has(mass.number)) keyForNumber.set(mass.number, key);
    }
  }

  const table = buildEntries(crRows, byNumber, keyForNumber, report);
  report.numbers = Object.keys(table).length;

  const monthDayByNumber = new Map<string, string>();
  for (const [number, rows] of crRows) {
    const monthDay = rows.find((r) => r.monthDay !== null)?.monthDay;
    if (monthDay) monthDayByNumber.set(number, monthDay);
  }

  let ok = true;
  ok = writeTable("by-number.json", table, compareLectionaryNumbers, check) && ok;
  ok = writeTable("sundays.json", buildIndex(table, "sunday", monthDayByNumber), null, check) && ok;
  ok =
    writeTable("weekdays.json", buildIndex(table, "weekday", monthDayByNumber), null, check) && ok;
  ok =
    writeTable("sanctoral.json", buildIndex(table, "sanctoral", monthDayByNumber), null, check) &&
    ok;
  ok = writeTable("key-map.json", keyMap, null, check) && ok;

  console.log(
    `catholic-resources rows : ${report.crEntries} (${report.crUnparsed.length} cells unparsed)`,
  );
  console.log(
    `readings dataset days   : ${report.westhongDays} (${report.westhongUnparsed.length} citations unparsed)`,
  );
  console.log(`USCCB calendar warnings : ${report.usccbWarnings.length}`);
  console.log(`lectionary numbers      : ${report.numbers}`);
  console.log(
    `engine keys mapped      : ${report.keys} (${report.keysFromDates} by date, ${report.keysFromLabels} by label)`,
  );
  if (report.citationDisagreements.length > 0) {
    console.log(
      `\ncitation disagreements (USCCB wins, listed for review): ${report.citationDisagreements.length}`,
    );
    for (const line of report.citationDisagreements.slice(0, 40)) console.log(`  ${line}`);
  }
  if (report.disagreements.length > 0) {
    console.log(`\ncross-year disagreements: ${report.disagreements.length}`);
    for (const line of report.disagreements) console.log(`  ${line}`);
  }
  for (const line of report.crUnparsed) console.log(`  unparsed (catholic-resources): ${line}`);
  for (const line of report.westhongUnparsed) console.log(`  unparsed (readings dataset): ${line}`);
  return ok ? 0 : 1;
}

if (process.argv[1] && process.argv[1].endsWith("build-tables.ts")) {
  process.exit(main(process.argv.slice(2)));
}
