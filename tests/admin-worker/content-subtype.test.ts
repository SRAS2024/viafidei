/**
 * Deterministic content-subtype classifier. Pins that every published item can
 * be tagged with a catalog subtype (so the coverage model tracks per-subtype
 * breadth instead of reading everything as "untagged"), that single-subtype
 * types are 100% correct, no-subtype types are null, and doctrinally-sensitive
 * multi-subtype types are never guessed.
 */
import { describe, expect, it } from "vitest";

import { resolveContentSubtype } from "@/lib/admin-worker/content-subtype";

describe("resolveContentSubtype", () => {
  it("stamps the sole subtype for single-subtype types (100% correct)", () => {
    expect(resolveContentSubtype("SAINT", { title: "St. Teresa" })).toBe("saint_biography");
    expect(resolveContentSubtype("POPE", { title: "Pope Leo XIII" })).toBe("pope_biography");
    expect(resolveContentSubtype("DOCTOR", { title: "St. Augustine" })).toBe("doctor_profile");
    expect(resolveContentSubtype("PARISH", { title: "St. Mary's" })).toBe("parish_profile");
  });

  it("returns null for types with no catalog subtypes", () => {
    for (const t of [
      "DEVOTION",
      "MARIAN_TITLE",
      "SACRAMENT",
      "RITE",
      "GUIDE",
      "SPIRITUAL_PRACTICE",
    ]) {
      expect(resolveContentSubtype(t, { title: "x" })).toBeNull();
    }
  });

  it("classifies prayers by clear signals, defaulting to common_prayer", () => {
    expect(resolveContentSubtype("PRAYER", { title: "Hail Mary" })).toBe("marian_prayer");
    expect(resolveContentSubtype("PRAYER", { title: "Anima Christi" })).toBe("eucharistic_prayer");
    expect(resolveContentSubtype("PRAYER", { title: "Vespers Antiphon" })).toBe(
      "liturgical_prayer",
    );
    expect(resolveContentSubtype("PRAYER", { title: "Our Father" })).toBe("common_prayer");
  });

  it("treats a published novena as the full novena and a curated apparition as approved", () => {
    expect(resolveContentSubtype("NOVENA", { title: "Novena to St. Jude" })).toBe("full_novena");
    expect(resolveContentSubtype("APPARITION", { title: "Our Lady of Lourdes" })).toBe(
      "approved_apparition",
    );
    expect(resolveContentSubtype("APPARITION", { title: "X", approvalStatus: "condemned" })).toBe(
      "condemned_apparition",
    );
  });

  it("classifies church documents by kind, never guessing when unclear", () => {
    expect(resolveContentSubtype("CHURCH_DOCUMENT", { title: "Rerum Novarum (Encyclical)" })).toBe(
      "encyclical",
    );
    expect(
      resolveContentSubtype("CHURCH_DOCUMENT", { title: "Evangelii Gaudium Exhortation" }),
    ).toBe("apostolic_exhortation");
    // No signal → null (do not mislabel a doctrinal document).
    expect(resolveContentSubtype("CHURCH_DOCUMENT", { title: "Some Vatican Text" })).toBeNull();
  });

  it("honours an explicit subtype already on the payload", () => {
    expect(resolveContentSubtype("PRAYER", { title: "x", contentSubtype: "saint_prayer" })).toBe(
      "saint_prayer",
    );
  });
});
