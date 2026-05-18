/**
 * Field provenance spec pin.
 *
 * The spec lists every required provenance field:
 *   Source URL, Source host, Source document ID, Source heading,
 *   Source section, Text snippet hash, Extraction method,
 *   Extractor version, Confidence score, Timestamp.
 *
 * These tests pin both:
 *   * The FieldProvenance TypeScript type (parses the .d.ts).
 *   * The runtime helper `provenance(...)` that writes a row.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  provenance,
  deterministicProvenance,
  ensureProvenance,
  syntheticSourceDocument,
} from "@/lib/content-factory";
import { hashSnippet } from "@/lib/content-factory/provenance";

const TYPES_SRC = readFileSync(
  join(process.cwd(), "src", "lib", "content-factory", "types.ts"),
  "utf8",
);

describe("FieldProvenance type — every spec-required field is declared", () => {
  const SPEC_FIELDS = [
    "sourceUrl",
    "sourceHost",
    "sourceDocumentId",
    "sourceHeading",
    "sourceSection",
    "snippetHash",
    "extractionMethod",
    "extractorVersion",
    "confidence",
    "timestamp",
  ];

  for (const field of SPEC_FIELDS) {
    it(`declares ${field}`, () => {
      const re = new RegExp(`\\b${field}\\??:\\s*\\w`, "m");
      expect(re.test(TYPES_SRC)).toBe(true);
    });
  }
});

describe("provenance() helper — runtime shape matches the spec", () => {
  const doc = syntheticSourceDocument({
    sourceUrl: "https://vatican.va/prayers/anima-christi",
    sourceHost: "vatican.va",
    sourceTitle: "Anima Christi",
    rawBody: "Soul of Christ...",
    sourcePurposes: {},
  });

  it("returns every spec field when all inputs are supplied", () => {
    const rec = provenance({
      document: doc,
      method: "regex",
      builderVersion: "1.0.0",
      snippet: "Hail Mary...",
      heading: "The Prayer",
      section: "Section 1",
      confidence: 0.95,
    });
    expect(rec.sourceUrl).toBe("https://vatican.va/prayers/anima-christi");
    expect(rec.sourceHost).toBe("vatican.va");
    expect("sourceDocumentId" in rec).toBe(true);
    expect(rec.sourceHeading).toBe("The Prayer");
    expect(rec.sourceSection).toBe("Section 1");
    expect(rec.snippetHash).toBeTruthy();
    expect(rec.extractionMethod).toBe("regex");
    expect(rec.extractorVersion).toBe("1.0.0");
    expect(rec.confidence).toBe(0.95);
    // Timestamp is always populated by the helper.
    expect(rec.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("confidence is clamped to [0, 1] (never above 1.0)", () => {
    const rec = provenance({
      document: doc,
      method: "regex",
      builderVersion: "1.0.0",
      confidence: 2.0, // Out-of-range input is clamped.
    });
    expect(rec.confidence).toBe(1);
  });

  it("default confidence is supplied when omitted", () => {
    const rec = provenance({
      document: doc,
      method: "regex",
      builderVersion: "1.0.0",
    });
    expect(rec.confidence).toBeGreaterThan(0);
    expect(rec.confidence).toBeLessThanOrEqual(1);
  });

  it("hashSnippet returns a stable sha256 hex digest", () => {
    expect(hashSnippet("Hail Mary, full of grace.")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSnippet("")).toBeNull();
    expect(hashSnippet(null)).toBeNull();
  });
});

describe("deterministicProvenance() — internal-rule fields use 1.0 confidence", () => {
  it("returns confidence 1.0 (deterministic rules are not heuristic)", () => {
    const doc = syntheticSourceDocument({
      sourceUrl: "https://example.org",
      sourceHost: "example.org",
      sourceTitle: "X",
      rawBody: "Y",
      sourcePurposes: {},
    });
    const rec = deterministicProvenance({
      document: doc,
      method: "sacrament-normalize",
      builderVersion: "1.0.0",
      rule: "Confession -> Reconciliation",
    });
    expect(rec.confidence).toBe(1.0);
    expect(rec.snippetHash).toBeNull();
    expect(rec.extractionMethod).toMatch(/deterministic/);
  });
});

describe("ensureProvenance() — required fields without provenance fail unless deterministic", () => {
  it("returns ok=true when every required field has a provenance entry", () => {
    const result = ensureProvenance({
      payload: { name: "Test", body: "Lorem ipsum" },
      provenance: {
        name: {
          sourceUrl: "https://x",
          sourceHost: "x",
          extractionMethod: "regex",
          extractorVersion: "1.0.0",
          confidence: 1,
          timestamp: new Date().toISOString(),
        },
        body: {
          sourceUrl: "https://x",
          sourceHost: "x",
          extractionMethod: "regex",
          extractorVersion: "1.0.0",
          confidence: 1,
          timestamp: new Date().toISOString(),
        },
      },
      requiredFields: ["name", "body"],
      deterministicFields: [],
    });
    expect(result.ok).toBe(true);
  });

  it("returns ok=false when a required field is missing provenance and is not deterministic", () => {
    const result = ensureProvenance({
      payload: { name: "Test", body: "Lorem ipsum" },
      provenance: {
        name: {
          sourceUrl: "https://x",
          sourceHost: "x",
          extractionMethod: "regex",
          extractorVersion: "1.0.0",
          confidence: 1,
          timestamp: new Date().toISOString(),
        },
      },
      requiredFields: ["name", "body"],
      deterministicFields: [],
    });
    expect(result.ok).toBe(false);
  });

  it("returns ok=true when a missing provenance is allowed because the field is deterministic", () => {
    const result = ensureProvenance({
      payload: { sacramentKey: "reconciliation" },
      provenance: {},
      requiredFields: ["sacramentKey"],
      deterministicFields: ["sacramentKey"],
    });
    expect(result.ok).toBe(true);
  });
});
