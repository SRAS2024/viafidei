/**
 * scripts/validate-db.js must stay in lockstep with prisma/schema.prisma.
 *
 * validate-db.js runs at container boot (after `prisma migrate deploy`) and
 * fail-fasts the deploy if a "required" table/column is missing. If its pinned
 * lists drift from the schema it becomes a deploy-blocking bug: it either
 * demands a table the schema no longer has (every deploy aborts even though
 * the DB is healthy) or probes a Prisma model that no longer exists
 * (`prisma.prayer` is undefined → throws).
 *
 * This actually happened: 0025_drop_legacy_system dropped the legacy per-type
 * content tables (Prayer, Saint, …) but validate-db.js kept requiring them,
 * so the first deploy that applied 0025 would have failed validation. These
 * tests assert the validator only ever references models that exist in the
 * schema, and never the dropped legacy tables.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const VALIDATOR = readFileSync(join(ROOT, "scripts", "validate-db.js"), "utf8");
const SCHEMA = readFileSync(join(ROOT, "prisma", "schema.prisma"), "utf8");

/** Every `model X { … }` declared in the Prisma schema. */
const SCHEMA_MODELS = new Set(Array.from(SCHEMA.matchAll(/^model\s+(\w+)\s*\{/gm), (m) => m[1]!));

/** Pull the quoted entries out of a `const NAME = [ … ];` array literal. */
function arrayLiteral(name: string): string[] {
  const re = new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`);
  const block = re.exec(VALIDATOR);
  if (!block) throw new Error(`${name} not found in validate-db.js`);
  return Array.from(block[1]!.matchAll(/"([^"]+)"/g), (m) => m[1]!);
}

/** Keys of a `const NAME = { Key: [...], … };` object literal. */
function objectKeys(name: string): string[] {
  const re = new RegExp(`const ${name} = \\{([\\s\\S]*?)\\n\\};`);
  const block = re.exec(VALIDATOR);
  if (!block) throw new Error(`${name} not found in validate-db.js`);
  return Array.from(block[1]!.matchAll(/^\s{2}(\w+):/gm), (m) => m[1]!);
}

// REQUIRED_TABLES is a flat string[]; PUBLIC_CONTENT_PROBES is [table, accessor]
// pairs so its flat-extracted tokens are [table0, accessor0, table1, …].
const requiredTables = arrayLiteral("REQUIRED_TABLES");
const probeTokens = arrayLiteral("PUBLIC_CONTENT_PROBES");
const probeTables = probeTokens.filter((_, i) => i % 2 === 0);
const probeAccessors = probeTokens.filter((_, i) => i % 2 === 1);
const requiredColumnTables = objectKeys("REQUIRED_COLUMNS");

// Tables 0025_drop_legacy_system removed — the validator must never demand
// these again, or it will block every deploy once 0025 applies.
const DROPPED_LEGACY_TABLES = [
  "Prayer",
  "PrayerTranslation",
  "Saint",
  "SaintTranslation",
  "MarianApparition",
  "MarianApparitionTranslation",
  "Parish",
  "Devotion",
  "DevotionTranslation",
  "LiturgyEntry",
  "LiturgyEntryTranslation",
  "SpiritualLifeGuide",
  "SpiritualLifeGuideTranslation",
  "DailyLiturgy",
  "ContentReview",
  "IngestionSource",
  "IngestionJob",
  "IngestionJobRun",
  "UserSavedPrayer",
  "UserSavedSaint",
  "UserSavedApparition",
  "UserSavedParish",
  "UserSavedDevotion",
];

describe("validate-db.js stays in lockstep with the Prisma schema", () => {
  it("extracts a non-empty set of pinned tables (parser sanity)", () => {
    expect(requiredTables.length).toBeGreaterThan(5);
    expect(probeTables.length).toBeGreaterThan(0);
    expect(SCHEMA_MODELS.size).toBeGreaterThan(20);
  });

  it("only requires tables that exist as models in the schema", () => {
    const unknown = requiredTables.filter((t) => !SCHEMA_MODELS.has(t));
    expect(unknown).toEqual([]);
  });

  it("only pins columns on tables that exist as models in the schema", () => {
    const unknown = requiredColumnTables.filter((t) => !SCHEMA_MODELS.has(t));
    expect(unknown).toEqual([]);
  });

  it("only probes content tables that exist, via the correct camelCase accessor", () => {
    for (const table of probeTables) expect(SCHEMA_MODELS.has(table)).toBe(true);
    // Prisma's delegate accessor is the model name with a lowercased first char.
    probeTables.forEach((table, i) => {
      const expected = table.charAt(0).toLowerCase() + table.slice(1);
      expect(probeAccessors[i]).toBe(expected);
    });
  });

  it("never references a table dropped by 0025_drop_legacy_system", () => {
    const referenced = new Set([...requiredTables, ...probeTables, ...requiredColumnTables]);
    const reintroduced = DROPPED_LEGACY_TABLES.filter((t) => referenced.has(t));
    expect(reintroduced).toEqual([]);
    // And the schema really did drop them (guards the denylist itself).
    const stillInSchema = DROPPED_LEGACY_TABLES.filter((t) => SCHEMA_MODELS.has(t));
    expect(stillInSchema).toEqual([]);
  });

  it("requires the checklist-first content store that replaced them", () => {
    expect(requiredTables).toContain("PublishedContent");
    expect(requiredTables).toContain("UserSavedContent");
    expect(probeTables).toContain("PublishedContent");
  });
});
