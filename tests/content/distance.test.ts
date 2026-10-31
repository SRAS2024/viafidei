/**
 * Distance presentation (src/lib/content-shared/distance.ts).
 *
 * The owner's rules for the line under each parish name once "Use my location"
 * has sorted the list, pinned here rather than through the component because
 * every one of them is easy to get quietly wrong:
 *
 *  - every site language except English reads metric, wherever the visitor is
 *    and whatever their browser says: a Portuguese page reads kilometres;
 *  - English reads miles only for US English (and en-LR / en-MM). British,
 *    Irish, Canadian, Australian and Indian English read metric. Which English
 *    comes from the browser's language list, never from the coordinate or IP;
 *  - short distances go to the nearest hundred feet or hundred metres, then
 *    the larger unit with one decimal under ten, then whole numbers;
 *  - the number and the phrase around it are in the site's language.
 */
import { describe, expect, it, vi } from "vitest";

import {
  DISTANCE_AWAY_FALLBACK,
  formatDistance,
  formatDistanceAway,
  formatRadius,
  measureDistance,
  measurementSystemForRegion,
  navigatorLocales,
  parishDistanceMiles,
  resolveDistanceDisplay,
  type DistanceDisplay,
} from "@/lib/content-shared/distance";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";

/** Every distance goes in as miles; these say what a test means. */
const feet = (n: number) => n / 5280;
const metres = (n: number) => n / 1609.344;
const km = (n: number) => n / 1.609344;

/** Intl separates with no-break spaces (U+00A0, U+202F); compare as plain ones. */
const plain = (text: string | null) => (text === null ? null : text.replace(/\s/g, " "));

const US: DistanceDisplay = { locale: "en-US", system: "imperial" };
const GB: DistanceDisplay = { locale: "en-GB", system: "metric" };

describe("resolveDistanceDisplay: units follow the reader", () => {
  it("reads metric in every language but English, even on a US browser", () => {
    for (const site of SUPPORTED_LOCALES.filter((l) => l !== "en")) {
      expect(resolveDistanceDisplay(site, ["en-US"]).system, site).toBe("metric");
    }
    // Spanish in the United States is still a Spanish page.
    expect(resolveDistanceDisplay("es", ["es-US", "en-US"])).toEqual({
      locale: "es-US",
      system: "metric",
    });
  });

  it("reads miles for US English and the other US-system regions", () => {
    expect(resolveDistanceDisplay("en", ["en-US", "en"])).toEqual({
      locale: "en-US",
      system: "imperial",
    });
    expect(resolveDistanceDisplay("en", ["en-LR"]).system).toBe("imperial");
    expect(resolveDistanceDisplay("en", ["en-MM"]).system).toBe("imperial");
  });

  it("reads metric for British English, and for every other English", () => {
    expect(resolveDistanceDisplay("en", ["en-GB", "en"])).toEqual({
      locale: "en-GB",
      system: "metric",
    });
    for (const tag of ["en-IE", "en-CA", "en-AU", "en-NZ", "en-IN", "en-ZA", "en-PH"]) {
      expect(resolveDistanceDisplay("en", [tag]).system, tag).toBe("metric");
    }
  });

  it("takes the region from the first tag that names one", () => {
    // A German browser reading the English page: metric, worded as en-US.
    expect(resolveDistanceDisplay("en", ["de-DE", "en-US"])).toEqual({
      locale: "en-US",
      system: "metric",
    });
    // A Spanish-speaking American reading it: miles.
    expect(resolveDistanceDisplay("en", ["es-US", "en"])).toEqual({
      locale: "en",
      system: "imperial",
    });
    expect(resolveDistanceDisplay("en", ["en", "en-GB"]).system).toBe("metric");
    expect(resolveDistanceDisplay("en", ["fr-CA", "en"]).system).toBe("metric");
  });

  it("falls back to the region a bare language implies, then to US English", () => {
    expect(resolveDistanceDisplay("en", ["en"]).system).toBe("imperial"); // en -> en-Latn-US
    expect(resolveDistanceDisplay("en", ["de"]).system).toBe("metric"); // de -> de-Latn-DE
    expect(resolveDistanceDisplay("en", [])).toEqual({ locale: "en", system: "imperial" });
    expect(resolveDistanceDisplay("en", undefined)).toEqual({ locale: "en", system: "imperial" });
  });

  it("skips malformed tags rather than guessing from them", () => {
    expect(resolveDistanceDisplay("en", ["en_US", "", 42, "x", "en-GB"])).toEqual({
      locale: "en-GB",
      system: "metric",
    });
    expect(resolveDistanceDisplay("en", "en-GB")).toEqual({ locale: "en-GB", system: "metric" });
  });

  it("treats a missing or unsupported site language as English", () => {
    expect(resolveDistanceDisplay(undefined, ["en-GB"]).system).toBe("metric");
    expect(resolveDistanceDisplay(null, ["en-US"]).system).toBe("imperial");
    expect(resolveDistanceDisplay("xx", ["en-US"]).system).toBe("imperial");
  });

  it("formats in the reader's regional variant of the site language", () => {
    expect(resolveDistanceDisplay("pt", ["pt-PT", "en-US"]).locale).toBe("pt-PT");
    expect(resolveDistanceDisplay("pt", ["en-US"]).locale).toBe("pt");
    expect(resolveDistanceDisplay("zh", ["zh-TW"]).locale).toBe("zh-TW");
    // The site's "tl" is CLDR's "fil".
    expect(resolveDistanceDisplay("tl", ["fil-PH"]).locale).toBe("fil-PH");
    // Latin has no CLDR number data, so it borrows the Holy See's conventions.
    expect(resolveDistanceDisplay("la", ["la", "en-US"])).toEqual({
      locale: "it-VA",
      system: "metric",
    });
  });
});

describe("measurementSystemForRegion", () => {
  it("is miles for US, LR and MM only, whatever the case", () => {
    expect(measurementSystemForRegion("US")).toBe("imperial");
    expect(measurementSystemForRegion("lr")).toBe("imperial");
    expect(measurementSystemForRegion("MM")).toBe("imperial");
    expect(measurementSystemForRegion("GB")).toBe("metric");
    expect(measurementSystemForRegion("419")).toBe("metric");
  });
});

describe("navigatorLocales", () => {
  it("prefers navigator.languages and falls back to navigator.language", () => {
    expect(navigatorLocales({ languages: ["en-GB", "en"], language: "en-GB" })).toEqual([
      "en-GB",
      "en",
    ]);
    expect(navigatorLocales({ languages: [], language: "pt-BR" })).toEqual(["pt-BR"]);
    expect(navigatorLocales({ language: "it-IT" })).toEqual(["it-IT"]);
    expect(navigatorLocales({ languages: ["en-US", 7, " "] })).toEqual(["en-US"]);
  });

  it("never throws when there is no navigator at all (server render)", () => {
    expect(navigatorLocales(null)).toEqual([]);
    expect(navigatorLocales(undefined)).toEqual([]);
    expect(navigatorLocales({})).toEqual([]);
  });
});

describe("measureDistance: precision shrinks with distance", () => {
  it("rounds short distances to the nearest hundred feet or hundred metres", () => {
    const ft = (value: number) => ({ value, unit: "foot", fractionDigits: 0 });
    const m = (value: number) => ({ value, unit: "meter", fractionDigits: 0 });
    expect(measureDistance(feet(800), "imperial")).toEqual(ft(800));
    expect(measureDistance(feet(840), "imperial")).toEqual(ft(800));
    expect(measureDistance(feet(860), "imperial")).toEqual(ft(900));
    expect(measureDistance(metres(300), "metric")).toEqual(m(300));
    expect(measureDistance(metres(340), "metric")).toEqual(m(300));
    expect(measureDistance(metres(360), "metric")).toEqual(m(400));
  });

  it("never states less than a hundred, and never a negative", () => {
    expect(measureDistance(0, "imperial")).toEqual({ value: 100, unit: "foot", fractionDigits: 0 });
    expect(measureDistance(feet(20), "imperial")?.value).toBe(100);
    expect(measureDistance(metres(1), "metric")).toEqual({
      value: 100,
      unit: "meter",
      fractionDigits: 0,
    });
    expect(measureDistance(-3, "metric")?.value).toBe(100);
  });

  it("switches to the larger unit where a thousand would show", () => {
    // 940 ft is still feet; 960 ft would round to 1,000 ft, which reads 0.2 mi.
    expect(measureDistance(feet(940), "imperial")).toEqual({
      value: 900,
      unit: "foot",
      fractionDigits: 0,
    });
    expect(measureDistance(feet(960), "imperial")).toEqual({
      value: 0.2,
      unit: "mile",
      fractionDigits: 1,
    });
    expect(measureDistance(metres(940), "metric")).toEqual({
      value: 900,
      unit: "meter",
      fractionDigits: 0,
    });
    expect(measureDistance(metres(960), "metric")).toEqual({
      value: 1,
      unit: "kilometer",
      fractionDigits: 1,
    });
  });

  it("gives one decimal below ten of the larger unit, whole numbers from ten", () => {
    const tenth = (value: number, unit: string) => ({ value, unit, fractionDigits: 1 });
    const whole = (value: number, unit: string) => ({ value, unit, fractionDigits: 0 });
    expect(measureDistance(1.3, "imperial")).toEqual(tenth(1.3, "mile"));
    expect(measureDistance(km(2.4), "metric")).toEqual(tenth(2.4, "kilometer"));
    expect(measureDistance(km(9.94), "metric")).toEqual(tenth(9.9, "kilometer"));
    // 9.96 would round to "10.0"; from ten on the tenth is noise.
    expect(measureDistance(km(9.96), "metric")).toEqual(whole(10, "kilometer"));
    expect(measureDistance(km(14.2), "metric")).toEqual(whole(14, "kilometer"));
    expect(measureDistance(1340.4, "imperial")).toEqual(whole(1340, "mile"));
  });

  it("returns null for a distance it cannot state honestly", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, undefined, null, "3"]) {
      expect(measureDistance(bad, "metric")).toBeNull();
      expect(formatDistance(bad, GB)).toBeNull();
      expect(formatDistanceAway(bad, GB, "{distance} away")).toBeNull();
    }
  });
});

describe("formatDistance: the reader's notation", () => {
  it("uses short US units for US English", () => {
    expect(formatDistance(feet(800), US)).toBe("800 ft");
    expect(formatDistance(1.3, US)).toBe("1.3 mi");
    expect(formatDistance(14.2, US)).toBe("14 mi");
    expect(formatDistance(1340, US)).toBe("1,340 mi");
  });

  it("keeps the tenth under ten even when it is a zero", () => {
    expect(formatDistance(km(0.96), GB)).toBe("1.0 km");
    expect(formatDistance(3.02, US)).toBe("3.0 mi");
  });

  it("uses each language's own separators and unit abbreviations", () => {
    expect(formatDistance(metres(300), GB)).toBe("300 m");
    expect(formatDistance(km(2.4), GB)).toBe("2.4 km");
    const pt = resolveDistanceDisplay("pt", ["pt-BR"]);
    expect(plain(formatDistance(km(2.4), pt))).toBe("2,4 km");
    expect(plain(formatDistance(km(2157), pt))).toBe("2.157 km");
    expect(plain(formatDistance(km(2157), resolveDistanceDisplay("fr", ["fr-FR"])))).toBe(
      "2 157 km",
    );
    expect(formatDistance(metres(300), resolveDistanceDisplay("zh", []))).toBe("300米");
    expect(formatDistance(km(2.4), resolveDistanceDisplay("ko", []))).toBe("2.4km");
  });

  it("still states a distance on an engine without Intl.Locale or unit formatting", () => {
    // Safari before 14: the locate button must keep working, not throw mid-click.
    const oldIntl = Object.create(Intl, {
      Locale: { value: undefined },
      NumberFormat: {
        value: () => {
          throw new RangeError("Value unit out of range for Intl.NumberFormat options");
        },
      },
    });
    vi.stubGlobal("Intl", oldIntl);
    try {
      const display = resolveDistanceDisplay("en", ["en-GB"]);
      // No tag can be read, so English falls back to US English.
      expect(display).toEqual({ locale: "en", system: "imperial" });
      expect(formatDistanceAway(km(2.4), display)).toBe("1.5 mi away");
      expect(formatDistance(km(2.4), resolveDistanceDisplay("pt", ["pt-BR"]))).toBe("2.4 km");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("formatDistanceAway: the line under the parish name", () => {
  const line = (site: Locale, browser: string[], miles: number) =>
    plain(
      formatDistanceAway(
        miles,
        resolveDistanceDisplay(site, browser),
        createTranslator(site)("parishes.distanceAway"),
      ),
    );

  it("speaks every site language, in metric outside English", () => {
    const expected: Record<Locale, string> = {
      en: "2.4 km away",
      es: "A 2,4 km de distancia",
      fr: "À 2,4 km",
      it: "A 2,4 km di distanza",
      de: "2,4 km entfernt",
      pt: "A 2,4 km de distância",
      pl: "2,4 km stąd",
      la: "2,4 km abest",
      tl: "2.4 km ang layo",
      vi: "Cách 2,4 km",
      ko: "2.4km 거리",
      zh: "距您2.4公里",
    };
    for (const site of SUPPORTED_LOCALES) {
      // A British browser for English; for every other language it is irrelevant.
      const browser = site === "en" ? ["en-GB"] : ["en-US"];
      expect(line(site, browser, km(2.4)), site).toBe(expected[site]);
    }
  });

  it("reads miles and feet for US English, and Portuguese metric on the same browser", () => {
    expect(line("en", ["en-US"], 1.3)).toBe("1.3 mi away");
    expect(line("en", ["en-US"], feet(800))).toBe("800 ft away");
    expect(line("pt", ["en-US"], feet(800))).toBe("A 200 m de distância");
  });

  it("uses the READER, not the coordinate: a US phone in Rome still reads feet", () => {
    // St Peter's Basilica, from a hotel a few hundred feet away.
    const miles = parishDistanceMiles(
      { latitude: 41.9022, longitude: 12.4539 },
      { latitude: 41.9022, longitude: 12.455 },
    )!;
    expect(line("en", ["en-US"], miles)).toBe("300 ft away");
    expect(line("it", ["it-IT"], miles)).toBe("A 100 m di distanza");
  });

  it("keeps the distance when the template has lost its placeholder", () => {
    // A translator that misses returns the raw key; the distance must survive it.
    expect(formatDistanceAway(km(2.4), GB, "parishes.distanceAway")).toBe("2.4 km away");
    expect(formatDistanceAway(km(2.4), GB)).toBe("2.4 km away");
    expect(DISTANCE_AWAY_FALLBACK).toBe(DICTIONARIES.en["parishes.distanceAway"]);
  });
});

describe("the parishes.distanceAway phrase", () => {
  it("is defined with exactly one placeholder in every dictionary", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const template = DICTIONARIES[locale]["parishes.distanceAway"];
      expect(typeof template, locale).toBe("string");
      expect(template!.split("{distance}"), locale).toHaveLength(2);
    }
  });

  it("is translated, not inherited from English, in every other language", () => {
    for (const locale of SUPPORTED_LOCALES.filter((l) => l !== "en")) {
      expect(DICTIONARIES[locale]["parishes.distanceAway"], locale).not.toBe(
        DICTIONARIES.en["parishes.distanceAway"],
      );
    }
  });
});

describe("formatRadius", () => {
  it("states a search radius in whole units, never to a tenth", () => {
    expect(formatRadius(50, "imperial")).toBe("50 miles");
    expect(formatRadius(500, "imperial")).toBe("500 miles");
    expect(formatRadius(1, "imperial")).toBe("1 mile");
    expect(formatRadius(50, "metric")).toBe("80 kilometres");
    expect(formatRadius(150, "metric")).toBe("241 kilometres");
    expect(formatRadius(undefined, "metric")).toBeNull();
  });
});

describe("parishDistanceMiles", () => {
  it("is haversine from the visitor to the parish", () => {
    // Chicago -> New York, ~711 statute miles great-circle.
    const miles = parishDistanceMiles(
      { latitude: 41.8781, longitude: -87.6298 },
      { latitude: 40.7128, longitude: -74.006 },
    );
    expect(miles).toBeCloseTo(711, 0);
  });

  it("returns null when either point has no usable coordinate", () => {
    const here = { latitude: 41.88, longitude: -87.63 };
    expect(parishDistanceMiles(here, {})).toBeNull();
    expect(parishDistanceMiles(here, { latitude: 40, longitude: undefined })).toBeNull();
    expect(parishDistanceMiles(here, { latitude: Number.NaN, longitude: 0 })).toBeNull();
    expect(parishDistanceMiles({ latitude: Number.NaN, longitude: 0 }, here)).toBeNull();
  });
});
