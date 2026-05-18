/**
 * Public-gate flag spec pin.
 *
 * The spec invariant: "Do not allow any feature to create public
 * content outside the content factory." The mechanism is three
 * gate flags on every catalog model:
 *
 *   * `publicRenderReady` — set true only by `persistBuiltPackage()`
 *     after strict QA accepts a built package.
 *   * `isThresholdEligible` — set true only by the same path.
 *   * `packageValidationStatus` — string-valued; "valid" only after
 *     the contract validator accepts.
 *
 * Catalog models in the schema (7 spec-content models in production):
 *   Prayer, Saint, MarianApparition, Parish, Devotion, LiturgyEntry,
 *   SpiritualLifeGuide.
 *
 * This test parses the Prisma schema and asserts each of those
 * models declares ALL THREE flags. A future migration that drops one
 * fails this test before it ships.
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

const CATALOG_MODELS = [
  "Prayer",
  "Saint",
  "MarianApparition",
  "Parish",
  "Devotion",
  "LiturgyEntry",
  "SpiritualLifeGuide",
] as const;

const GATE_FLAGS = ["publicRenderReady", "isThresholdEligible", "packageValidationStatus"] as const;

describe("Every catalog model declares the public-gate flags", () => {
  for (const model of CATALOG_MODELS) {
    const body = modelBlock(model);
    for (const flag of GATE_FLAGS) {
      it(`${model} declares ${flag}`, () => {
        const re = new RegExp(`^\\s+${flag}\\b`, "m");
        expect(re.test(body)).toBe(true);
      });
    }
  }
});

describe("publicRenderReady + isThresholdEligible default to false", () => {
  // Catching a future migration that silently flips the default to
  // `true` — that would publish every new row before strict QA runs.
  for (const model of CATALOG_MODELS) {
    const body = modelBlock(model);
    it(`${model}.publicRenderReady defaults to false`, () => {
      expect(body).toMatch(/publicRenderReady\s+Boolean\s+@default\(false\)/);
    });
    it(`${model}.isThresholdEligible defaults to false`, () => {
      expect(body).toMatch(/isThresholdEligible\s+Boolean\s+@default\(false\)/);
    });
  }
});

describe("Both gate flags are indexed (query-on-render path)", () => {
  for (const model of CATALOG_MODELS) {
    const body = modelBlock(model);
    it(`${model} indexes publicRenderReady`, () => {
      expect(body).toMatch(/@@index\(\[publicRenderReady\]\)/);
    });
    it(`${model} indexes isThresholdEligible`, () => {
      expect(body).toMatch(/@@index\(\[isThresholdEligible\]\)/);
    });
  }
});
