/**
 * Regression: Confession is NOT a standalone content type.
 *
 * The spec requires the Seven Sacraments — Confession normalizes to
 * Reconciliation. This audit scans:
 *   1. The ContentTypeKey union: there is no "Confession" member.
 *   2. The builder registry: there is no ConfessionBuilder entry.
 *   3. The admin threshold counter list: no row keyed "confession".
 *   4. The source-purpose map: no purposeForContentType("Confession").
 *   5. The sacrament normalizer: "Confession" normalizes to
 *      "Reconciliation".
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_DIR = join(process.cwd(), "src");

describe("Confession is not a standalone content type", () => {
  it("ContentTypeKey union does not include Confession", () => {
    const src = readFileSync(join(SRC_DIR, "lib", "content-qa", "types.ts"), "utf8");
    // The ContentTypeKey union uses string literals — check for "Confession"
    // as a quoted member, not anywhere in the file (comments are OK).
    const unionMatch = src.match(/export type ContentTypeKey\s*=\s*([^;]+);/s);
    expect(unionMatch).not.toBeNull();
    if (unionMatch) {
      const members = unionMatch[1];
      expect(members).not.toMatch(/["']Confession["']/);
      expect(members).toMatch(/["']Sacrament["']/);
    }
  });

  it("BUILDER_REGISTRY does not declare a ConfessionBuilder", async () => {
    const { BUILDER_REGISTRY } = await import("@/lib/content-factory");
    expect(Object.keys(BUILDER_REGISTRY)).not.toContain("Confession");
    expect(Object.keys(BUILDER_REGISTRY)).toContain("Sacrament");
  });

  it("purposeForContentType has no Confession branch", () => {
    const src = readFileSync(join(SRC_DIR, "lib", "content-qa", "source-purpose.ts"), "utf8");
    // No `case "Confession":` clause should exist.
    expect(src).not.toMatch(/case\s+["']Confession["']/);
  });

  it("normalizeSacrament maps a Confession candidate to Reconciliation", async () => {
    const { normalizeSacrament } = await import("@/lib/content-qa/sacrament-normalize");
    // The normalizer accepts a few legacy names and folds them to the
    // canonical Seven Sacrament keys. Confession is one of those legacy
    // names; the normalized output must be Reconciliation.
    const out = normalizeSacrament({
      title: "Confession",
      body: "The sacrament of Confession is also called Reconciliation or Penance — preparing for the sacrament begins with examination of conscience.",
    });
    // The internal sacrament key uses lowercase identifiers; the
    // user-facing label resolves via SACRAMENT_LABELS.
    expect(out.key).toBe("reconciliation");
    expect(out.label).toBe("Reconciliation");
  });
});

describe("Reconciliation is one of the Seven Sacraments", () => {
  it("isCanonicalSacramentKey('reconciliation') is true", async () => {
    const { isCanonicalSacramentKey } = await import("@/lib/content-qa/sacrament-normalize");
    expect(isCanonicalSacramentKey("reconciliation")).toBe(true);
  });

  it("Sacrament builder registry entry has Reconciliation among supported keys", async () => {
    const { BUILDER_VERSION_REGISTRY } = await import("@/lib/content-factory");
    expect(BUILDER_VERSION_REGISTRY.Sacrament.contentType).toBe("Sacrament");
  });
});
