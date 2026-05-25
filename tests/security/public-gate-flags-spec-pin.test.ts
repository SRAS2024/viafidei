/**
 * Public-gate spec pin (new world).
 *
 * The legacy catalog models (Prayer, Saint, MarianApparition,
 * Parish, Devotion, LiturgyEntry, SpiritualLifeGuide) and their
 * three publish-gate booleans (publicRenderReady, isThresholdEligible,
 * packageValidationStatus) were removed in migration
 * 0025_drop_legacy_system. Public content now lives in a single
 * `PublishedContent` table with one `isPublished` boolean. The
 * Admin Worker engine's `publisher.ts` + `post-publish-probe.ts`
 * own the publish gate at the code level.
 *
 * This file pins the new contract so a future migration cannot
 * silently drop the gate column.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SCHEMA = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");

function modelBlock(name: string): string {
  const re = new RegExp(`model\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`);
  const match = re.exec(SCHEMA);
  if (!match) throw new Error(`model ${name} not found in schema`);
  return match[1]!;
}

describe("PublishedContent — single publish-gate column", () => {
  const body = modelBlock("PublishedContent");

  it("declares isPublished", () => {
    expect(/^\s+isPublished\b/m.test(body)).toBe(true);
  });

  it("isPublished defaults to false (publish requires explicit code path)", () => {
    expect(body).toMatch(/isPublished\s+Boolean\s+@default\(false\)/);
  });

  it("isPublished is indexed (public reads filter by it)", () => {
    expect(body).toMatch(/@@index\(\[isPublished\]\)/);
  });

  it("declares unpublishedAt for rollback bookkeeping", () => {
    expect(/^\s+unpublishedAt\b/m.test(body)).toBe(true);
  });
});

describe("Legacy catalog models are gone", () => {
  const LEGACY_MODELS = [
    "Prayer",
    "Saint",
    "MarianApparition",
    "Parish",
    "Devotion",
    "LiturgyEntry",
    "SpiritualLifeGuide",
    "DailyLiturgy",
  ];
  for (const name of LEGACY_MODELS) {
    it(`does not declare a legacy ${name} model`, () => {
      const re = new RegExp(`model\\s+${name}\\s*\\{`);
      expect(re.test(SCHEMA)).toBe(false);
    });
  }
});

describe("Legacy ingestion tables are gone", () => {
  const LEGACY_INGESTION = [
    "IngestionSource",
    "IngestionJob",
    "IngestionJobRun",
    "IngestionJobQueue",
    "IngestionCursor",
    "IngestionBatch",
    "IngestionRateBucket",
    "DailyIngestionCounter",
    "DiscoveredSourceItem",
  ];
  for (const name of LEGACY_INGESTION) {
    it(`does not declare a legacy ${name} model`, () => {
      const re = new RegExp(`model\\s+${name}\\s*\\{`);
      expect(re.test(SCHEMA)).toBe(false);
    });
  }
});
