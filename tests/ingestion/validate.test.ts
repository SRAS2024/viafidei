import { describe, expect, it } from "vitest";
import { sanitize, validateItem } from "@/lib/ingestion/validate";
import type { IngestedItem } from "@/lib/ingestion/types";

const validPrayer: IngestedItem = {
  kind: "prayer",
  slug: "our-father",
  defaultTitle: "Our Father",
  category: "ordinary",
  body: "Our Father, who art in heaven, hallowed be thy name.",
};

const validSaint: IngestedItem = {
  kind: "saint",
  slug: "francis-of-assisi",
  canonicalName: "Francis of Assisi",
  patronages: ["animals", "ecology"],
  biography: "Francis was born in Assisi in 1181 and founded the Franciscan order.",
};

describe("validateItem", () => {
  it("accepts a well-formed prayer", () => {
    expect(validateItem(validPrayer)).toBeNull();
  });

  it("rejects a prayer without a body", () => {
    expect(validateItem({ ...validPrayer, body: "" })).toMatch(/body/);
  });

  it("rejects a prayer body that's too short", () => {
    expect(validateItem({ ...validPrayer, body: "short" })).toMatch(/too short/);
  });

  it("rejects a saint biography that's too short", () => {
    expect(validateItem({ ...validSaint, biography: "short" })).toMatch(/too short/);
  });

  it("rejects an apparition missing approvedStatus", () => {
    expect(
      validateItem({
        kind: "apparition",
        slug: "lourdes",
        title: "Our Lady of Lourdes",
        summary: "Apparitions to Bernadette in Lourdes, 1858.",
        approvedStatus: "",
      }),
    ).toMatch(/approvedStatus/);
  });

  it("rejects a parish website that isn't a real URL", () => {
    expect(
      validateItem({
        kind: "parish",
        slug: "st-mary",
        name: "St. Mary",
        websiteUrl: "javascript:alert(1)",
      }),
    ).toMatch(/websiteUrl/);
  });

  it("rejects a devotion with non-positive duration", () => {
    expect(
      validateItem({
        kind: "devotion",
        slug: "rosary",
        title: "Rosary",
        summary: "The recitation of the Holy Rosary.",
        durationMinutes: -1,
      }),
    ).toMatch(/durationMinutes/);
  });

  it("rejects an externalSourceKey from a non-approved host", () => {
    expect(
      validateItem({
        ...validPrayer,
        externalSourceKey: "https://random-blog.example.com/page",
      }),
    ).toMatch(/not from a Vatican-approved host/);
  });

  it("refuses to ingest user-generated kinds (defense in depth)", () => {
    // Cast through unknown — the union type forbids this at compile time,
    // but the runtime guard exists exactly for the case where a future
    // adapter widens the union without updating persistence.
    const sneaky = { kind: "journal" } as unknown as IngestedItem;
    expect(validateItem(sneaky)).toMatch(/protected user-generated content/);
  });
});

describe("sanitize", () => {
  it("normalizes slugs and partitions into valid + rejected", () => {
    const result = sanitize([
      { ...validPrayer, slug: "Our_Father!!" },
      { ...validPrayer, slug: "second-prayer", body: "" },
      validSaint,
    ]);
    expect(result.valid).toHaveLength(2);
    expect(result.rejected).toHaveLength(1);
    expect(result.valid[0].slug).toBe("our-father");
    expect(result.rejected[0].reason).toMatch(/body/);
  });

  it("never throws on an empty input", () => {
    expect(sanitize([])).toEqual({ valid: [], rejected: [] });
  });
});
