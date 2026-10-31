import { describe, expect, it } from "vitest";

import { buildPrayerVariants, resolvePrayerLanguage } from "@/lib/content-shared/prayer-language";

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

  it("falls back to the worker's prayerText field when body is absent", () => {
    // The PrayerExtractor emits `prayerText`, not `body`; the variant builder
    // must still surface it so worker-published prayers show their text.
    const v = buildPrayerVariants({ prayerText: "Remember, O most gracious Virgin Mary..." });
    expect(v).toEqual([
      {
        code: "en",
        label: "English",
        text: "Remember, O most gracious Virgin Mary...",
        preserve: false,
      },
    ]);
  });

  it("prefers body over prayerText when both are present", () => {
    const v = buildPrayerVariants({ body: "Canonical body.", prayerText: "Extractor text." });
    expect(v).toHaveLength(1);
    expect(v[0]?.text).toBe("Canonical body.");
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

  it("marks a language the payload records as machine-translated as unofficial", () => {
    const v = buildPrayerVariants({
      body: "I believe in God...",
      latin: "Credo in Deum...",
      greek: "Πιστεύω εἰς Θεὸν...",
      machineTranslated: ["greek"],
    });
    expect(v.map((x) => [x.code, x.unofficial ?? false])).toEqual([
      ["en", false],
      ["la", false],
      ["el", true],
    ]);
    // Both spellings of the marker, and nothing marked when there is no marker.
    expect(
      buildPrayerVariants({ body: "x", latin: "y", machineTranslated: ["la"] })[1]?.unofficial,
    ).toBe(true);
    expect(buildPrayerVariants({ body: "x", latin: "y" })[1]).not.toHaveProperty("unofficial");
  });

  it("returns an empty list when there is no usable text at all", () => {
    expect(buildPrayerVariants({})).toEqual([]);
    expect(buildPrayerVariants({ body: "   " })).toEqual([]);
  });
});

describe("resolvePrayerLanguage (what every language chip row shows)", () => {
  const variants = buildPrayerVariants({ body: "Our Father...", latin: "Pater noster..." });

  it("offers every language but the vernacular, and shows the vernacular by default", () => {
    const r = resolvePrayerLanguage(variants, null);
    expect(r.vernacular?.code).toBe("en");
    expect(r.alternates.map((v) => v.code)).toEqual(["la"]);
    expect(r.shown?.text).toBe("Our Father...");
  });

  it("shows the chosen language, falling back to the vernacular when the prayer lacks it", () => {
    expect(resolvePrayerLanguage(variants, "la").shown?.text).toBe("Pater noster...");
    expect(resolvePrayerLanguage(variants, "el").shown?.text).toBe("Our Father...");
  });

  it("treats a Latin-only prayer's Latin as its text, with nothing to switch to", () => {
    const latinOnly = buildPrayerVariants({ latin: "Salve Regina..." });
    const r = resolvePrayerLanguage(latinOnly, null);
    expect(r.shown?.code).toBe("la");
    expect(r.alternates).toEqual([]);
    expect(resolvePrayerLanguage([], "la").shown).toBeUndefined();
  });
});
