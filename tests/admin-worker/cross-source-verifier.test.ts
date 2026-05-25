/**
 * Cross-source verifier (spec §11). Proves match / mismatch / missing
 * / conflict logic and that publish is only allowed when every
 * required fact matches.
 */

import { describe, expect, it } from "vitest";

import { verifyCrossSource } from "@/lib/admin-worker/cross-source-verifier";

describe("verifyCrossSource", () => {
  it("allows publish when every required fact matches a validation source", () => {
    const out = verifyCrossSource({
      contentType: "SAINT",
      fields: { saintName: "Saint Anne", feastDay: "July 26" },
      validationSources: [
        { host: "vatican.example", fields: { saintName: "Saint Anne", feastDay: "July 26" } },
      ],
    });
    expect(out.publishAllowed).toBe(true);
    expect(out.hasConflict).toBe(false);
    expect(out.missingRequired).toEqual([]);
    expect(out.evidence.every((row) => row.matchStatus === "MATCH")).toBe(true);
  });

  it("rejects publish when a required field is missing", () => {
    const out = verifyCrossSource({
      contentType: "APPARITION",
      fields: { apparitionTitle: "Our Lady of X" },
      validationSources: [],
    });
    expect(out.publishAllowed).toBe(false);
    expect(out.missingRequired).toContain("approvalStatus");
  });

  it("marks conflict when one source matches and another mismatches", () => {
    const out = verifyCrossSource({
      contentType: "SAINT",
      fields: { saintName: "Saint Anne", feastDay: "July 26" },
      validationSources: [
        { host: "a.example", fields: { saintName: "Saint Anne", feastDay: "July 26" } },
        { host: "b.example", fields: { saintName: "Saint Anne", feastDay: "April 1" } },
      ],
    });
    expect(out.hasConflict).toBe(true);
    expect(out.publishAllowed).toBe(false);
  });

  it("rejects publish when no validation source is available for sensitive facts", () => {
    const out = verifyCrossSource({
      contentType: "APPARITION",
      fields: {
        apparitionTitle: "Our Lady of Fatima",
        approvalStatus: "approved by the Holy See",
      },
      validationSources: [],
    });
    expect(out.publishAllowed).toBe(false);
    expect(out.evidence.every((row) => row.matchStatus === "MISSING")).toBe(true);
  });

  it("emits per-field provenance-style ValidationEvidence rows", () => {
    const out = verifyCrossSource({
      contentType: "PRAYER",
      fields: { prayerTitle: "Memorare", prayerText: "Remember..." },
      validationSources: [
        { host: "x.example", fields: { prayerTitle: "Memorare", prayerText: "Remember..." } },
      ],
    });
    expect(out.evidence.find((r) => r.fieldVerified === "prayerTitle")?.sourceUsed).toBe(
      "x.example",
    );
    expect(out.evidence.find((r) => r.fieldVerified === "prayerText")?.matchStatus).toBe("MATCH");
  });

  it("uses fuzzy match for long strings (substring overlap)", () => {
    const out = verifyCrossSource({
      contentType: "PRAYER",
      fields: {
        prayerTitle: "The Memorare",
        prayerText:
          "Remember, O most gracious Virgin Mary, that never was it known that anyone who fled to thy protection was left unaided. Amen.",
      },
      validationSources: [
        {
          host: "x.example",
          fields: {
            prayerTitle: "The Memorare",
            prayerText:
              "Remember, O most gracious Virgin Mary, that never was it known that anyone who fled",
          },
        },
      ],
    });
    expect(out.publishAllowed).toBe(true);
  });

  it("records confidence per evidence row", () => {
    const out = verifyCrossSource({
      contentType: "SACRAMENT",
      fields: { sacramentKey: "BAPTISM" },
      validationSources: [{ host: "v.example", fields: { sacramentKey: "BAPTISM" } }],
    });
    const row = out.evidence.find((r) => r.fieldVerified === "sacramentKey");
    expect(row?.confidence).toBeGreaterThanOrEqual(0.5);
  });
});
