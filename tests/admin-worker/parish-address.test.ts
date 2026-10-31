/**
 * Address-based parish duplicate detection. Pins the street rule that fixed
 * the city-only key (measured 2026-10-31: 127 rows keyed "rome" with one
 * published, 943 parishes unpublished with no recorded reason):
 *   - no key without a street line that keeps a Latin letter — a city, a
 *     state, a bare house number or a non-Latin street never key on their own;
 *   - Latin letters NFKD cannot decompose are transliterated (ß → ss, ł → l,
 *     ø → o …) instead of deleted, and Straße / Str. fold to one token;
 *   - the postal code (else the locality) and the state complete the key;
 *   - a key match is a duplicate only within 250 m, or — when either row has
 *     no coordinates — with the same distinctive name.
 */
import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@prisma/client";

import {
  DUPLICATE_RADIUS_M,
  findDuplicateParish,
  findNearbySameNameParish,
  foldToAsciiLatin,
  haversineMeters,
  normalizedParishName,
  parishAddressKey,
  parishAddressKeyForPayload,
  parishDuplicateRule,
} from "@/lib/admin-worker/parish-address";

describe("parishAddressKey", () => {
  it("collapses abbreviation + accent + punctuation differences to one key", () => {
    const a = parishAddressKey({ address: "123 Main Street", city: "St. Louis", state: "MO" });
    const b = parishAddressKey({ address: "123 Main St.", city: "Saint Louis", state: "mo" });
    expect(a).toBe(b);
    expect(a).toContain("123 main st");
  });

  it("distinguishes genuinely different addresses", () => {
    const a = parishAddressKey({ address: "123 Main St", city: "Boston" });
    const b = parishAddressKey({ address: "456 Main St", city: "Boston" });
    expect(a).not.toBe(b);
  });

  it("returns an empty key when there is nothing to fingerprint", () => {
    expect(parishAddressKey({})).toBe("");
    expect(parishAddressKey({ address: "   " })).toBe("");
  });

  it("never keys a parish on its city or state alone (the Rome case)", () => {
    // Every street-less church in Rome used to key as "rome" and be dropped as
    // a duplicate of the first one published.
    expect(parishAddressKey({ city: "Rome" })).toBe("");
    expect(parishAddressKey({ address: "", city: "Roma", state: "Lazio" })).toBe("");
    expect(parishAddressKey({ state: "Mazowieckie" })).toBe("");
    expect(parishAddressKey({ city: "Milano", postalCode: "20123" })).toBe("");
  });

  it("never keys a bare house number or a non-Latin street that folds to digits", () => {
    expect(parishAddressKey({ address: "22", city: "Kyiv" })).toBe("");
    // Cyrillic, Greek and Hangul streets keep only their numbers after folding.
    expect(parishAddressKey({ address: "вулиця Хрещатик 22", city: "Київ" })).toBe("");
    expect(parishAddressKey({ address: "Οδός Ερμού 22", city: "Αθήνα" })).toBe("");
    expect(parishAddressKey({ address: "명동길 74", city: "서울" })).toBe("");
  });

  it("transliterates Latin letters NFKD leaves whole instead of deleting them", () => {
    expect(foldToAsciiLatin("Hörsteler Straße")).toBe("horsteler strasse");
    expect(foldToAsciiLatin("ul. Długa")).toBe("ul dluga");
    expect(foldToAsciiLatin("Søndergade")).toBe("sondergade");
    expect(foldToAsciiLatin("Þingholtsstræti")).toBe("thingholtsstraeti");
    expect(foldToAsciiLatin("Đakovo")).toBe("dakovo");
    expect(foldToAsciiLatin("Œuvre")).toBe("oeuvre");
    expect(foldToAsciiLatin("Kırıkkale")).toBe("kirikkale");

    const key = parishAddressKey({ address: "Hörsteler Straße 5", postalCode: "48431" });
    expect(key).toBe("5 horsteler str 48431");
    expect(key).not.toContain("stra e");
  });

  it("folds Straße / Str. (and compound -straße) to one token and ignores word order", () => {
    const longForm = parishAddressKey({ address: "Hörsteler Straße 5", city: "Rheine" });
    const shortForm = parishAddressKey({ address: "Hörsteler Str. 5", city: "Rheine" });
    expect(longForm).toBe(shortForm);
    // Old rows composed number-first; new rows street-first. Same address.
    expect(parishAddressKey({ address: "12 Hauptstraße", city: "Mayen" })).toBe(
      parishAddressKey({ address: "Hauptstr. 12", city: "Mayen" }),
    );
    expect(parishAddressKey({ address: "Kerkstraat 3", city: "Roden" })).toBe(
      parishAddressKey({ address: "Kerkstr. 3", city: "Roden" }),
    );
  });

  it("uses the postal code when present (else the locality) plus the state", () => {
    const withPostcode = parishAddressKey({
      address: "Via del Velabro",
      city: "Roma",
      state: "Lazio",
      postalCode: "00153",
    });
    expect(withPostcode).toBe("del velabro via 00153 lazio");
    expect(parishAddressKey({ address: "Via del Velabro", city: "Roma", state: "Lazio" })).toBe(
      "del velabro via roma lazio",
    );
    // A spaced postal code keys the same as an unspaced one.
    expect(parishAddressKey({ address: "Meije 1", postalCode: "3474 MC" })).toBe(
      parishAddressKey({ address: "Meije 1", postalCode: "3474MC" }),
    );
    // Two different postal codes are two different places.
    expect(parishAddressKey({ address: "Rue de l'Église", postalCode: "02360" })).not.toBe(
      parishAddressKey({ address: "Rue de l'Église", postalCode: "57920" }),
    );
  });

  it("reads the stored payload fields", () => {
    expect(
      parishAddressKeyForPayload({
        address: "1400 Washington Street",
        city: "Boston",
        state: "MA",
        postalCode: "02118",
        country: "United States",
      }),
    ).toBe("1400 st washington 02118 ma");
    expect(parishAddressKeyForPayload({ city: "Rome", addressKey: "rome" })).toBe("");
  });
});

describe("parishDuplicateRule", () => {
  const rome = { latitude: 41.8902, longitude: 12.4922 };

  it("needs the two rows within 250 m when both have coordinates", () => {
    const near = { latitude: 41.8912, longitude: 12.4922 }; // ~111 m north
    const far = { latitude: 41.9029, longitude: 12.4534 }; // ~3.5 km
    expect(haversineMeters(rome, near)).toBeLessThan(DUPLICATE_RADIUS_M);
    expect(parishDuplicateRule({ name: "A", ...rome }, { name: "B", ...near })).toEqual({
      rule: "address-key+within-250m",
      distanceM: 111,
    });
    expect(parishDuplicateRule({ name: "A", ...rome }, { name: "A", ...far })).toBeNull();
  });

  it("falls back to the distinctive name when either row has no coordinates", () => {
    expect(
      parishDuplicateRule(
        { name: "St. Mary Catholic Church" },
        { name: "Parish of Saint Mary", ...rome },
      ),
    ).toEqual({ rule: "address-key+same-name", distanceM: null });
    expect(parishDuplicateRule({ name: "St. Mary" }, { name: "St. Joseph", ...rome })).toBeNull();
    // Nothing distinctive left ("Catholic Church") is never a name match.
    expect(
      parishDuplicateRule({ name: "Catholic Church" }, { name: "Catholic Church" }),
    ).toBeNull();
  });

  it("folds names with the same transliteration as the key", () => {
    expect(normalizedParishName("Herz-Jesu-Kirche")).toBe("herz jesu");
    // ś and ł no longer vanish: "Kościół" is the stop word "kosciol".
    expect(normalizedParishName("Kościół św. Floriana")).toBe("floriana");
  });
});

type Row = {
  id: string;
  slug: string;
  title: string;
  latitude: number | null;
  longitude: number | null;
};

function prismaWith(rows: Row[]) {
  const findMany = vi.fn(async (_args: { where: Record<string, unknown> }) => rows);
  return { prisma: { publishedContent: { findMany } } as unknown as PrismaClient, findMany };
}

describe("findDuplicateParish", () => {
  it("returns null (and never queries) for an empty key", async () => {
    const { prisma, findMany } = prismaWith([]);
    expect(
      await findDuplicateParish(prisma, {
        addressKey: "",
        name: "St Anne",
        latitude: 1,
        longitude: 1,
      }),
    ).toBeNull();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("probes the indexed addressKey column for live rows, honouring beforeId / excludeId", async () => {
    const { prisma, findMany } = prismaWith([]);
    await findDuplicateParish(
      prisma,
      { addressKey: "123 main st boston", name: "St Mary" },
      { beforeId: "z9", excludeId: "z5" },
    );
    const where = findMany.mock.calls[0]![0].where;
    expect(where.isPublished).toBe(true);
    expect(where.addressKey).toBe("123 main st boston");
    expect(where.payload).toBeUndefined();
    expect(where.id).toEqual({ lt: "z9", not: "z5" });
  });

  it("treats a same-key row 3 km away as a different parish", async () => {
    const { prisma } = prismaWith([
      { id: "a", slug: "san-pietro", title: "San Pietro", latitude: 41.9029, longitude: 12.4534 },
    ]);
    expect(
      await findDuplicateParish(prisma, {
        addressKey: "del velabro via 00153 lazio",
        name: "Sant'Eligio dei Ferrari",
        latitude: 41.8899,
        longitude: 12.4824,
      }),
    ).toBeNull();
  });

  it("returns the first same-key row that passes the rule", async () => {
    const { prisma } = prismaWith([
      { id: "a", slug: "far", title: "Far", latitude: 45.0, longitude: 9.0 },
      { id: "b", slug: "near", title: "Near", latitude: 41.89, longitude: 12.4825 },
    ]);
    const hit = await findDuplicateParish(prisma, {
      addressKey: "k",
      name: "Other",
      latitude: 41.8899,
      longitude: 12.4824,
    });
    expect(hit).toMatchObject({ id: "b", slug: "near", rule: "address-key+within-250m" });
  });

  it("is fail-open on a query error", async () => {
    const prisma = {
      publishedContent: { findMany: vi.fn(async () => Promise.reject(new Error("db down"))) },
    } as unknown as PrismaClient;
    expect(await findDuplicateParish(prisma, { addressKey: "k", name: "X" })).toBeNull();
  });
});

describe("findNearbySameNameParish", () => {
  it("matches the same distinctive name within 250 m inside an indexed box", async () => {
    const { prisma, findMany } = prismaWith([
      { id: "a", slug: "st-mary-x", title: "Saint Mary", latitude: 50.003, longitude: 20.0 },
      { id: "b", slug: "st-mary-y", title: "St. Mary", latitude: 50.0, longitude: 20.0005 },
    ]);
    const hit = await findNearbySameNameParish(
      prisma,
      { name: "St Mary Catholic Church", latitude: 50.0, longitude: 20.0 },
      { excludeId: "self" },
    );
    expect(hit).toMatchObject({ id: "b", rule: "same-name-within-250m" });
    const where = findMany.mock.calls[0]![0].where as Record<string, { gte: number; lte: number }>;
    expect(where.latitude!.gte).toBeLessThan(50.0);
    expect(where.longitude!.lte).toBeGreaterThan(20.0);
    expect(where.id).toEqual({ not: "self" });
  });

  it("needs coordinates and a distinctive name", async () => {
    const { prisma, findMany } = prismaWith([]);
    expect(await findNearbySameNameParish(prisma, { name: "St Mary" })).toBeNull();
    expect(
      await findNearbySameNameParish(prisma, {
        name: "Catholic Church",
        latitude: 1,
        longitude: 1,
      }),
    ).toBeNull();
    expect(findMany).not.toHaveBeenCalled();
  });
});
