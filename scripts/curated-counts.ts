#!/usr/bin/env tsx
/**
 * Per-type curated counts against the catalogue goals.
 *
 *   npx tsx scripts/curated-counts.ts
 *
 * Prints one row per content type: how many entries the curated registry
 * carries, the goal for that type, and whether curated content ALONE already
 * meets the goal (everything short of it still needs the worker's build lane).
 */
import type { ChecklistContentType } from "@prisma/client";

import { curatedKnowledgeByType, curatedKnowledgeSize } from "../src/lib/checklist/knowledge";

const GOALS: Partial<Record<ChecklistContentType, number>> = {
  SAINT: 10000,
  PRAYER: 1000,
  CHURCH_DOCUMENT: 200,
  GUIDE: 100,
  NOVENA: 100,
  LITURGICAL: 100,
  DEVOTION: 100,
  APPARITION: 50,
  SPIRITUAL_PRACTICE: 50,
  MARIAN_TITLE: 50,
  RITE: 24,
  POPE: 267,
  DOCTOR: 37,
  SACRAMENT: 7,
};

const counts = curatedKnowledgeByType();
const rows = Object.entries(GOALS)
  .map(([type, goal]) => {
    const have = counts[type as ChecklistContentType] ?? 0;
    return { type, have, goal: goal!, met: have >= goal! };
  })
  .sort((a, b) => b.goal - a.goal);

const w = Math.max(...rows.map((r) => r.type.length));
console.log(`${"TYPE".padEnd(w)}  CURATED     GOAL  %GOAL  MET`);
for (const r of rows) {
  const pct = Math.round((r.have / r.goal) * 100);
  console.log(
    `${r.type.padEnd(w)}  ${String(r.have).padStart(7)}  ${String(r.goal).padStart(7)}  ${String(pct).padStart(4)}%  ${r.met ? "yes" : "no"}`,
  );
}
const met = rows.filter((r) => r.met).map((r) => r.type);
console.log(`\ntotal curated entries: ${curatedKnowledgeSize()}`);
console.log(`goals met by curated content alone (${met.length}/${rows.length}): ${met.join(", ")}`);
const other = Object.keys(counts).filter((t) => !(t in GOALS));
if (other.length)
  console.log(
    `types with no goal: ${other.map((t) => `${t}=${counts[t as ChecklistContentType]}`).join(", ")}`,
  );
