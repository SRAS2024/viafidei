import { describe, expect, it } from "vitest";
import { dedupeBatch, normalizeExternalKey } from "@/lib/ingestion/persist";
import type { IngestedItem } from "@/lib/ingestion/types";

const make = (slug: string, externalSourceKey?: string): IngestedItem => ({
  kind: "prayer",
  slug,
  defaultTitle: "title",
  category: "ordinary",
  body: "Body that is at least ten characters long.",
  ...(externalSourceKey ? { externalSourceKey } : {}),
});

describe("normalizeExternalKey", () => {
  it("strips utm_* params, fragments, and trailing slashes", () => {
    expect(
      normalizeExternalKey(
        "https://www.vatican.va/prayers/our-father/?utm_source=newsletter#anchor",
      ),
    ).toBe("https://www.vatican.va/prayers/our-father");
  });

  it("returns undefined for missing or empty input", () => {
    expect(normalizeExternalKey(undefined)).toBeUndefined();
    expect(normalizeExternalKey(null)).toBeUndefined();
    expect(normalizeExternalKey("   ")).toBeUndefined();
  });

  it("passes through non-URL values that aren't parseable", () => {
    // A bare token isn't a URL — it's returned trimmed but otherwise as-is.
    expect(normalizeExternalKey("plain-id-1234")).toBe("plain-id-1234");
  });

  it("collapses host-only case differences", () => {
    expect(normalizeExternalKey("https://Www.Vatican.va/PATH")).toBe("https://www.vatican.va/PATH");
  });
});

describe("dedupeBatch", () => {
  it("drops duplicates that match by externalSourceKey", () => {
    const out = dedupeBatch([
      make("our-father", "https://vatican.va/our-father"),
      make("our-father-2", "https://vatican.va/our-father"),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].slug).toBe("our-father");
  });

  it("drops duplicates that match by slug across different external keys", () => {
    const out = dedupeBatch([
      make("our-father", "https://vatican.va/a"),
      make("our-father", "https://vatican.va/b"),
    ]);
    expect(out).toHaveLength(1);
  });

  it("treats different kinds with the same slug as distinct", () => {
    const out = dedupeBatch([
      make("rosary"),
      {
        kind: "devotion",
        slug: "rosary",
        title: "Rosary",
        summary: "The recitation of decades of the Rosary.",
      } as IngestedItem,
    ]);
    expect(out).toHaveLength(2);
  });

  it("never throws on an empty batch", () => {
    expect(dedupeBatch([])).toEqual([]);
  });
});
