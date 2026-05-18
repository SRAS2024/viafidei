/**
 * Seed content MUST flow through the content factory. The spec is
 * explicit: "Route seed content through the same content factory.
 * Seed content should not insert public rows directly."
 *
 * This test scans every prisma/seeds/seed*.ts module and verifies
 * it calls `routeSeedThroughFactory()`, and that none of them
 * contains a `prisma.<contentModel>.create` or `.upsert` direct
 * insert that would bypass the factory.
 *
 * The single canonical persistence path is `persistBuiltPackage()`
 * inside the factory; any other writer would skip strict QA.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SEEDS_DIR = join(process.cwd(), "prisma", "seeds");
const CONTENT_MODELS = [
  "prayer",
  "saint",
  "marianApparition",
  "parish",
  "devotion",
  "liturgyEntry",
  "spiritualLifeGuide",
];

function listSeedModules(): string[] {
  if (!statSync(SEEDS_DIR).isDirectory()) return [];
  return readdirSync(SEEDS_DIR)
    .filter((f) => f.startsWith("seed") && f.endsWith(".ts"))
    .map((f) => join(SEEDS_DIR, f));
}

const SEED_MODULES = listSeedModules();

describe("seed content flows through the content factory", () => {
  it("at least one seed module exists (sanity check)", () => {
    expect(SEED_MODULES.length).toBeGreaterThan(0);
  });

  for (const path of SEED_MODULES) {
    const name = path.split("/").pop()!;
    if (name === "seedSiteSettings.ts") {
      // SiteSettings are not content rows — they don't go through the
      // factory. Skip from the audit.
      continue;
    }
    it(`${name} routes seeds through routeSeedThroughFactory()`, () => {
      const src = readFileSync(path, "utf8");
      expect(src).toMatch(/routeSeedThroughFactory/);
    });

    it(`${name} does NOT insert content rows via prisma.<model>.create`, () => {
      const src = readFileSync(path, "utf8");
      for (const model of CONTENT_MODELS) {
        const re = new RegExp(`prisma\\.${model}\\.(?:create|upsert|createMany)\\(`);
        if (re.test(src)) {
          throw new Error(
            `${name} contains a direct prisma.${model}.create/upsert/createMany call — must route through routeSeedThroughFactory() instead`,
          );
        }
      }
    });
  }
});

describe("the seed-factory helper enforces every gate flag", () => {
  it("routeSeedThroughFactory delegates to persistBuiltPackage", () => {
    const src = readFileSync(join(SEEDS_DIR, "factorySeed.ts"), "utf8");
    expect(src).toMatch(/runContentFactory|persistBuiltPackage/);
  });
});
