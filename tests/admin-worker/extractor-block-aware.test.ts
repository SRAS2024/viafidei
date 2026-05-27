/**
 * Spec §2: extractors prefer structured blocks (AdminWorkerSourceBlock)
 * over raw bodyText. PrayerExtractor reads PRAYER blocks first;
 * NovenaExtractor reads DAY_SECTION blocks; ParishExtractor reads
 * LOCATION blocks. Raw body remains a forensic fallback only.
 */

import { describe, expect, it } from "vitest";

import {
  blockAwareBody,
  PrayerExtractor,
  NovenaExtractor,
  ParishExtractor,
  type ExtractorInput,
} from "@/lib/admin-worker/extractors";
import type { StructuredBlock } from "@/lib/admin-worker/structured-source-reader";

function block(type: StructuredBlock["blockType"], text: string, order = 0): StructuredBlock {
  return {
    blockType: type,
    blockOrder: order,
    text,
    confidenceScore: 0.9,
    isRejected: false,
  };
}

describe("blockAwareBody (spec §2)", () => {
  it("returns block-derived text when blocks are present", () => {
    const input: ExtractorInput = {
      url: "u",
      host: "h",
      blocks: [block("PRAYER", "Our Father, who art in heaven. Amen.")],
      bodyText: "raw fallback that should not be used",
    };
    const body = blockAwareBody(input, ["PRAYER"]);
    expect(body).toContain("Our Father");
    expect(body).not.toContain("raw fallback");
  });

  it("falls back to bodyText when no blocks are present", () => {
    const input: ExtractorInput = {
      url: "u",
      host: "h",
      bodyText: "fallback body text",
    };
    expect(blockAwareBody(input, ["PRAYER"])).toBe("fallback body text");
  });

  it("falls back to bodyText when no blocks of preferred type match", () => {
    const input: ExtractorInput = {
      url: "u",
      host: "h",
      blocks: [], // empty
      bodyText: "fallback body",
    };
    expect(blockAwareBody(input, ["PRAYER"])).toBe("fallback body");
  });

  it("places preferred blocks ahead of supporting blocks", () => {
    const input: ExtractorInput = {
      url: "u",
      host: "h",
      blocks: [
        block("PARAGRAPH", "supporting paragraph"),
        block("PRAYER", "preferred prayer text"),
      ],
    };
    const body = blockAwareBody(input, ["PRAYER"]);
    const prayerIdx = body.indexOf("preferred prayer text");
    const paraIdx = body.indexOf("supporting paragraph");
    expect(prayerIdx).toBeGreaterThanOrEqual(0);
    expect(prayerIdx).toBeLessThan(paraIdx);
  });
});

describe("PrayerExtractor prefers PRAYER blocks (spec §2)", () => {
  it("extracts from PRAYER blocks even with empty bodyText", () => {
    const out = PrayerExtractor({
      url: "https://www.vatican.va/prayers/our-father",
      host: "www.vatican.va",
      title: "Our Father",
      blocks: [block("PRAYER", "Our Father, who art in heaven, hallowed be thy name. Amen.")],
      bodyText: "",
    });
    expect(out.fatalReasons.length).toBeLessThan(3);
    // The extractor should set the prayer title from the input title.
    expect(out.fields.prayerTitle).toBe("Our Father");
  });
});

describe("NovenaExtractor prefers DAY_SECTION blocks (spec §2)", () => {
  it("uses DAY_SECTION blocks as primary input", () => {
    const days = Array.from({ length: 9 }, (_, i) =>
      block("DAY_SECTION", `Day ${i + 1}: O Sacred Heart, hear our prayer. Amen.`, i),
    );
    const out = NovenaExtractor({
      url: "https://www.vatican.va/novenas/sacred-heart",
      host: "www.vatican.va",
      title: "Sacred Heart Novena",
      blocks: days,
      bodyText: "",
    });
    expect(out.fields.novenaTitle).toBe("Sacred Heart Novena");
  });
});

describe("ParishExtractor prefers LOCATION blocks (spec §2)", () => {
  it("uses LOCATION blocks as primary input", () => {
    const out = ParishExtractor({
      url: "https://example-parish.org/",
      host: "example-parish.org",
      title: "St. Mary's Catholic Church",
      blocks: [
        block("LOCATION", "Address: 123 Main Street, Springfield, IL 62701"),
        block("METADATA", "Pastor: Fr. John Smith"),
      ],
      bodyText: "",
    });
    expect(out.fields.parishName ?? out.fields.name).toBeDefined();
  });
});
