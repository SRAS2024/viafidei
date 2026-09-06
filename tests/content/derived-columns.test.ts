import { describe, expect, it } from "vitest";

import { derivedColumnsFor, feastOf, subtypeOf } from "@/lib/content-shared/derived-columns";

describe("derived query columns", () => {
  it("reads a saint's feast from the numeric pair or the MM-DD string", () => {
    expect(feastOf({ feastMonth: 8, feastDayOfMonth: 28 })).toEqual({ month: 8, day: 28 });
    expect(feastOf({ feastDay: "08-28" })).toEqual({ month: 8, day: 28 });
    expect(feastOf({ feastMonth: "13", feastDayOfMonth: 1 })).toEqual({ month: null, day: null });
    expect(feastOf({})).toEqual({ month: null, day: null });
  });

  it("derives every column for a saint and leaves parish-only columns null", () => {
    const d = derivedColumnsFor("SAINT", {
      canonicalName: "Augustine",
      feastDay: "08-28",
      saintType: "doctor_of_the_church",
      deathYear: 430,
      citations: ["https://www.wikidata.org/wiki/Q8018"],
    });
    expect(d.feastMonth).toBe(8);
    expect(d.feastDayOfMonth).toBe(28);
    expect(d.subtype).toBe("doctor_of_the_church");
    expect(d.sourceRef).toBe("https://www.wikidata.org/wiki/Q8018");
    expect(d.latitude).toBeNull();
    expect(d.region).toBeNull();
  });

  it("derives geography, region and provenance for a parish", () => {
    const d = derivedColumnsFor("PARISH", {
      designation: "cathedral",
      latitude: 41.9,
      longitude: 12.45,
      country: "IT",
      state: "Lazio",
      city: "Roma",
      placeId: "osm:node/123",
      addressKey: "via-del-gianicolo|roma",
    });
    expect(d.subtype).toBe("cathedral");
    expect(d.latitude).toBe(41.9);
    expect(d.longitude).toBe(12.45);
    expect(d.region).toBe("IT/Lazio/Roma");
    expect(d.sourceRef).toBe("osm:node/123");
    expect(d.addressKey).toBe("via-del-gianicolo|roma");
    expect(derivedColumnsFor("PARISH", { latitude: 999, longitude: 0 }).latitude).toBeNull();
  });

  it("picks the classification field each type uses for its filter chips", () => {
    expect(subtypeOf("GUIDE", { kind: "rosary" })).toBe("rosary");
    expect(subtypeOf("PRAYER", { prayerType: "litany" })).toBe("litany");
    expect(subtypeOf("PARISH", {})).toBe("parish");
    expect(subtypeOf("CHURCH_DOCUMENT", { documentType: "encyclical" })).toBe("encyclical");
    expect(subtypeOf("POPE", { contentSubtype: "pope_biography" })).toBe("pope_biography");
  });
});
