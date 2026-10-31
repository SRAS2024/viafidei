import { describe, expect, it } from "vitest";

import { designationFor } from "@/lib/admin-worker/parish-discovery-runner";
import {
  isCommunionDenomination,
  osmElementToParish,
  osmParishSummary,
  parishExclusionFor,
} from "@/lib/admin-worker/parish-osm";
import { buildTileQuery } from "@/lib/admin-worker/parish-osm-overpass";

function el(tags: Record<string, string>, at = { lat: 50.06, lon: 19.94 }) {
  return {
    type: "node",
    id: 42,
    lat: at.lat,
    lon: at.lon,
    tags: { amenity: "place_of_worship", religion: "christian", ...tags },
  } as Parameters<typeof osmElementToParish>[0];
}

describe("OSM parish quality rules", () => {
  it("admits Eastern Catholic churches in communion with Rome and refuses other bodies", () => {
    for (const d of [
      "ukrainian_greek_catholic",
      "greek_catholic",
      "maronite",
      "syro-malabar_catholic",
      "melkite",
    ]) {
      expect(isCommunionDenomination(d)).toBe(true);
      expect(osmElementToParish(el({ name: "St Nicholas", denomination: d }))).not.toBeNull();
    }
    for (const d of [
      "old_catholic",
      "polish_catholic",
      "catholic_sspx",
      "liberal_catholic",
      "catholic;protestant",
    ]) {
      expect(isCommunionDenomination(d)).toBe(false);
      expect(osmElementToParish(el({ name: "St Nicholas", denomination: d }))).toBeNull();
    }
  });

  it("names the particular church in an Eastern Catholic summary", () => {
    expect(
      osmParishSummary({
        name: "St Volodymyr",
        designation: "parish",
        denomination: "ukrainian_greek_catholic",
        city: "Lviv",
        country: "Ukraine",
      }),
    ).toMatch(/^St Volodymyr is a Ukrainian Greek Catholic parish in Lviv, Ukraine/);
  });

  it("leaves out private, funerary, wayside and generic-named places", () => {
    expect(parishExclusionFor("St Joseph", { access: "private" })?.reason).toBe("private");
    expect(parishExclusionFor("Friedhofskapelle St. Michael", {})?.reason).toBe("funerary-chapel");
    expect(parishExclusionFor("Bildstock am Weg", {})?.reason).toBe("funerary-chapel");
    expect(parishExclusionFor("Kaplica domowa", {})?.reason).toBe("generic-name");
    expect(parishExclusionFor("Kapelle", {})?.reason).toBe("generic-name");
    // A real dedication is kept, however short.
    expect(parishExclusionFor("Kapelle St. Anna", {})).toBeNull();
    expect(parishExclusionFor("Iglesia de la Virgen", {})).toBeNull();
    expect(
      osmElementToParish(el({ name: "Kaplica szpitalna", denomination: "roman_catholic" })),
    ).toBeNull();
  });

  it("starts every published name with a capital letter", () => {
    const c = osmElementToParish(
      el({ name: "chiesa parrocchiale Torre Pedrera", denomination: "catholic" }),
    );
    expect(c?.name).toBe("Chiesa parrocchiale Torre Pedrera");
  });

  it("calls only the four papal basilicas in Rome major basilicas", () => {
    expect(
      designationFor("Basilica di Santa Maria Maggiore", {}, { lat: 41.8976, lon: 12.4983 }),
    ).toBe("major-basilica");
    expect(
      designationFor("Chiesa di Santa Maria Maggiore", {}, { lat: 41.71, lon: 15.95 }),
    ).not.toBe("major-basilica");
    expect(designationFor("San Giovanni in Laterano", {}, { lat: 45.46, lon: 9.19 })).not.toBe(
      "major-basilica",
    );
    const far = osmElementToParish(
      el(
        { name: "Santuario di Santa Maria Maggiore", denomination: "catholic" },
        { lat: 45.4, lon: 7.9 },
      ),
    );
    expect(far?.designation).toBe("shrine");
  });

  it("asks Overpass for the Eastern Catholic denominations too", () => {
    expect(buildTileQuery([50, 19, 51, 20], 500)).toContain(
      '["denomination"~"catholic|maronite|melkite"]',
    );
  });
});
