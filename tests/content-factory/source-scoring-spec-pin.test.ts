/**
 * Spec-pin test for SourceQualityScore.
 *
 * The spec says every source should track:
 *
 *   Discovered count.
 *   Fetched count.
 *   Build success count.
 *   Build failure count.
 *   QA pass count.
 *   QA fail count.
 *   Deleted count.
 *   Duplicate count.
 *   Valid package rate.
 *   Wrong content rate.
 *   Average completeness score.
 *
 * Plus the spec calls out:
 *   * Last successful valid package time.
 *   * Last failure reason.
 *   * Auto-pause status.
 *
 * This test parses the Prisma schema and asserts SourceQualityScore
 * declares every spec field. A future migration that drops a column
 * fails the build before it ships.
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

const SOURCE_QUALITY_SCORE_REQUIRED = [
  "discoveredCount",
  "fetchedCount",
  "buildSuccessCount",
  "buildFailureCount",
  "qaPassCount",
  "qaFailCount",
  "deletedCount",
  "duplicateCount",
  "wrongContentCount",
  "validPackageRate",
  "wrongContentRate",
  "averageCompleteness",
  "lastSuccessAt",
  "lastFailureAt",
  "lastFailureReason",
  "autoPaused",
  "autoPausedAt",
] as const;

describe("SourceQualityScore — every spec field is declared", () => {
  const body = modelBlock("SourceQualityScore");

  for (const field of SOURCE_QUALITY_SCORE_REQUIRED) {
    it(`declares ${field}`, () => {
      const re = new RegExp(`^\\s+${field}\\b`, "m");
      expect(re.test(body)).toBe(true);
    });
  }

  it("uses a composite (sourceId, contentType) unique key so each source-type pair is one row", () => {
    expect(body).toMatch(/@@unique\(\[sourceId,\s*contentType\]\)/);
  });
});

describe("counter columns default to 0 (a fresh source has zero of everything)", () => {
  const body = modelBlock("SourceQualityScore");
  const counters = [
    "discoveredCount",
    "fetchedCount",
    "buildSuccessCount",
    "buildFailureCount",
    "qaPassCount",
    "qaFailCount",
    "deletedCount",
    "duplicateCount",
    "wrongContentCount",
  ];
  for (const c of counters) {
    it(`${c} defaults to 0`, () => {
      expect(body).toMatch(new RegExp(`${c}\\s+Int\\s+@default\\(0\\)`));
    });
  }

  it("autoPaused defaults to false (a fresh source is never paused at creation)", () => {
    expect(body).toMatch(/autoPaused\s+Boolean\s+@default\(false\)/);
  });
});
