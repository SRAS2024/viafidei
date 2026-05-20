/**
 * Sacrament acceptance test (spec §10).
 *
 * "Confession never appears as a standalone admin category." The
 * Sacrament map is a fixed seven-item set; every Confession /
 * Penance alias normalises to Reconciliation. This test pins:
 *
 *   - SACRAMENT_KEYS has exactly seven entries
 *   - "Confession" / "Penance" both resolve to "reconciliation"
 *   - The canonical label is "Reconciliation"
 *   - No standalone "Confession" key exists in the registry
 */

import { describe, expect, it } from "vitest";
import {
  SACRAMENT_KEYS,
  SACRAMENT_LABELS,
  normalizeSacrament,
} from "@/lib/content-qa/sacrament-normalize";

describe("Sacraments — seven-item system only (spec §10)", () => {
  it("SACRAMENT_KEYS has exactly seven entries", () => {
    expect(SACRAMENT_KEYS).toHaveLength(7);
  });

  it("includes the canonical seven and nothing else", () => {
    expect(SACRAMENT_KEYS).toEqual([
      "baptism",
      "eucharist",
      "confirmation",
      "reconciliation",
      "anointing_of_the_sick",
      "holy_orders",
      "matrimony",
    ]);
  });

  it('does NOT include "confession" as a standalone key', () => {
    expect((SACRAMENT_KEYS as readonly string[]).includes("confession")).toBe(false);
  });

  it("normalises Confession aliases to reconciliation", () => {
    const result = normalizeSacrament({ title: "Sacrament of Confession", body: "" });
    expect(result?.key).toBe("reconciliation");
    const result2 = normalizeSacrament({ title: "Confession", body: "" });
    expect(result2?.key).toBe("reconciliation");
    const result3 = normalizeSacrament({ title: "Penance", body: "" });
    expect(result3?.key).toBe("reconciliation");
  });

  it("labels reconciliation as Reconciliation (not Confession)", () => {
    expect(SACRAMENT_LABELS.reconciliation).toBe("Reconciliation");
  });
});
