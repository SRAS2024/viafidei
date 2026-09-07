/**
 * Coverage report for the committed lectionary tables.
 *
 *   npx tsx scripts/lectionary/check-coverage.ts [--from 2020] [--to 2100] [--strict]
 *
 * Enumerates every (lectionaryKey, cycle) the calendar engine can emit over the
 * window and asserts that each resolves to a Lectionary formulary with
 * citations. With --strict the script exits non-zero when anything is missing,
 * so it can guard a release; without it, it only prints the residue.
 *
 * It reads the committed tables — it never touches the network or the database.
 */

import {
  resolveLiturgicalDay,
  type LiturgicalDayDetail,
} from "../../src/lib/content-shared/liturgical-calendar";
// NOTE: the explicit "/index" is required — src/lib/content-shared/lectionary.ts
// (the text layer) sits beside the package directory of the same name.
import {
  lectionaryKeys,
  lectionaryTableStats,
  lookupLectionary,
  type LectionaryLookup,
  type SundayCycle,
  type WeekdayCycle,
} from "../../src/lib/content-shared/lectionary/index";
import { READING_ORDER } from "../../src/lib/content-shared/lectionary/keys";

interface Combination {
  key: string;
  sundayCycle: SundayCycle;
  weekdayCycle: WeekdayCycle;
  sample: LiturgicalDayDetail;
}

/** Every (key, Sunday cycle, weekday cycle) the engine actually produces. */
export function enumerateCombinations(from: number, to: number): Combination[] {
  const seen = new Map<string, Combination>();
  const cursor = new Date(Date.UTC(from, 0, 1));
  const end = Date.UTC(to, 11, 31);
  while (cursor.getTime() <= end) {
    const day = resolveLiturgicalDay(cursor, { calendar: "roman-us" });
    const id = `${day.lectionaryKey}|${day.sundayCycle}|${day.weekdayCycle}`;
    if (!seen.has(id)) {
      seen.set(id, {
        key: day.lectionaryKey,
        sundayCycle: day.sundayCycle,
        weekdayCycle: day.weekdayCycle,
        sample: day,
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return [...seen.values()];
}

export interface CoverageResult {
  combinations: number;
  resolved: number;
  missingKeys: string[];
  missingCombinations: string[];
  /** Sections the Lectionary prints for the resolved days, by kind. */
  sectionCounts: Record<string, number>;
  /** Days whose formulary has no Gospel — always a table defect. */
  withoutGospel: string[];
  /** Days with no first reading and no Gospel at all. */
  withoutAnyReading: string[];
  unusedKeys: string[];
}

export function checkCoverage(from: number, to: number): CoverageResult {
  const combinations = enumerateCombinations(from, to);
  const missingKeys = new Set<string>();
  const missingCombinations: string[] = [];
  const withoutGospel: string[] = [];
  const withoutAnyReading: string[] = [];
  const sectionCounts: Record<string, number> = {};
  for (const kind of READING_ORDER) sectionCounts[kind] = 0;
  const usedKeys = new Set<string>();
  let resolved = 0;

  for (const combination of combinations) {
    const lookup: LectionaryLookup | null = lookupLectionary(combination.key, {
      sundayCycle: combination.sundayCycle,
      weekdayCycle: combination.weekdayCycle,
    });
    if (!lookup) {
      missingKeys.add(combination.key);
      missingCombinations.push(
        `${combination.key} (${combination.sundayCycle}/${combination.weekdayCycle}) — e.g. ${combination.sample.date} ${combination.sample.celebration}`,
      );
      continue;
    }
    resolved += 1;
    usedKeys.add(combination.key);
    for (const section of lookup.sections) sectionCounts[section.kind] += 1;
    const kinds = new Set(lookup.sections.map((s) => s.kind));
    if (!kinds.has("GOSPEL")) withoutGospel.push(`${combination.key} → #${lookup.number}`);
    if (!kinds.has("GOSPEL") && !kinds.has("FIRST_READING")) {
      withoutAnyReading.push(`${combination.key} → #${lookup.number}`);
    }
  }

  return {
    combinations: combinations.length,
    resolved,
    missingKeys: [...missingKeys].sort(),
    missingCombinations,
    sectionCounts,
    withoutGospel: [...new Set(withoutGospel)].sort(),
    withoutAnyReading: [...new Set(withoutAnyReading)].sort(),
    unusedKeys: lectionaryKeys().filter((key) => !usedKeys.has(key)),
  };
}

function numberArg(argv: string[], flag: string, fallback: number): number {
  const index = argv.indexOf(flag);
  if (index < 0) return fallback;
  const value = Number(argv[index + 1]);
  return Number.isFinite(value) ? value : fallback;
}

export function main(argv: string[]): number {
  const from = numberArg(argv, "--from", 2020);
  const to = numberArg(argv, "--to", 2100);
  const strict = argv.includes("--strict");
  const stats = lectionaryTableStats();
  const result = checkCoverage(from, to);
  const percent = (result.resolved / Math.max(result.combinations, 1)) * 100;

  console.log(
    `tables: ${stats.numbers} lectionary numbers, ${stats.sections} sections, ${stats.keys} keys`,
  );
  console.log(
    `        sunday ${stats.byKind.sunday}, weekday ${stats.byKind.weekday}, sanctoral ${stats.byKind.sanctoral}, common ${stats.byKind.common}`,
  );
  console.log(`engine ${from}-${to}: ${result.combinations} (key, cycle) combinations`);
  console.log(`resolved: ${result.resolved} (${percent.toFixed(2)}%)`);
  for (const kind of READING_ORDER) {
    const count = result.sectionCounts[kind];
    console.log(
      `  ${kind.padEnd(15)} ${String(count).padStart(5)}  ${((count / Math.max(result.resolved, 1)) * 100).toFixed(1)}% of days`,
    );
  }
  if (result.missingCombinations.length > 0) {
    console.log(`\nunresolved (${result.missingCombinations.length}):`);
    for (const line of result.missingCombinations) console.log(`  ${line}`);
  }
  if (result.withoutGospel.length > 0) {
    console.log(`\nformularies with no Gospel (${result.withoutGospel.length}):`);
    for (const line of result.withoutGospel) console.log(`  ${line}`);
  }
  if (result.unusedKeys.length > 0) {
    console.log(
      `\nkeys in the table the ${from}-${to} calendar never emits: ${result.unusedKeys.join(", ")}`,
    );
  }
  return strict && (result.missingCombinations.length > 0 || result.withoutGospel.length > 0)
    ? 1
    : 0;
}

if (process.argv[1] && process.argv[1].endsWith("check-coverage.ts")) {
  process.exit(main(process.argv.slice(2)));
}
