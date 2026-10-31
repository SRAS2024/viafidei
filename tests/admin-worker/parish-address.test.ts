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
 *     no coordinates — with the same distinctive name;
 *   - distance alone decides only for a street line with a house number: two
 *     churches on one Kirchplatz or Via del Corso (Nominatim's parent street,
 *     no house number) also need the same name.
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
  streetLineHasHouseNumber,
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

describe("streetLineHasHouseNumber", () => {
  it("reads a house number where the country writes it, and in old number-first rows", () => {
    expect(streetLineHasHouseNumber("1400 Washington Street", "US")).toBe(true);
    expect(streetLineHasHouseNumber("12 Rue de l'Église", "FR")).toBe(true);
    expect(streetLineHasHouseNumber("Hauptstraße 12", "DE")).toBe(true);
    expect(streetLineHasHouseNumber("12 Hauptstraße", "DE")).toBe(true); // composed before the locale order
    expect(streetLineHasHouseNumber("Via del Corso 300", "IT")).toBe(true);
    expect(streetLineHasHouseNumber("Kirchplatz 3a", "DE")).toBe(true);
    expect(streetLineHasHouseNumber("Lhota 12", "CZ")).toBe(true);
    expect(streetLineHasHouseNumber("Calle 60 491A", "MX")).toBe(true);
    expect(streetLineHasHouseNumber("Calle 60 No. 491", "MX")).toBe(true);
    expect(streetLineHasHouseNumber("3 Maja 12", "PL")).toBe(true);
    expect(streetLineHasHouseNumber("1 Main St", null)).toBe(true);
    // After a regnal name, and a lettered number on a French avenue.
    expect(streetLineHasHouseNumber("Piazza Pio XII 12", "IT")).toBe(true);
    expect(streetLineHasHouseNumber("Jana Pawła II 5", "PL")).toBe(true);
    expect(streetLineHasHouseNumber("3a Avenue d'Emptinne", "FR")).toBe(true);
  });

  it("finds none on a bare street or square — Nominatim's parent street", () => {
    for (const [line, cc] of [
      ["Kirchplatz", "DE"],
      ["Lorettoplatz", "AT"],
      ["Via del Corso", "IT"],
      ["Rue de l'Église", "FR"],
      ["R328", "IE"],
      ["N67", "IE"],
      ["", "DE"],
    ] as const) {
      expect(streetLineHasHouseNumber(line, cc), line).toBe(false);
    }
  });

  it("finds none in a number that is part of the street's own name", () => {
    for (const [line, cc] of [
      // Numbered streets of grid cities, and roads.
      ["Calle 60", "MX"],
      ["Carrera 7", "CO"],
      ["Cra. 7", "CO"],
      ["6a Avenida", "GT"],
      ["3 Sur", "MX"],
      ["B 12", "DE"],
      ["CL 601", "ES"],
      ["Chemin n° 13", "BE"],
      ["Calle 60 x 61", "MX"],
      ["Straße 70", "DE"],
      ["Route 66", "US"],
      ["West 51st Street", "US"],
      // Dates.
      ["3 Maja", "PL"],
      ["28. října", "CZ"],
      ["Calle 5 de Mayo", "MX"],
      ["16 de Septiembre", "MX"],
      ["Via 20 Settembre", "IT"],
      ["Rue du 8 Mai 1945", "FR"],
      ["Strada 1 Decembrie 1918", "RO"],
      ["Rue du 8 Mai 1945", null],
    ] as const) {
      expect(streetLineHasHouseNumber(line, cc), line).toBe(false);
    }
  });
});

describe("parishDuplicateRule", () => {
  const rome = { latitude: 41.8902, longitude: 12.4922 };
  const building = { houseNumber: true };
  const street = { houseNumber: false };

  it("needs the two rows within 250 m when both have coordinates", () => {
    const near = { latitude: 41.8912, longitude: 12.4922 }; // ~111 m north
    const far = { latitude: 41.9029, longitude: 12.4534 }; // ~3.5 km
    expect(haversineMeters(rome, near)).toBeLessThan(DUPLICATE_RADIUS_M);
    expect(parishDuplicateRule({ name: "A", ...rome }, { name: "B", ...near }, building)).toEqual({
      rule: "address-key+within-250m",
      distanceM: 111,
    });
    expect(parishDuplicateRule({ name: "A", ...rome }, { name: "A", ...far }, building)).toBeNull();
  });

  it("also needs the same name when the shared key names only a street or square", () => {
    const near = { latitude: 41.8912, longitude: 12.4922 };
    // A parish church and the chapel on the same Kirchplatz are two places.
    expect(
      parishDuplicateRule(
        { name: "Pfarrkirche St. Georg", ...rome },
        { name: "Friedhofskapelle St. Michael", ...near },
        street,
      ),
    ).toBeNull();
    // The same church mapped twice still matches.
    expect(
      parishDuplicateRule(
        { name: "Chiesa di Sant'Eligio dei Ferrari", ...rome },
        { name: "S. Eligio dei Ferrari", ...near },
        street,
      ),
    ).toEqual({ rule: "street-key+same-name-within-250m", distanceM: 111 });
  });

  it("falls back to the distinctive name when either row has no coordinates", () => {
    for (const key of [building, street]) {
      expect(
        parishDuplicateRule(
          { name: "St. Mary Catholic Church" },
          { name: "Parish of Saint Mary", ...rome },
          key,
        ),
      ).toEqual({ rule: "address-key+same-name", distanceM: null });
      expect(
        parishDuplicateRule({ name: "St. Mary" }, { name: "St. Joseph", ...rome }, key),
      ).toBeNull();
    }
    // Nothing distinctive left ("Catholic Church") is never a name match.
    expect(
      parishDuplicateRule({ name: "Catholic Church" }, { name: "Catholic Church" }, building),
    ).toBeNull();
  });

  it("folds names with the same transliteration as the key", () => {
    expect(normalizedParishName("Herz-Jesu-Kirche")).toBe("herz jesu");
    // ś and ł no longer vanish: "Kościół" is the stop word "kosciol".
    expect(normalizedParishName("Kościół św. Floriana")).toBe("floriana");
  });

  it("folds the abbreviations one church is mapped under twice", () => {
    expect(normalizedParishName("S. Eligio dei Ferrari")).toBe("eligio ferrari");
    expect(normalizedParishName("Chiesa di Sant'Eligio dei Ferrari")).toBe("eligio ferrari");
    expect(normalizedParishName("SS. Trinità")).toBe(normalizedParishName("Santissima Trinità"));
    expect(normalizedParishName("St. Mary's")).toBe(normalizedParishName("St. Mary"));
    expect(normalizedParishName("Sint-Janskerk")).toBe(normalizedParishName("St. Janskerk"));
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
        address: "",
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
      { addressKey: "123 main st boston", address: "123 Main St", name: "St Mary" },
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
        address: "Via del Velabro",
        countryCode: "IT",
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
      addressKey: "9 del velabro via 00153 lazio",
      address: "Via del Velabro 9",
      countryCode: "IT",
      name: "Other",
      latitude: 41.8899,
      longitude: 12.4824,
    });
    expect(hit).toMatchObject({ id: "b", slug: "near", rule: "address-key+within-250m" });
  });

  it("keeps two churches 200 m apart on one street without a house number apart (Via del Corso)", async () => {
    const { prisma } = prismaWith([
      {
        id: "a",
        slug: "san-marcello-al-corso",
        title: "San Marcello al Corso",
        latitude: 41.899,
        longitude: 12.4822,
      },
    ]);
    const candidate = {
      addressKey: "corso del via 00186 lazio",
      address: "Via del Corso",
      countryCode: "IT",
      name: "Santa Maria in Via Lata",
      latitude: 41.8972,
      longitude: 12.4822,
    };
    expect(await findDuplicateParish(prisma, candidate)).toBeNull();
    // The same pair at one house number is one building.
    expect(
      await findDuplicateParish(prisma, {
        ...candidate,
        addressKey: "300 corso del via 00186 lazio",
        address: "Via del Corso 300",
      }),
    ).toMatchObject({ id: "a", rule: "address-key+within-250m", distanceM: 200 });
  });

  it("still matches the same church mapped twice on a street without a house number", async () => {
    const { prisma } = prismaWith([
      {
        id: "a",
        slug: "s-eligio",
        title: "S. Eligio dei Ferrari",
        latitude: 41.89,
        longitude: 12.4825,
      },
    ]);
    const hit = await findDuplicateParish(prisma, {
      addressKey: "del velabro via 00153 lazio",
      address: "Via del Velabro",
      countryCode: "IT",
      name: "Chiesa di Sant'Eligio dei Ferrari",
      latitude: 41.8899,
      longitude: 12.4824,
    });
    expect(hit).toMatchObject({ id: "a", rule: "street-key+same-name-within-250m" });
  });

  it("is fail-open on a query error", async () => {
    const prisma = {
      publishedContent: { findMany: vi.fn(async () => Promise.reject(new Error("db down"))) },
    } as unknown as PrismaClient;
    expect(
      await findDuplicateParish(prisma, { addressKey: "k", address: "1 Main St", name: "X" }),
    ).toBeNull();
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
