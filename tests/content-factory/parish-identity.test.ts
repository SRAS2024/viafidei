/**
 * Parish identity validator tests (spec §12).
 */

import { describe, expect, it } from "vitest";
import {
  classifyParishPage,
  parishDuplicateFingerprint,
  validateParishIdentity,
} from "@/lib/content-factory/normalize/parish-identity";

describe("validateParishIdentity()", () => {
  it("accepts a complete parish record", () => {
    const r = validateParishIdentity({
      name: "St. Patrick's Cathedral",
      city: "New York",
      country: "United States",
      diocese: "Archdiocese of New York",
    });
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it("rejects a parish missing required fields", () => {
    const r = validateParishIdentity({
      name: "St. Patrick's Cathedral",
      city: "New York",
      // no country
    });
    expect(r.ok).toBe(false);
    expect(r.missing).toContain("country");
  });

  it("rejects an empty parish record", () => {
    const r = validateParishIdentity({});
    expect(r.ok).toBe(false);
    expect(r.missing).toContain("name");
    expect(r.missing).toContain("city");
    expect(r.missing).toContain("country");
  });
});

describe("classifyParishPage()", () => {
  it("flags a school page", () => {
    const r = classifyParishPage({
      title: "St. Mary's Catholic Elementary School",
      body: "Welcome to our school. Enrollment for next year is now open.",
    });
    expect(r.category).toBe("school");
  });

  it("flags a parish bulletin page", () => {
    const r = classifyParishPage({
      title: "Weekly Bulletin — June 2024",
      body: "This week's bulletin.",
    });
    expect(r.category).toBe("bulletin");
  });

  it("flags a staff directory", () => {
    const r = classifyParishPage({
      title: "Our Staff",
      body: "Staff Directory at St. Joseph Parish: Father John, Deacon Mark.",
    });
    expect(r.category).toBe("staff");
  });

  it("flags a livestream page", () => {
    const r = classifyParishPage({
      title: "Watch Live",
      body: "Watch Mass live every Sunday at 10am.",
    });
    expect(r.category).toBe("livestream");
  });

  it("flags a donation page", () => {
    const r = classifyParishPage({
      title: "Give Now",
      body: "Donate now to support our parish stewardship program.",
    });
    expect(r.category).toBe("donation");
  });

  it("returns no category for a real parish identity page", () => {
    const r = classifyParishPage({
      title: "St. Patrick's Cathedral",
      body: "St. Patrick's Cathedral is the cathedral of the Archdiocese of New York.",
    });
    expect(r.category).toBeNull();
  });
});

describe("parishDuplicateFingerprint()", () => {
  it("produces the same fingerprint for identical parishes", () => {
    const a = parishDuplicateFingerprint({
      name: "St. Patrick's Cathedral",
      city: "New York",
      country: "United States",
    });
    const b = parishDuplicateFingerprint({
      name: "St Patricks Cathedral",
      city: "new york",
      country: "UNITED STATES",
    });
    expect(a).toBe(b);
  });

  it("produces different fingerprints for different parishes", () => {
    const a = parishDuplicateFingerprint({
      name: "St. Patrick's",
      city: "New York",
      country: "USA",
    });
    const b = parishDuplicateFingerprint({
      name: "St. Patrick's",
      city: "Boston",
      country: "USA",
    });
    expect(a).not.toBe(b);
  });
});
