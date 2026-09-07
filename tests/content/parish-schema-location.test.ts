/**
 * The strict parish schema locates a record EITHER by address + city OR by
 * coordinates — OpenStreetMap carries a street address on only a quarter of
 * Catholic churches but coordinates on all of them — and never lets a record
 * through with neither. Source identity (`sourceRef`) and the ISO country code
 * are optional fields the OSM lane fills.
 */
import { describe, expect, it } from "vitest";

import { parishSchema } from "@/lib/checklist/schemas/parish";

const base = {
  slug: "st-patrick",
  title: "St. Patrick Catholic Church",
  citations: ["https://www.openstreetmap.org/node/1"],
};

describe("parish schema location rule", () => {
  it("accepts address + city without coordinates", () => {
    expect(
      parishSchema.schema.safeParse({ ...base, address: "1 Main St", city: "Springfield" }).success,
    ).toBe(true);
  });

  it("accepts coordinates without an address or city (nothing invented)", () => {
    const r = parishSchema.schema.safeParse({ ...base, latitude: 42.3, longitude: -71.1 });
    expect(r.success).toBe(true);
    expect(
      parishSchema.schema.safeParse({
        ...base,
        city: "Springfield",
        latitude: 42.3,
        longitude: -71.1,
      }).success,
    ).toBe(true);
  });

  it("rejects a record with neither (address alone, city alone, one coordinate)", () => {
    expect(parishSchema.schema.safeParse({ ...base, address: "1 Main St" }).success).toBe(false);
    expect(parishSchema.schema.safeParse({ ...base, city: "Springfield" }).success).toBe(false);
    expect(parishSchema.schema.safeParse({ ...base, latitude: 42.3 }).success).toBe(false);
    expect(parishSchema.schema.safeParse({ ...base }).success).toBe(false);
    // Blank strings do not count as an address.
    expect(
      parishSchema.schema.safeParse({ ...base, address: " ", city: "Springfield" }).success,
    ).toBe(false);
  });

  it("still requires at least one citation and validates the optional provenance fields", () => {
    expect(
      parishSchema.schema.safeParse({ ...base, citations: [], latitude: 1, longitude: 1 }).success,
    ).toBe(false);
    expect(
      parishSchema.schema.safeParse({
        ...base,
        latitude: 1,
        longitude: 1,
        sourceRef: "osm:node/1",
        countryCode: "IE",
      }).success,
    ).toBe(true);
    expect(
      parishSchema.schema.safeParse({ ...base, latitude: 1, longitude: 1, countryCode: "IRL" })
        .success,
    ).toBe(false);
    expect(parishSchema.instruction.requiredFields).toEqual(["slug", "title", "citations"]);
  });
});
