/**
 * Migration 0068 corrects the stored subtitle of liturgical entries that were called
 * "Order of Mass". It must say what the generator says, or the worker's hygiene sweep
 * would change the words back, and it must leave nothing of that kind behind.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ALL_CURATED_ENTRIES } from "@/lib/checklist";
import { generateContentSubtitle } from "@/lib/content-shared/content-subtitle";

const SQL = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "0068_liturgical_entries_called_what_they_are",
    "migration.sql",
  ),
  "utf8",
);

const corrected = new Map(
  [...SQL.matchAll(/\('([a-z0-9-]+)', '([^']+)'\)/g)].map((m) => [m[1]!, m[2]!]),
);

const filedUnderTheMass = ALL_CURATED_ENTRIES.filter(
  (entry) => entry.contentType === "LITURGICAL" && entry.payload.kind === "mass_structure",
);

const subtitleOf = (entry: (typeof filedUnderTheMass)[number]) =>
  generateContentSubtitle({
    contentType: "LITURGICAL",
    title: entry.payload.title as string,
    fields: entry.payload,
  });

describe("migration 0068", () => {
  it("is safe to run again", () => {
    expect(SQL).toContain("@idempotent-recoverable");
    expect(SQL).toContain(`entry."subtitle" = 'Order of Mass'`);
  });

  it("gives each entry the words the generator gives it", () => {
    expect(corrected.size).toBe(8);
    for (const [slug, subtitle] of corrected) {
      const entry = filedUnderTheMass.find((candidate) => candidate.slug === slug);
      expect(entry, slug).toBeDefined();
      expect(subtitleOf(entry!), slug).toBe(subtitle);
    }
  });

  it("leaves only the Mass itself called the Order of Mass", () => {
    const stillCalled = filedUnderTheMass.filter((entry) => subtitleOf(entry) === "Order of Mass");
    expect(stillCalled.map((entry) => entry.slug)).toEqual(["structure-roman-rite-mass"]);
    for (const entry of filedUnderTheMass) {
      if (entry.slug !== "structure-roman-rite-mass") expect(corrected.has(entry.slug)).toBe(true);
    }
  });
});
