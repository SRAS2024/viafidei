#!/usr/bin/env tsx
/**
 * Check the liturgical-calendar engine (US calendar) against external ground
 * truth and print every disagreement.
 *
 * Sources (any combination):
 *   --usccb <file.txt>     text extracted from a USCCB "Liturgical Calendar for
 *                          the Dioceses of the United States of America" PDF
 *                          (day lines like `6 SUN TWENTY-THIRD SUNDAY IN
 *                          ORDINARY TIME green` followed by the readings line
 *                          with the Lectionary number in parentheses)
 *   --westhong <file.json> the westhong/catholic-daily-readings dataset
 *                          (date → masses with `feast` + `lectionary_number`)
 *
 * Usage:
 *   tsx scripts/lectionary/check-calendar.ts --usccb 2026cal.txt --usccb 2027cal.txt \
 *       --westhong westhong-readings.json [--from 2023-01-01] [--to 2027-12-31] [--all]
 *
 * Exit code 1 when any HARD mismatch remains. SOFT mismatches (a memorial the
 * source shows or omits while the weekday itself agrees) are listed separately.
 */

import { readFileSync } from "node:fs";

import { resolveLiturgicalDay } from "../../src/lib/content-shared/liturgical-calendar";
import {
  judge,
  parseUsccbText,
  parseWesthong,
  type SourceDay,
  type Verdict,
} from "./calendar-check-lib";

function parseArgs(argv: string[]) {
  const usccb: string[] = [];
  let westhong: string | null = null;
  let from = "0000-00-00";
  let to = "9999-99-99";
  let all = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--usccb") usccb.push(argv[++i]);
    else if (a === "--westhong") westhong = argv[++i];
    else if (a === "--from") from = argv[++i];
    else if (a === "--to") to = argv[++i];
    else if (a === "--all") all = true;
  }
  return { usccb, westhong, from, to, all };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const sources: Array<{ name: string; days: Map<string, SourceDay> }> = [];
  for (const f of args.usccb) {
    sources.push({
      name: `usccb:${f.split("/").pop()}`,
      days: parseUsccbText(readFileSync(f, "utf8")),
    });
  }
  if (args.westhong) {
    sources.push({ name: "westhong", days: parseWesthong(readFileSync(args.westhong, "utf8")) });
  }
  if (sources.length === 0) {
    console.error("nothing to check: pass --usccb <file> and/or --westhong <file>");
    process.exitCode = 2;
    return;
  }

  const counts = { title: 0, number: 0, soft: 0, hard: 0 };
  const hard: string[] = [];
  const soft: string[] = [];
  for (const src of sources) {
    const dates = [...src.days.keys()].sort();
    for (const date of dates) {
      if (date < args.from || date > args.to) continue;
      const block = src.days.get(date)!;
      const day = resolveLiturgicalDay(new Date(`${date}T00:00:00Z`), { calendar: "roman-us" });
      const verdict: Verdict = judge(day, block);
      counts[verdict.kind]++;
      const line = `${date} ${day.dayOfWeek === 0 ? "SUN" : "   "} [${src.name}] ${verdict.kind === "title" || verdict.kind === "number" ? "ok" : verdict.reason}`;
      if (verdict.kind === "hard") hard.push(line);
      else if (verdict.kind === "soft") soft.push(line);
      else if (args.all) console.log(line);
    }
  }

  if (soft.length) {
    console.log(`\nSOFT (${soft.length}) — memorial-level differences, weekday agrees:`);
    for (const l of soft) console.log("  " + l);
  }
  if (hard.length) {
    console.log(`\nHARD (${hard.length}) — the day itself disagrees:`);
    for (const l of hard) console.log("  " + l);
  }
  console.log(
    `\nchecked ${counts.title + counts.number + counts.soft + counts.hard} dates: ` +
      `${counts.title} title matches, ${counts.number} number-only matches, ${counts.soft} soft, ${counts.hard} hard`,
  );
  if (hard.length) process.exitCode = 1;
}

main();
