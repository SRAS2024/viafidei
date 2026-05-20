/**
 * Cross-source evidence collector tests.
 *
 * The collector is the layer that converts a built package + a list
 * of validator documents into the EvidenceRecord rows the validator
 * decides on.
 *
 * These tests pin:
 *   - deterministic + enrichment rows are always emitted
 *   - required-field matching uses normalised text
 *   - feast-day matching tolerates Jan 28 vs January 28
 *   - the loader is called when validators lack inline bodies
 *   - matching rejects fields the validators do not mention
 */

import { describe, expect, it } from "vitest";
import { collectCrossSourceEvidence } from "@/lib/content-factory/cross-source-evidence-collector";
import type { ContentPackage } from "@/lib/content-factory/types";

function prayerPackage(): ContentPackage {
  return {
    contentType: "Prayer",
    slug: "our-father",
    title: "Our Father",
    language: "en",
    sourceUrl: "https://wider.example/our-father",
    sourceHost: "wider.example",
    payload: {
      prayerText: "Our Father, who art in heaven, hallowed be thy name.",
      prayerType: "intercessory",
    },
    provenance: {},
  };
}

function saintPackage(): ContentPackage {
  return {
    contentType: "Saint",
    slug: "thomas-aquinas",
    title: "St. Thomas Aquinas",
    language: "en",
    sourceUrl: "https://wider.example/thomas-aquinas",
    sourceHost: "wider.example",
    payload: {
      feastDay: "January 28",
      biographyIdentity: "Dominican friar and Doctor of the Church",
    },
    provenance: {},
  };
}

describe("collectCrossSourceEvidence()", () => {
  it("emits deterministic_rule evidence for slug + language by default", async () => {
    const result = await collectCrossSourceEvidence({
      pkg: prayerPackage(),
      validators: [],
    });
    const slugRow = result.evidence.find((e) => e.fieldName === "slug");
    expect(slugRow?.evidenceType).toBe("deterministic_rule");
    expect(slugRow?.validationDecision).toBe("pass");
    const languageRow = result.evidence.find((e) => e.fieldName === "language");
    expect(languageRow?.evidenceType).toBe("deterministic_rule");
  });

  it("emits approved_enrichment evidence for caller-listed enriched fields", async () => {
    const result = await collectCrossSourceEvidence({
      pkg: saintPackage(),
      validators: [],
      enrichedFields: ["patronage"],
    });
    // patronage value isn't on the package, so the enrichment row
    // is skipped (no value to record). Use a field that exists:
    const result2 = await collectCrossSourceEvidence({
      pkg: prayerPackage(),
      validators: [],
      enrichedFields: ["prayerType"],
    });
    const row = result2.evidence.find(
      (e) => e.fieldName === "prayerType" && e.evidenceType === "approved_enrichment",
    );
    expect(row).toBeDefined();
    expect(row?.validationDecision).toBe("pass");
    expect(row?.matchConfidence).toBe(1.0);
    expect(result.evidence.find((e) => e.fieldName === "patronage")).toBeUndefined();
  });

  it("emits exact_text_match evidence when a validator body contains the prayer text", async () => {
    const result = await collectCrossSourceEvidence({
      pkg: prayerPackage(),
      validators: [
        {
          sourceUrl: "https://vatican.va/our-father",
          sourceHost: "vatican.va",
          body: "Our Father, who art in heaven, hallowed be thy name. Thy kingdom come...",
        },
      ],
    });
    const row = result.evidence.find((e) => e.fieldName === "prayerText");
    expect(row?.validationDecision).toBe("pass");
    expect(row?.evidenceType).toBe("prayer_text_match");
    expect(row?.sourceHost).toBe("vatican.va");
    expect(row?.matchConfidence).toBeGreaterThan(0.5);
  });

  it("emits feast_day_match using normalised parsing (Jan vs January)", async () => {
    const result = await collectCrossSourceEvidence({
      pkg: saintPackage(),
      validators: [
        {
          sourceUrl: "https://catholic-saints.example/aquinas",
          sourceHost: "catholic-saints.example",
          body: "St. Thomas Aquinas is celebrated on Jan 28 each year.",
        },
      ],
    });
    const row = result.evidence.find((e) => e.fieldName === "feastDay");
    expect(row?.validationDecision).toBe("pass");
    expect(row?.evidenceType).toBe("feast_day_match");
  });

  it("emits insufficient_evidence when no validator mentions the field", async () => {
    const result = await collectCrossSourceEvidence({
      pkg: prayerPackage(),
      validators: [
        {
          sourceUrl: "https://other.example/x",
          sourceHost: "other.example",
          body: "Completely unrelated content about parishes.",
        },
      ],
    });
    const row = result.evidence.find((e) => e.fieldName === "prayerText");
    expect(row?.validationDecision).toBe("insufficient_evidence");
    expect(row?.matchConfidence).toBe(0);
  });

  it("invokes the loader for validators that arrive without bodies", async () => {
    const seen: string[] = [];
    const loader = async (url: string) => {
      seen.push(url);
      return { body: "Our Father, who art in heaven, hallowed be thy name." };
    };
    const result = await collectCrossSourceEvidence({
      pkg: prayerPackage(),
      validators: [{ sourceUrl: "https://lazy.example/of", sourceHost: "lazy.example" }],
      loader,
    });
    expect(seen).toEqual(["https://lazy.example/of"]);
    const row = result.evidence.find((e) => e.fieldName === "prayerText");
    expect(row?.validationDecision).toBe("pass");
  });
});
