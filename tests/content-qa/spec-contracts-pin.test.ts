/**
 * Spec pins for content-package contract constants.
 *
 * The spec lists exact enums for:
 *   * Sacrament keys (the seven canonical sacraments).
 *   * History categories (the twelve approved Church-history kinds).
 *   * Confession normalizes to Reconciliation.
 *
 * This test pins those enums so a future schema edit cannot silently
 * add or drop a value without a spec update.
 */

import { describe, expect, it } from "vitest";
import { SACRAMENT_KEYS, SACRAMENT_LABELS, SACRAMENT_GROUP_BY_KEY } from "@/lib/content-qa/sacrament-normalize";
import { VALID_HISTORY_TYPES } from "@/lib/content-qa/contracts/history";

const SPEC_SACRAMENT_KEYS = [
  "baptism",
  "eucharist",
  "confirmation",
  "reconciliation",
  "anointing_of_the_sick",
  "holy_orders",
  "matrimony",
] as const;

const SPEC_HISTORY_TYPES = [
  "Council",
  "Major Church event",
  "Encyclical",
  "Papal consecration",
  "Schism",
  "Religious order founding",
  "Catechism",
  "Code of Canon Law",
  "Major papal act",
  "Major doctrinal definition",
  "Major ecumenical event",
  "Major liturgical reform",
] as const;

describe("Sacrament keys match the spec — exactly seven canonical sacraments", () => {
  it("SACRAMENT_KEYS contains the seven spec keys", () => {
    for (const k of SPEC_SACRAMENT_KEYS) {
      expect(SACRAMENT_KEYS as readonly string[]).toContain(k);
    }
  });

  it("SACRAMENT_KEYS contains NO extras beyond the seven", () => {
    for (const k of SACRAMENT_KEYS as readonly string[]) {
      expect(SPEC_SACRAMENT_KEYS as readonly string[]).toContain(k);
    }
  });

  it("there are exactly seven sacraments", () => {
    expect(SACRAMENT_KEYS).toHaveLength(7);
  });

  it("every sacrament key has a human label", () => {
    for (const k of SACRAMENT_KEYS) {
      expect(typeof SACRAMENT_LABELS[k]).toBe("string");
      expect(SACRAMENT_LABELS[k].length).toBeGreaterThan(0);
    }
  });

  it("every sacrament belongs to one of Initiation / Healing / Service", () => {
    for (const k of SACRAMENT_KEYS) {
      expect(["Initiation", "Healing", "Service"]).toContain(SACRAMENT_GROUP_BY_KEY[k]);
    }
  });
});

describe("Confession normalizes to Reconciliation (deterministic internal rule)", () => {
  it("'Sacrament of Confession' title maps to canonical 'reconciliation'", async () => {
    const { normalizeSacrament } = await import("@/lib/content-qa/sacrament-normalize");
    const result = normalizeSacrament({
      title: "The Sacrament of Confession",
      body: "Confession is the sacrament of reconciliation.",
    });
    expect(result.key).toBe("reconciliation");
    expect(result.label).toBe("Reconciliation");
  });

  it("'Penance' title maps to canonical 'reconciliation'", async () => {
    const { normalizeSacrament } = await import("@/lib/content-qa/sacrament-normalize");
    const result = normalizeSacrament({
      title: "The Sacrament of Penance",
      body: "Penance is a sacrament instituted by Christ.",
    });
    expect(result.key).toBe("reconciliation");
  });

  it("'confession' is NOT a sacrament key — the canonical key is 'reconciliation'", () => {
    expect(SACRAMENT_KEYS as readonly string[]).not.toContain("confession");
    expect(SACRAMENT_KEYS as readonly string[]).toContain("reconciliation");
  });
});

describe("History categories match the spec — exactly twelve approved kinds", () => {
  it("VALID_HISTORY_TYPES contains every spec category", () => {
    for (const t of SPEC_HISTORY_TYPES) {
      expect(VALID_HISTORY_TYPES as readonly string[]).toContain(t);
    }
  });

  it("VALID_HISTORY_TYPES contains NO extras beyond the spec set", () => {
    for (const t of VALID_HISTORY_TYPES as readonly string[]) {
      expect(SPEC_HISTORY_TYPES as readonly string[]).toContain(t);
    }
  });

  it("there are exactly twelve approved history categories", () => {
    expect(VALID_HISTORY_TYPES).toHaveLength(12);
  });
});
