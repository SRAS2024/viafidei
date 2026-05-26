/**
 * Content builder (spec §9) — extractor output becomes a structured
 * content package with normalized slug, display fields, body
 * sections, required/optional/missing fields, validation needs,
 * duplicate keys, rejection reasons, repair suggestions, and
 * per-field + per-package confidence.
 */

import { describe, expect, it } from "vitest";

import { buildContentPackage, REQUIRED_FIELDS } from "@/lib/admin-worker/content-builder";
import type { ExtractorOutput } from "@/lib/admin-worker/extractors";

function fakeExtractor<T extends Record<string, unknown>>(opts: {
  fields: T;
  missingFields?: string[];
  fatalReasons?: string[];
  sourceUrl?: string;
  fieldConfidences?: Record<string, number>;
}): ExtractorOutput<T> {
  const sourceEvidence = Object.entries(opts.fieldConfidences ?? {}).map(
    ([fieldName, confidence]) => ({
      fieldName,
      sourceUrl: opts.sourceUrl ?? "https://vatican.va/test",
      sourceHost: "vatican.va",
      snippet: "snippet",
      method: "BODY_REGEX" as const,
      confidence,
      checksum: "abc",
    }),
  );
  return {
    fields: opts.fields,
    missingFields: opts.missingFields ?? [],
    confidenceScore: 0.85,
    sourceEvidence,
    rejectedSections: [],
    formatting: { lineBreaks: "after each phrase" },
    warnings: [],
    fatalReasons: opts.fatalReasons ?? [],
  };
}

describe("buildContentPackage — spec §9 structured packages", () => {
  it("produces package type, normalized title and slug for a prayer", () => {
    const pkg = buildContentPackage({
      contentType: "PRAYER",
      extractor: fakeExtractor({
        fields: {
          prayerTitle: "  Our  Father ",
          prayerType: "Lord's Prayer",
          prayerText: "Our Father, who art in heaven. Amen.",
          category: "essential",
        },
      }),
    });
    expect(pkg.packageType).toBe("PRAYER");
    expect(pkg.normalizedTitle).toBe("Our Father");
    expect(pkg.normalizedSlug).toBe("our-father");
  });

  it("captures duplicate keys (slug + title hash) for the publish gate", () => {
    const pkg = buildContentPackage({
      contentType: "PRAYER",
      extractor: fakeExtractor({
        fields: { prayerTitle: "Hail Mary", prayerText: "Hail Mary. Amen." },
      }),
    });
    expect(pkg.duplicateKeys.slug).toBe("hail-mary");
    expect(pkg.duplicateKeys.titleHash).toHaveLength(40);
  });

  it("reports the spec §10 required fields per content type", () => {
    const pkg = buildContentPackage({
      contentType: "SAINT",
      extractor: fakeExtractor({ fields: { saintName: "Saint Pio" } }),
    });
    for (const f of REQUIRED_FIELDS.SAINT) {
      expect(pkg.requiredFields).toContain(f);
    }
  });

  it("lists missing required fields from the extractor", () => {
    const pkg = buildContentPackage({
      contentType: "SAINT",
      extractor: fakeExtractor({
        fields: { saintName: "Saint Pio" },
        missingFields: ["feastDay", "saintType", "background"],
      }),
    });
    expect(pkg.missingFields).toContain("feastDay");
    expect(pkg.missingFields).toContain("background");
  });

  it("produces a repair suggestion per missing required field", () => {
    const pkg = buildContentPackage({
      contentType: "SAINT",
      extractor: fakeExtractor({
        fields: { saintName: "Saint Pio" },
        missingFields: ["feastDay"],
      }),
    });
    expect(pkg.repairSuggestions).toHaveLength(1);
    expect(pkg.repairSuggestions[0]).toMatch(/feast/i);
  });

  it("populates displayFields with only the populated required + optional fields", () => {
    const pkg = buildContentPackage({
      contentType: "PRAYER",
      extractor: fakeExtractor({
        fields: {
          prayerTitle: "Our Father",
          prayerType: "Lord's Prayer",
          prayerText: "Our Father. Amen.",
          category: "essential",
          patron: "All souls",
        },
      }),
    });
    expect(pkg.displayFields.prayerTitle).toBe("Our Father");
    expect(pkg.displayFields.patron).toBe("All souls");
  });

  it("extracts body sections including PRAYER and DAY_SECTION blocks", () => {
    const days: Record<string, { title: string; prayer: string }> = {};
    for (let i = 1; i <= 9; i++) {
      days[`day${i}`] = { title: `Day ${i}`, prayer: `Day ${i} prayer text` };
    }
    const pkg = buildContentPackage({
      contentType: "NOVENA",
      extractor: fakeExtractor({
        fields: {
          novenaTitle: "Novena to St. Jude",
          background: "Background prose.",
          purpose: "For desperate cases.",
          duration: "9 days",
          dropdownMetadata: { categories: ["intercession"] },
          days,
        },
      }),
    });
    const daySections = pkg.bodySections.filter((b) => b.type === "DAY_SECTION");
    expect(daySections.length).toBe(9);
  });

  it("derives validation needs from the per-content-type sensitive-field list", () => {
    const saintPkg = buildContentPackage({
      contentType: "SAINT",
      extractor: fakeExtractor({ fields: { saintName: "Saint Pio" } }),
    });
    expect(saintPkg.validationNeeds).toContain("feastDay");
    const apparitionPkg = buildContentPackage({
      contentType: "APPARITION",
      extractor: fakeExtractor({ fields: { apparitionTitle: "Lourdes" } }),
    });
    expect(apparitionPkg.validationNeeds).toContain("approvalStatus");
  });

  it("computes confidence by field from extractor provenance", () => {
    const pkg = buildContentPackage({
      contentType: "PRAYER",
      extractor: fakeExtractor({
        fields: { prayerTitle: "Our Father" },
        fieldConfidences: { prayerTitle: 0.95, prayerText: 0.8 },
      }),
    });
    expect(pkg.confidenceByField.prayerTitle).toBe(0.95);
    expect(pkg.confidenceByField.prayerText).toBe(0.8);
  });

  it("computes a package-level confidence with a penalty for missing fields", () => {
    const complete = buildContentPackage({
      contentType: "PRAYER",
      extractor: fakeExtractor({
        fields: { prayerTitle: "Our Father" },
        fieldConfidences: { prayerTitle: 0.9, prayerText: 0.9, category: 0.9 },
      }),
    });
    const partial = buildContentPackage({
      contentType: "PRAYER",
      extractor: fakeExtractor({
        fields: { prayerTitle: "Our Father" },
        fieldConfidences: { prayerTitle: 0.9, prayerText: 0.9, category: 0.9 },
        missingFields: ["category", "prayerText"],
      }),
    });
    expect(partial.confidenceByPackage).toBeLessThan(complete.confidenceByPackage);
  });

  it("surfaces fatal reasons as rejectionReasons", () => {
    const pkg = buildContentPackage({
      contentType: "PRAYER",
      extractor: fakeExtractor({
        fields: { prayerTitle: "Our Father" },
        fatalReasons: ["prayerText missing", "no source"],
      }),
    });
    expect(pkg.rejectionReasons).toContain("prayerText missing");
  });

  it("preserves formatting metadata from the extractor", () => {
    const pkg = buildContentPackage({
      contentType: "PRAYER",
      extractor: fakeExtractor({
        fields: { prayerTitle: "Our Father" },
      }),
    });
    expect(pkg.formattingMetadata).toMatchObject({ lineBreaks: "after each phrase" });
  });
});
