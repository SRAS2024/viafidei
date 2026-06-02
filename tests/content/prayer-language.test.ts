import { describe, expect, it } from "vitest";

import { buildPrayerVariants } from "@/lib/content-shared/prayer-language";

describe("buildPrayerVariants (Latin / Greek prayer language support)", () => {
  it("returns a single English variant when only body is present", () => {
    const v = buildPrayerVariants({ body: "Our Father, who art in heaven..." });
    expect(v).toEqual([
      {
        code: "en",
        label: "English",
        text: "Our Father, who art in heaven...",
        preserve: false,
      },
    ]);
  });

  it("adds Latin and Greek variants, vernacular first, with preserve flags", () => {
    const v = buildPrayerVariants({
      body: "Hail Mary, full of grace...",
      latin: "Ave Maria, gratia plena...",
      greek: "Χαῖρε Μαρία...",
    });
    expect(v.map((x) => x.code)).toEqual(["en", "la", "el"]);
    expect(v.map((x) => x.label)).toEqual(["English", "Latin", "Greek"]);
    expect(v.find((x) => x.code === "la")?.preserve).toBe(true);
    expect(v.find((x) => x.code === "el")?.preserve).toBe(true);
    expect(v.find((x) => x.code === "en")?.preserve).toBe(false);
  });

  it("treats a Latin-language body as a preserved Latin variant", () => {
    const v = buildPrayerVariants({ language: "la", body: "Pater noster, qui es in caelis..." });
    expect(v).toHaveLength(1);
    expect(v[0]?.code).toBe("la");
    expect(v[0]?.label).toBe("Latin");
    expect(v[0]?.preserve).toBe(true);
  });

  it("does not duplicate a language supplied twice", () => {
    const v = buildPrayerVariants({
      language: "la",
      body: "Pater noster...",
      latin: "Pater noster (again)...",
    });
    expect(v.map((x) => x.code)).toEqual(["la"]);
    // The body wins; the duplicate latin field is dropped.
    expect(v[0]?.text).toBe("Pater noster...");
  });

  it("maps a translations array of {language,text}", () => {
    const v = buildPrayerVariants({
      body: "Glory be...",
      translations: [
        { language: "la", text: "Gloria Patri..." },
        { language: "es", text: "Gloria al Padre..." },
      ],
    });
    expect(v.map((x) => x.code)).toEqual(["en", "la", "es"]);
    expect(v.find((x) => x.code === "es")?.label).toBe("Spanish");
    expect(v.find((x) => x.code === "es")?.preserve).toBe(false);
  });

  it("maps a translations record of {code: text}", () => {
    const v = buildPrayerVariants({
      body: "Glory be...",
      translations: { latin: "Gloria Patri...", greek: "Δόξα Πατρί..." },
    });
    expect(v.map((x) => x.code)).toEqual(["en", "la", "el"]);
  });

  it("ignores empty or whitespace-only text", () => {
    const v = buildPrayerVariants({ body: "Real prayer", latin: "   ", greek: "" });
    expect(v.map((x) => x.code)).toEqual(["en"]);
  });

  it("returns an empty list when there is no usable text at all", () => {
    expect(buildPrayerVariants({})).toEqual([]);
    expect(buildPrayerVariants({ body: "   " })).toEqual([]);
  });
});
