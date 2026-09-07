#!/usr/bin/env tsx
/**
 * Validate one curated-knowledge module before it joins the registry.
 *
 *   npx tsx scripts/validate-curated-file.ts src/lib/checklist/knowledge/guides/rosary.ts
 *
 * Loads the module, takes every exported array of CuratedEntry, and checks:
 *   - each payload validates against its content type's strict schema,
 *   - slugs are unique inside the file and match payload.slug,
 *   - citations are real page URLs (not bare origins),
 *   - referenced prayer / saint / devotion slugs exist in the registry (or in
 *     the other files passed on the command line, so a batch can be checked
 *     together before it is aggregated),
 *   - no novena day text is template-generated.
 * Exit code 1 on any problem, with every problem listed — never the first only.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";

import { ALL_CURATED_ENTRIES, validatePayload } from "../src/lib/checklist";
import type { CuratedEntry } from "../src/lib/checklist/knowledge";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: tsx scripts/validate-curated-file.ts <file.ts> [more files]");
  process.exit(2);
}

function isEntry(v: unknown): v is CuratedEntry {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as CuratedEntry).contentType === "string" &&
    typeof (v as CuratedEntry).slug === "string" &&
    typeof (v as CuratedEntry).payload === "object"
  );
}

async function loadEntries(file: string): Promise<CuratedEntry[]> {
  const mod = (await import(pathToFileURL(path.resolve(file)).href)) as Record<string, unknown>;
  const out: CuratedEntry[] = [];
  for (const value of Object.values(mod)) {
    if (Array.isArray(value) && value.every(isEntry)) out.push(...value);
  }
  return out;
}

async function main(): Promise<void> {
  const problems: string[] = [];
  const batch: CuratedEntry[] = [];
  for (const f of files) {
    try {
      const entries = await loadEntries(f);
      if (entries.length === 0) problems.push(`${f}: exports no CuratedEntry[]`);
      batch.push(...entries);
      console.log(`${f}: ${entries.length} entries`);
    } catch (err) {
      problems.push(`${f}: failed to load — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const known = new Map<string, Set<string>>();
  for (const e of [...ALL_CURATED_ENTRIES, ...batch]) {
    known.set(e.contentType, (known.get(e.contentType) ?? new Set()).add(e.slug));
  }
  const has = (type: string, slug: string) => known.get(type)?.has(slug) ?? false;

  const seen = new Set<string>();
  for (const e of batch) {
    const id = `${e.contentType}/${e.slug}`;
    if (seen.has(id)) problems.push(`${id}: duplicate slug in this batch`);
    seen.add(id);
    if (e.payload.slug !== e.slug)
      problems.push(`${id}: payload.slug (${String(e.payload.slug)}) differs from entry slug`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(e.slug))
      problems.push(`${id}: slug is not lowercase-hyphenated`);

    const v = validatePayload(e.contentType, e.payload);
    if (!v.ok) problems.push(`${id}: schema — ${JSON.stringify(v).slice(0, 400)}`);

    for (const c of e.citations) {
      try {
        const u = new URL(c);
        if (u.pathname.length <= 1 && !u.search)
          problems.push(`${id}: citation is a bare origin: ${c}`);
      } catch {
        problems.push(`${id}: citation is not a URL: ${c}`);
      }
    }
    const p = e.payload as Record<string, unknown>;
    const refs: Array<[string, string]> = [];
    for (const s of (p.relatedPrayers as unknown[]) ?? []) refs.push(["PRAYER", String(s)]);
    for (const s of (p.associatedPrayers as unknown[]) ?? []) refs.push(["PRAYER", String(s)]);
    for (const s of (p.relatedSaints as unknown[]) ?? []) refs.push(["SAINT", String(s)]);
    for (const s of (p.relatedDevotions as unknown[]) ?? []) refs.push(["DEVOTION", String(s)]);
    for (const s of (p.relatedPractices as unknown[]) ?? [])
      refs.push(["SPIRITUAL_PRACTICE", String(s)]);
    if (typeof p.associatedSaintSlug === "string") refs.push(["SAINT", p.associatedSaintSlug]);
    if (typeof p.associatedDevotionSlug === "string")
      refs.push(["DEVOTION", p.associatedDevotionSlug]);
    if (typeof p.associatedMarianTitleSlug === "string")
      refs.push(["MARIAN_TITLE", p.associatedMarianTitleSlug]);
    if (typeof p.associatedApparitionSlug === "string")
      refs.push(["APPARITION", p.associatedApparitionSlug]);
    for (const [type, slug] of refs) {
      if (!has(type, slug)) problems.push(`${id}: references unknown ${type} slug "${slug}"`);
    }
    if (e.contentType === "NOVENA" && Array.isArray(p.days)) {
      for (const d of p.days as Array<Record<string, unknown>>) {
        const t = String(d.title ?? "");
        const txt = `${d.meditation ?? ""} ${d.prayerText ?? d.prayer ?? ""}`;
        if (/^Day \d+$/.test(t) && /on this .{0,20}day of prayer/i.test(txt)) {
          problems.push(`${id}: day "${t}" looks template-generated`);
        }
      }
    }
  }

  if (problems.length) {
    console.error(`\n${problems.length} problem(s):`);
    for (const p of problems) console.error(" - " + p);
    process.exit(1);
  }
  console.log(`OK — ${batch.length} entries valid`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
