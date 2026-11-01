#!/usr/bin/env tsx
/**
 * Build the committed day index of The Roman Martyrology (1916 English
 * edition) — src/lib/admin-worker/structured/data/roman-martyrology-1916.json —
 * from the Internet Archive's OCR of the book.
 *
 *   npx tsx scripts/booster/build-roman-martyrology.ts --source <ocr.txt> [--check]
 *
 * The source is ONE public-domain file, downloaded once by hand (it is not
 * committed): https://archive.org/download/romanmartyrology00cathuoft/romanmartyrology00cathuoft_djvu.txt
 * (782,713 bytes). The script is offline and idempotent: the same OCR always
 * writes byte-identical JSON, so `--check` can assert that the committed index
 * still matches the parser.
 *
 * Before writing, it cross-checks the day segmentation against the book's own
 * INDEX ("Eugendus, St., A … Jan. 1"): for every index line whose name is
 * distinctive, the name must appear in that day's announcements. A month whose
 * agreement falls below the floor is refused — a heading the OCR lost would
 * show up here as a run of index names one day off.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  MARTYROLOGY_MONTH_DAYS,
  parseMartyrologyOcr,
} from "../../src/lib/admin-worker/structured/roman-martyrology-parse";

const OUTPUT = path.join(
  process.cwd(),
  "src/lib/admin-worker/structured/data/roman-martyrology-1916.json",
);
const USAGE = "usage: tsx scripts/booster/build-roman-martyrology.ts --source <ocr.txt> [--check]";
/** Lowest share of distinctive index names found on their own day, per month. */
const INDEX_AGREEMENT_FLOOR = 0.9;

const INDEX_MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mch: 3,
  mar: 3,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  aug: 8,
  sept: 9,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function args(): { source: string; check: boolean } {
  const argv = process.argv.slice(2);
  let source = "";
  let check = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--check") check = true;
    else if (a === "--source") source = argv[++i] ?? "";
    else if (a.startsWith("--source=")) source = a.slice("--source=".length);
    else fail(`unknown argument ${a}\n${USAGE}`);
  }
  if (!source) fail(USAGE);
  return { source, check };
}

/** "Name, St., M … Mon. D" lines of the book's index → name and day. */
function indexEntries(ocr: string): Array<{ name: string; day: string }> {
  const lines = ocr.split(/\r?\n/);
  const at = lines.findIndex((l) => l.trim() === "INDEX.");
  if (at < 0) return [];
  const re =
    /^\s*([A-Z][a-z'-]{3,})[ ,.].*?\b(Jan|Feb|Mch|Mar|Apr|May|June|Jun|July|Jul|Aug|Sept|Sep|Oct|Nov|Dec)\b\.?\s*(\d{1,2})\s*$/;
  const out: Array<{ name: string; day: string }> = [];
  for (const line of lines.slice(at)) {
    const m = re.exec(line);
    if (!m) continue;
    const month = INDEX_MONTHS[m[2].toLowerCase()];
    const d = Number(m[3]);
    if (!month || d < 1 || d > MARTYROLOGY_MONTH_DAYS[month - 1]) continue;
    out.push({
      name: m[1],
      day: `${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    });
  }
  return out;
}

function serialize(days: Record<string, string[]>): string {
  const keys = Object.keys(days).sort();
  const body = keys.map((k) => `    ${JSON.stringify(k)}: ${JSON.stringify(days[k])}`).join(",\n");
  const source = {
    title: "The Roman Martyrology (English edition, Baltimore: John Murphy Company, 1916)",
    url: "https://archive.org/details/romanmartyrology00cathuoft",
    ocr: "https://archive.org/download/romanmartyrology00cathuoft/romanmartyrology00cathuoft_djvu.txt",
    rights: "Public domain (published in the United States in 1916).",
    generatedBy: "scripts/booster/build-roman-martyrology.ts — edit the parser, never this file",
  };
  return `{\n  "source": ${JSON.stringify(source)},\n  "days": {\n${body}\n  }\n}\n`;
}

function main(): void {
  const { source, check } = args();
  const ocr = readFileSync(source, "utf8");
  const parsed = parseMartyrologyOcr(ocr);
  const dayCount = Object.keys(parsed.days).length;
  const entryCount = Object.values(parsed.days).reduce((n, e) => n + e.length, 0);
  console.log(`days ${dayCount}, announcements ${entryCount}`);
  for (const p of parsed.problems) console.log(`problem: ${p}`);

  // Cross-check against the book's own index, month by month. Only names the
  // index lists ONCE count (a common name proves nothing about a day), and
  // only names the body spells the same way somewhere: the OCR mangles the
  // index's names too ("Bugendus" for Eugendus), and a name found nowhere says
  // nothing about the segmentation.
  const index = indexEntries(ocr);
  const seen = new Map<string, number>();
  for (const e of index) seen.set(e.name, (seen.get(e.name) ?? 0) + 1);
  const dayTexts = Object.entries(parsed.days).map(
    ([day, entries]) => [day, entries.join(" ").toLowerCase()] as const,
  );
  const perMonth = new Map<string, { hit: number; all: number }>();
  for (const e of index) {
    if (seen.get(e.name) !== 1 || !parsed.days[e.day]) continue;
    const name = e.name.toLowerCase();
    const named = (text: string) => new RegExp(`\\b${name}\\b`).test(text);
    if (!dayTexts.some(([, text]) => named(text))) continue;
    const month = e.day.slice(0, 2);
    const s = perMonth.get(month) ?? { hit: 0, all: 0 };
    s.all += 1;
    if (named(parsed.days[e.day].join(" ").toLowerCase())) s.hit += 1;
    perMonth.set(month, s);
  }
  let refused = false;
  for (const [month, s] of [...perMonth.entries()].sort()) {
    const share = s.all ? s.hit / s.all : 0;
    console.log(`month ${month}: index agreement ${s.hit}/${s.all} (${(share * 100).toFixed(1)}%)`);
    if (share < INDEX_AGREEMENT_FLOOR) refused = true;
  }
  if (refused) fail("index agreement below the floor — not writing the day index");
  if (dayCount !== 365 || parsed.problems.length > 0) {
    console.log("warning: the index is incomplete; the missing months are simply silent");
  }

  const json = serialize(parsed.days);
  if (check) {
    const committed = readFileSync(OUTPUT, "utf8");
    if (committed !== json) fail(`${OUTPUT} does not match the parser output`);
    console.log("committed day index matches");
    return;
  }
  writeFileSync(OUTPUT, json);
  console.log(`wrote ${OUTPUT} (${json.length} bytes)`);
}

main();
