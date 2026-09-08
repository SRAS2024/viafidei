/**
 * Distance presentation (src/lib/content-shared/distance.ts).
 *
 * The owner asked for two things that are easy to get quietly wrong:
 *
 *  - the unit system must follow the DEVICE, not the coordinate, so a US phone
 *    abroad still reads miles and a metric phone in the US still reads
 *    kilometres;
 *  - a parish across the street must never read "0.0 miles away".
 *
 * Both are pinned here rather than through the component, because the same
 * rules have to hold server-side.
 */
import { describe, expect, it } from "vitest";

import {
  deviceMeasurementSystem,
  formatDistance,
  formatDistanceAway,
  formatRadius,
  measurementSystemForLocale,
  measurementSystemForLocales,
  parishDistanceMiles,
} from "@/lib/content-shared/distance";

describe("measurementSystemForLocale", () => {
  it("reads the region subtag, not the language", () => {
    expect(measurementSystemForLocale("en-US")).toBe("imperial");
    expect(measurementSystemForLocale("en-AU")).toBe("metric");
    expect(measurementSystemForLocale("es-US")).toBe("imperial");
    expect(measurementSystemForLocale("fr-FR")).toBe("metric");
  });

  it("treats the imperial allow-list as imperial, everyone else as metric", () => {
    expect(measurementSystemForLocale("en-LR")).toBe("imperial");
    expect(measurementSystemForLocale("my-MM")).toBe("imperial");
    // Metric by law, miles on every road sign.
    expect(measurementSystemForLocale("en-GB")).toBe("imperial");
    expect(measurementSystemForLocale("de-DE")).toBe("metric");
    expect(measurementSystemForLocale("it-IT")).toBe("metric");
    expect(measurementSystemForLocale("pl-PL")).toBe("metric");
  });

  it("resolves a bare language through likely subtags", () => {
    expect(measurementSystemForLocale("en")).toBe("imperial"); // en -> en-Latn-US
    expect(measurementSystemForLocale("de")).toBe("metric");
    expect(measurementSystemForLocale("ja")).toBe("metric");
  });

  it("returns null rather than guessing for an unusable tag", () => {
    expect(measurementSystemForLocale("")).toBeNull();
    expect(measurementSystemForLocale("x")).toBeNull();
    expect(measurementSystemForLocale("en_US")).toBeNull();
    expect(measurementSystemForLocale(undefined)).toBeNull();
    expect(measurementSystemForLocale(42)).toBeNull();
  });
});

describe("measurementSystemForLocales", () => {
  it("takes the first tag it can resolve, in preference order", () => {
    expect(measurementSystemForLocales(["x", "de-DE", "en-US"])).toBe("metric");
    expect(measurementSystemForLocales(["en-US", "de-DE"])).toBe("imperial");
    expect(measurementSystemForLocales("fr-CA")).toBe("metric");
  });

  it("falls back to the unit the rest of the feature already speaks", () => {
    expect(measurementSystemForLocales([])).toBe("imperial");
    expect(measurementSystemForLocales(undefined)).toBe("imperial");
  });
});

describe("deviceMeasurementSystem", () => {
  it("prefers navigator.languages and falls back to navigator.language", () => {
    expect(deviceMeasurementSystem({ languages: ["de-DE", "en-US"], language: "en-US" })).toBe(
      "metric",
    );
    expect(deviceMeasurementSystem({ languages: [], language: "en-GB" })).toBe("imperial");
    expect(deviceMeasurementSystem({ language: "it-IT" })).toBe("metric");
  });

  it("never throws when there is no navigator at all (server render)", () => {
    expect(deviceMeasurementSystem(null)).toBe("imperial");
    expect(deviceMeasurementSystem(undefined)).toBe("imperial");
  });

  it("uses the DEVICE, not the coordinate — a US phone abroad still reads miles", () => {
    // St Peter's Basilica, from a hotel a few hundred metres away.
    const miles = parishDistanceMiles(
      { latitude: 41.9022, longitude: 12.4539 },
      { latitude: 41.9022, longitude: 12.455 },
    )!;
    const us = deviceMeasurementSystem({ languages: ["en-US"] });
    const it = deviceMeasurementSystem({ languages: ["it-IT"] });
    expect(formatDistanceAway(miles, us)).toMatch(/feet away$/);
    expect(formatDistanceAway(miles, it)).toMatch(/metres away$/);
  });
});

describe("formatDistance", () => {
  it("shows whole feet under a tenth of a mile", () => {
    expect(formatDistance(150 / 5280, "imperial")).toBe("150 feet");
    expect(formatDistance(0.0999, "imperial")).toBe("527 feet");
    expect(formatDistance(1 / 5280, "imperial")).toBe("1 foot");
  });

  it("shows miles to one decimal from a tenth of a mile up", () => {
    expect(formatDistance(0.1, "imperial")).toBe("0.1 miles");
    expect(formatDistance(3.24, "imperial")).toBe("3.2 miles");
    expect(formatDistance(12.36, "imperial")).toBe("12.4 miles");
  });

  it("drops the meaningless tenth on a three-digit distance", () => {
    expect(formatDistance(1340, "imperial")).toBe("1,340 miles");
    expect(formatDistance(1340, "metric")).toBe("2,157 kilometres");
  });

  it("shows whole metres under a kilometre and kilometres above it", () => {
    expect(formatDistance(150 / 1609.344, "metric")).toBe("150 metres");
    expect(formatDistance(1 / 1609.344, "metric")).toBe("1 metre");
    expect(formatDistance(0.1, "metric")).toBe("161 metres");
    expect(formatDistance(999 / 1609.344, "metric")).toBe("999 metres");
    expect(formatDistance(3.24, "metric")).toBe("5.2 kilometres");
  });

  it("never renders a zero or a negative distance", () => {
    expect(formatDistance(0, "imperial")).toBe("1 foot");
    expect(formatDistance(0, "metric")).toBe("1 metre");
    expect(formatDistance(-3, "imperial")).toBe("1 foot");
    for (const system of ["imperial", "metric"] as const) {
      for (const value of [0, 1e-12, 0.05, 0.1, 3, 1340]) {
        const text = formatDistance(value, system)!;
        expect(text).not.toMatch(/^-/);
        expect(text).not.toMatch(/^0(\.0)? /);
      }
    }
  });

  it("returns null for a distance it cannot state honestly", () => {
    expect(formatDistance(Number.NaN, "imperial")).toBeNull();
    expect(formatDistance(Number.POSITIVE_INFINITY, "metric")).toBeNull();
    expect(formatDistance(undefined, "imperial")).toBeNull();
    expect(formatDistance(null, "imperial")).toBeNull();
    expect(formatDistance("3", "imperial")).toBeNull();
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

describe("formatDistanceAway", () => {
  it("is the label the card shows, and nothing when there is no distance", () => {
    expect(formatDistanceAway(0.1, "imperial")).toBe("0.1 miles away");
    expect(formatDistanceAway(150 / 5280, "imperial")).toBe("150 feet away");
    expect(formatDistanceAway(150 / 1609.344, "metric")).toBe("150 metres away");
    expect(formatDistanceAway(undefined, "metric")).toBeNull();
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
