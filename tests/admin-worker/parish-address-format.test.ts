/**
 * Locale-aware address formatting: the street line follows the country's
 * order ("Hauptstraße 12" / "12 Main Street"), a house number alone is no
 * street line, and a postal code must fit its country's format or it is
 * dropped — never reshaped into something it was not.
 */
import { describe, expect, it } from "vitest";

import {
  composeStreetLine,
  countryNameFor,
  countryUsesPostalCodes,
  normalizePostalCode,
  streetBeforeNumber,
} from "@/lib/admin-worker/parish-address-format";

describe("composeStreetLine", () => {
  it("puts the street first where the country does", () => {
    for (const cc of [
      "DE",
      "AT",
      "CH",
      "NL",
      "BE",
      "IT",
      "ES",
      "PT",
      "PL",
      "CZ",
      "BR",
      "MX",
      "AR",
    ]) {
      expect(streetBeforeNumber(cc), cc).toBe(true);
    }
    expect(composeStreetLine("Hauptstraße", "12", "DE")).toBe("Hauptstraße 12");
    expect(composeStreetLine("ul. Długa", "5", "pl")).toBe("ul. Długa 5");
    expect(composeStreetLine("Via del Velabro", "9", "IT")).toBe("Via del Velabro 9");
  });

  it("puts the number first in the US / UK / French convention and for an unknown country", () => {
    for (const cc of ["US", "CA", "GB", "IE", "AU", "NZ", "FR", "LU", "PH", "IN", "ZA", "SG"]) {
      expect(streetBeforeNumber(cc), cc).toBe(false);
    }
    expect(composeStreetLine("Washington Street", "1400", "US")).toBe("1400 Washington Street");
    expect(composeStreetLine("Rue de l'Église", "3", "FR")).toBe("3 Rue de l'Église");
    expect(composeStreetLine("Main Street", "7", undefined)).toBe("7 Main Street");
  });

  it("never makes a street line out of a bare house number", () => {
    expect(composeStreetLine("", "12", "DE")).toBe("");
    expect(composeStreetLine(undefined, "12", "US")).toBe("");
    expect(composeStreetLine("  Kirchplatz  ", "", "DE")).toBe("Kirchplatz");
  });
});

describe("normalizePostalCode", () => {
  it("keeps a code that fits its country's format, in display form", () => {
    expect(normalizePostalCode("00153", "IT")).toBe("00153");
    expect(normalizePostalCode("3474 mc", "NL")).toBe("3474 MC");
    expect(normalizePostalCode("02118", "US")).toBe("02118");
    expect(normalizePostalCode("02118-4513", "US")).toBe("02118-4513");
    expect(normalizePostalCode("SW1A 1AA", "GB")).toBe("SW1A 1AA");
    expect(normalizePostalCode("00-950", "PL")).toBe("00-950");
    expect(normalizePostalCode("110 00", "CZ")).toBe("110 00");
    expect(normalizePostalCode("1000-001", "PT")).toBe("1000-001");
    expect(normalizePostalCode("K1A 0B1", "CA")).toBe("K1A 0B1");
    expect(normalizePostalCode("D02 X285", "IE")).toBe("D02 X285");
    expect(normalizePostalCode("C1425BHE", "AR")).toBe("C1425BHE");
  });

  it("drops a value that does not fit — it is never repaired", () => {
    expect(normalizePostalCode("Roma", "IT")).toBeUndefined();
    expect(normalizePostalCode("75001;75002", "FR")).toBeUndefined();
    expect(normalizePostalCode("1234", "DE")).toBeUndefined();
    expect(normalizePostalCode("77002", "CA")).toBeUndefined();
    expect(normalizePostalCode("", "US")).toBeUndefined();
    expect(normalizePostalCode(undefined, "US")).toBeUndefined();
  });

  it("refuses any code in a country without postal codes", () => {
    expect(countryUsesPostalCodes("UG")).toBe(false);
    expect(normalizePostalCode("256", "UG")).toBeUndefined();
    expect(countryUsesPostalCodes("IT")).toBe(true);
    // An unknown country may use them: completeness still asks for one.
    expect(countryUsesPostalCodes(undefined)).toBe(true);
  });

  it("shape-checks a country with no table entry", () => {
    expect(normalizePostalCode("12345", "XY")).toBe("12345");
    expect(normalizePostalCode("12345", undefined)).toBe("12345");
    expect(normalizePostalCode("CENTRO", undefined)).toBeUndefined(); // no digit
    expect(normalizePostalCode("123456789012345", undefined)).toBeUndefined();
  });
});

describe("countryNameFor", () => {
  it("names an ISO code in English and refuses anything else", () => {
    expect(countryNameFor("PL")).toBe("Poland");
    expect(countryNameFor("US")).toBe("United States");
    expect(countryNameFor("pl")).toBeUndefined();
    expect(countryNameFor(undefined)).toBeUndefined();
  });
});
