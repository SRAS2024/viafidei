import { describe, expect, it } from "vitest";
import {
  dedupeBatch,
  normalizeExternalKey,
  normalizeWebsiteIdentity,
  normalizeParishIdentity,
} from "@/lib/ingestion/persist";
import type { IngestedItem, IngestedParish, IngestedSaint } from "@/lib/ingestion/types";

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

  it("drops two prayers that have the same default title even when slugs differ", () => {
    const out = dedupeBatch([
      {
        ...make("our-father-a", "https://vatican.va/our-father-en"),
        defaultTitle: "Our Father",
      } as IngestedItem,
      {
        ...make("our-father-b", "https://usccb.org/our-father"),
        // Different slug + different external key, identical user-facing title.
        defaultTitle: "Our Father",
      } as IngestedItem,
    ]);
    // Both share the same title — collapse onto the first.
    expect(out).toHaveLength(1);
  });

  it("drops two saints that share a canonical name across different sources", () => {
    const a: IngestedSaint = {
      kind: "saint",
      slug: "anthony-of-padua-a",
      canonicalName: "Saint Anthony of Padua",
      patronages: [],
      biography: "Born in Lisbon in 1195, joined the Franciscans.",
      externalSourceKey: "https://vatican.va/saints/anthony",
    };
    const b: IngestedSaint = {
      ...a,
      slug: "anthony-of-padua-b",
      externalSourceKey: "https://usccb.org/saints/anthony",
    };
    const out = dedupeBatch([a, b]);
    expect(out).toHaveLength(1);
    expect((out[0] as IngestedSaint).slug).toBe("anthony-of-padua-a");
  });

  it("drops two parishes with the same name/city/region/country tuple", () => {
    const a: IngestedParish = {
      kind: "parish",
      slug: "st-marys-a",
      name: "St. Mary's Catholic Church",
      city: "Boston",
      region: "MA",
      country: "USA",
      websiteUrl: "https://stmarysboston.org/",
      externalSourceKey: "https://archbalt.org/parishes/st-marys",
    };
    const b: IngestedParish = {
      kind: "parish",
      slug: "st-marys-b",
      name: "St Mary's Catholic Church", // missing the period — normalizes the same
      city: "Boston",
      region: "MA",
      country: "USA",
      websiteUrl: "http://www.stmarysboston.org",
      externalSourceKey: "https://archbalt.org/find/st-marys",
    };
    const out = dedupeBatch([a, b]);
    expect(out).toHaveLength(1);
  });

  it("drops two parishes with the same normalized website URL", () => {
    const a: IngestedParish = {
      kind: "parish",
      slug: "st-josephs-a",
      name: "St. Joseph's Parish",
      websiteUrl: "https://stjosephs.example.com/",
    };
    const b: IngestedParish = {
      kind: "parish",
      slug: "st-josephs-b",
      // Different city — but same website URL is decisive.
      name: "St Joseph",
      city: "Different city",
      websiteUrl: "http://www.stjosephs.example.com",
    };
    const out = dedupeBatch([a, b]);
    expect(out).toHaveLength(1);
  });
});

describe("normalizeWebsiteIdentity", () => {
  it("strips www, scheme, and trailing slash", () => {
    expect(normalizeWebsiteIdentity("https://www.example.org/")).toBe("example.org/");
    expect(normalizeWebsiteIdentity("http://example.org")).toBe("example.org/");
    expect(normalizeWebsiteIdentity("https://www.example.org/path/")).toBe("example.org/path");
  });

  it("returns undefined for missing input", () => {
    expect(normalizeWebsiteIdentity(undefined)).toBeUndefined();
    expect(normalizeWebsiteIdentity(null)).toBeUndefined();
    expect(normalizeWebsiteIdentity("   ")).toBeUndefined();
  });
});

describe("normalizeParishIdentity", () => {
  it("normalizes name/city/region/country into a stable tuple", () => {
    expect(
      normalizeParishIdentity({
        name: "St. Mary's Catholic Church",
        city: "Boston",
        region: "MA",
        country: "USA",
      }),
    ).toBe("st-mary-s-catholic-church|boston|ma|usa");
  });

  it("drops empty fields and ignores missing name as no identity", () => {
    expect(
      normalizeParishIdentity({
        name: "Cathedral of the Holy Cross",
        city: "Boston",
      }),
    ).toBe("cathedral-of-the-holy-cross|boston");
    expect(normalizeParishIdentity({ city: "Boston" })).toBeUndefined();
  });
});
