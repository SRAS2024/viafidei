#!/usr/bin/env tsx
/**
 * Export the liturgical-calendar engine's answer for every day of 2000–2100
 * (US calendar) to intelligence/data/liturgical-days.json — the single source
 * of truth the Python brain reads instead of re-implementing the calendar.
 *
 * Format (compact, one row per day, dictionary-encoded strings):
 *   {
 *     "calendar": "roman-us", "start": "2000-01-01", "end": "2100-12-31",
 *     "fields": ["key","temporalKey","celebration","rank","color","season",
 *                "weekOfSeason","sundayCycle","weekdayCycle"],
 *     "keys": [...], "celebrations": [...], "ranks": [...], "colors": [...],
 *     "seasons": [...], "sundayCycles": ["A","B","C"], "weekdayCycles": ["I","II"],
 *     "rows": [[keyIdx, temporalKeyIdx, celebrationIdx, rankIdx, colorIdx,
 *               seasonIdx, weekOfSeason, sundayCycleIdx, weekdayCycleIdx], ...]
 *   }
 * Row i is the day `start + i days`.
 *
 * Usage: tsx scripts/lectionary/export-golden.ts [--from 2000] [--to 2100] [--out path]
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  resolveLiturgicalDay,
  type LiturgicalCalendarId,
} from "../../src/lib/content-shared/liturgical-calendar";

const CALENDAR: LiturgicalCalendarId = "roman-us";
const SUNDAY_CYCLES = ["A", "B", "C"] as const;
const WEEKDAY_CYCLES = ["I", "II"] as const;

class Dictionary {
  readonly values: string[] = [];
  private readonly index = new Map<string, number>();
  id(value: string): number {
    let i = this.index.get(value);
    if (i === undefined) {
      i = this.values.length;
      this.values.push(value);
      this.index.set(value, i);
    }
    return i;
  }
}

export function buildGolden(fromYear: number, toYear: number) {
  const keys = new Dictionary();
  const celebrations = new Dictionary();
  const ranks = new Dictionary();
  const colors = new Dictionary();
  const seasons = new Dictionary();
  const rows: number[][] = [];

  const start = new Date(Date.UTC(fromYear, 0, 1));
  const end = new Date(Date.UTC(toYear, 11, 31));
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
    const day = resolveLiturgicalDay(new Date(t), { calendar: CALENDAR });
    rows.push([
      keys.id(day.lectionaryKey),
      keys.id(day.temporalKey),
      celebrations.id(day.celebration),
      ranks.id(day.rank),
      colors.id(day.color),
      seasons.id(day.season),
      day.weekOfSeason,
      SUNDAY_CYCLES.indexOf(day.sundayCycle),
      WEEKDAY_CYCLES.indexOf(day.weekdayCycle),
    ]);
  }

  return {
    generatedBy: "scripts/lectionary/export-golden.ts",
    calendar: CALENDAR,
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    fields: [
      "key",
      "temporalKey",
      "celebration",
      "rank",
      "color",
      "season",
      "weekOfSeason",
      "sundayCycle",
      "weekdayCycle",
    ],
    keys: keys.values,
    celebrations: celebrations.values,
    ranks: ranks.values,
    colors: colors.values,
    seasons: seasons.values,
    sundayCycles: [...SUNDAY_CYCLES],
    weekdayCycles: [...WEEKDAY_CYCLES],
    rows,
  };
}

/** Serialise with one row per line so diffs stay readable. */
export function serialiseGolden(golden: ReturnType<typeof buildGolden>): string {
  const { rows, ...head } = golden;
  const headJson = JSON.stringify(head, null, 2);
  const body = rows.map((r) => `    ${JSON.stringify(r)}`).join(",\n");
  return `${headJson.slice(0, -2)},\n  "rows": [\n${body}\n  ]\n}\n`;
}

function main() {
  const argv = process.argv.slice(2);
  const arg = (name: string, fallback: string) => {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  const fromYear = Number(arg("--from", "2000"));
  const toYear = Number(arg("--to", "2100"));
  const out = resolve(arg("--out", "intelligence/data/liturgical-days.json"));

  const golden = buildGolden(fromYear, toYear);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, serialiseGolden(golden));
  console.log(
    `wrote ${golden.rows.length} days (${golden.start} → ${golden.end}, ${golden.calendar}) ` +
      `with ${golden.keys.length} keys / ${golden.celebrations.length} celebrations to ${out}`,
  );
}

main();
