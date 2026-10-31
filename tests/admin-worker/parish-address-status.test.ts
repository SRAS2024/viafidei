/**
 * Address completeness and the per-row research state machine
 * (`payload._meta.addressResearch`): complete = street + locality + country
 * code + a postal code where the country uses them; partial rows retry after
 * 7 days, then 30; after 3 partial attempts — or when the source no longer
 * returns the object — a row needs research and is retried every 90 days.
 */
import { describe, expect, it } from "vitest";

import {
  ADDRESS_RETRY_FIRST_MS,
  ADDRESS_RETRY_LATE_MS,
  ADDRESS_RETRY_SECOND_MS,
  addressPrecisionOf,
  addressResearchMetaOf,
  missingAddressFields,
  nextAddressResearchMeta,
} from "@/lib/admin-worker/parish-address-status";

const NOW = Date.UTC(2026, 9, 31, 12, 0, 0);
const COMPLETE = {
  address: "Via del Velabro",
  city: "Roma",
  postalCode: "00153",
  countryCode: "IT",
};

describe("missingAddressFields", () => {
  it("lists the street, locality, postal code and country code a payload lacks", () => {
    expect(missingAddressFields(COMPLETE)).toEqual([]);
    expect(missingAddressFields({ city: "Roma" })).toEqual([
      "address",
      "postalCode",
      "countryCode",
    ]);
    expect(missingAddressFields({ ...COMPLETE, address: "  " })).toEqual(["address"]);
  });

  it("does not ask for a postal code where the country has none", () => {
    expect(
      missingAddressFields({ address: "Kampala Road", city: "Kampala", countryCode: "UG" }),
    ).toEqual([]);
  });
});

describe("nextAddressResearchMeta", () => {
  const step = (previous: ReturnType<typeof nextAddressResearchMeta> | null, payload = {}) =>
    nextAddressResearchMeta({
      previous,
      payload,
      returned: true,
      precision: "street",
      sources: ["osm", "nominatim"],
      now: NOW,
    });

  it("marks a complete address complete", () => {
    const meta = step(null, COMPLETE);
    expect(meta).toMatchObject({
      status: "complete",
      missing: [],
      attempts: 1,
      lastAttemptAt: NOW,
    });
    expect(meta.nextDueAt).toBeGreaterThan(NOW + ADDRESS_RETRY_LATE_MS);
  });

  it("retries a partial address after 7 days, then 30, then needs research every 90", () => {
    const first = step(null, { city: "Roma", countryCode: "IT" });
    expect(first).toMatchObject({
      status: "partial",
      missing: ["address", "postalCode"],
      attempts: 1,
    });
    expect(first.nextDueAt).toBe(NOW + ADDRESS_RETRY_FIRST_MS);
    const second = step(first, { city: "Roma", countryCode: "IT" });
    expect(second).toMatchObject({ status: "partial", attempts: 2 });
    expect(second.nextDueAt).toBe(NOW + ADDRESS_RETRY_SECOND_MS);
    const third = step(second, { city: "Roma", countryCode: "IT" });
    expect(third).toMatchObject({ status: "needs_research", attempts: 3 });
    expect(third.nextDueAt).toBe(NOW + ADDRESS_RETRY_LATE_MS);
    const fourth = step(third, { city: "Roma", countryCode: "IT" });
    expect(fourth).toMatchObject({ status: "needs_research", attempts: 4 });
    expect(fourth.nextDueAt).toBe(NOW + ADDRESS_RETRY_LATE_MS);
  });

  it("needs research at once when the source no longer returns the object", () => {
    const meta = nextAddressResearchMeta({
      previous: null,
      payload: { city: "Roma" },
      returned: false,
      precision: "locality",
      sources: ["osm"],
      now: NOW,
    });
    expect(meta).toMatchObject({ status: "needs_research", attempts: 1 });
    expect(meta.nextDueAt).toBe(NOW + ADDRESS_RETRY_LATE_MS);
  });

  it("keeps the union of sources and a recorded country correction", () => {
    const first = nextAddressResearchMeta({
      previous: null,
      payload: COMPLETE,
      returned: true,
      precision: "rooftop",
      sources: ["osm", "nominatim"],
      now: NOW,
      countryCorrectedFrom: "MX",
    });
    const again = nextAddressResearchMeta({
      previous: first,
      payload: COMPLETE,
      returned: true,
      precision: "rooftop",
      sources: ["osm"],
      now: NOW,
    });
    expect(again.sources).toEqual(["osm", "nominatim"]);
    expect(again.countryCorrectedFrom).toBe("MX");
  });
});

describe("addressPrecisionOf / addressResearchMetaOf", () => {
  it("reads the precision of a stored street line", () => {
    expect(addressPrecisionOf("")).toBe("locality");
    expect(addressPrecisionOf("Kirchplatz")).toBe("street");
    expect(addressPrecisionOf("Kirchplatz 3a")).toBe("rooftop");
    expect(addressPrecisionOf("Kirchplatz", true)).toBe("rooftop");
  });

  it("reads the stored state, or null when never researched", () => {
    expect(addressResearchMetaOf({})).toBeNull();
    expect(addressResearchMetaOf({ _meta: { websiteVerification: {} } })).toBeNull();
    expect(addressResearchMetaOf({ _meta: { addressResearch: { attempts: 2 } } })).toEqual({
      attempts: 2,
    });
  });
});
