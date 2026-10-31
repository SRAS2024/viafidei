/**
 * Keyless OpenStreetMap (Overpass) parish discovery — the tile sweep. Pins:
 *   - the mapper: `roman_catholic` AND `catholic` are accepted, other
 *     "catholic" bodies are not; a candidate needs a name + (locality OR
 *     coordinates); locality comes from any addr:* locality tag or `is_in`;
 *     nothing is invented (no city → no city);
 *   - the runner: publishes deterministically on the OSM tag with NO website
 *     fetch, checks the publish cap before per-candidate work and persists
 *     per-tile progress, dedups sourceRef → addressKey → nearby-same-name →
 *     slug (a collision gets a stable suffix, an unpublished row is
 *     republished), enriches a re-swept row in place, and remembers gate
 *     failures (`osm-skip`) instead of retrying them every visit.
 * All network is mocked (global.fetch).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/publish-orchestrator", () => ({
  runPublishOrchestrator: vi.fn(async () => ({ kind: "published" })),
}));
vi.mock("@/lib/admin-worker/communion-verifier", () => ({
  inspectParishWebsite: vi.fn(),
}));
vi.mock("@/lib/admin-worker/content-protection", () => ({
  applyProtectedContentUpdate: vi.fn(async () => ({ applied: true, kind: "enrich" })),
}));
vi.mock(import("@/lib/admin-worker/content-goals"), async (importOriginal) => ({
  ...(await importOriginal()),
  refreshContentGoals: vi.fn(async () => ({}) as never),
}));
vi.mock("@/lib/admin-worker/repair", () => ({
  flagSearchRefresh: vi.fn(async () => ({})),
  flagSitemapRefresh: vi.fn(async () => ({})),
  flagCacheRefresh: vi.fn(async () => ({})),
}));
vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

import type { PrismaClient } from "@prisma/client";

import {
  applyLookupToCandidate,
  localityFromTags,
  machineParishSummary,
  normalizedParishName,
  osmElementToParish,
  osmParishSummary,
  parishExclusionFor,
  processOsmCandidate,
  runOsmParishDiscovery,
} from "@/lib/admin-worker/parish-osm";
import type { NominatimPlace } from "@/lib/admin-worker/nominatim-lookup";
import { runPublishOrchestrator } from "@/lib/admin-worker/publish-orchestrator";
import { inspectParishWebsite } from "@/lib/admin-worker/communion-verifier";
import { applyProtectedContentUpdate } from "@/lib/admin-worker/content-protection";

const mockedPublish = vi.mocked(runPublishOrchestrator);
const mockedInspect = vi.mocked(inspectParishWebsite);
const mockedProtect = vi.mocked(applyProtectedContentUpdate);

const KEYS = [
  "ADMIN_WORKER_SKIP_NETWORK",
  "ADMIN_WORKER_OSM_PARISHES",
  "ADMIN_WORKER_OSM_MIN_SPACING_MS",
  "ADMIN_WORKER_OSM_REVERSE_SPACING_MS",
  "ADMIN_WORKER_OSM_REVERSE_CAP",
  "ADMIN_WORKER_OSM_MAX_PUBLISH",
  "ADMIN_WORKER_NOMINATIM_SPACING_MS",
  "ADMIN_WORKER_NOMINATIM_DAILY_BUDGET",
];
let saved: Record<string, string | undefined>;
const realFetch = global.fetch;

beforeEach(() => {
  saved = {};
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  process.env.ADMIN_WORKER_OSM_MIN_SPACING_MS = "0";
  process.env.ADMIN_WORKER_OSM_REVERSE_SPACING_MS = "0";
  process.env.ADMIN_WORKER_NOMINATIM_SPACING_MS = "0";
  mockedPublish.mockReset();
  mockedPublish.mockResolvedValue({ kind: "published" } as never);
  mockedInspect.mockReset();
  mockedProtect.mockClear();
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  global.fetch = realFetch;
  vi.restoreAllMocks();
});

const FULL_TAGS = {
  name: "Cathedral of the Holy Cross",
  religion: "christian",
  denomination: "roman_catholic",
  "addr:housenumber": "1400",
  "addr:street": "Washington Street",
  "addr:city": "Boston",
  "addr:state": "MA",
  "addr:country": "US",
};

describe("osmElementToParish", () => {
  it("maps an explicitly Roman Catholic church with an address", () => {
    const p = osmElementToParish({
      type: "node",
      id: 10,
      lat: 42.34,
      lon: -71.07,
      tags: { ...FULL_TAGS, website: "https://holycrossboston.example" },
    });
    expect(p).not.toBeNull();
    expect(p!.name).toBe("Cathedral of the Holy Cross");
    expect(p!.formattedAddress).toBe("1400 Washington Street");
    expect(p!.city).toBe("Boston");
    expect(p!.website).toBe("https://holycrossboston.example");
    expect(p!.placeId).toBe("osm:node/10");
    expect(p!.mapsUri).toBe("https://www.openstreetmap.org/node/10");
    expect(p!.latitude).toBe(42.34);
    expect(p!.countryCode).toBe("US");
    expect(p!.country).toBe("United States");
    expect(p!.designation).toBe("cathedral");
    expect(p!.slugBase).toBe("cathedral-of-the-holy-cross-boston");
  });

  it("reads way/relation coordinates from center", () => {
    const p = osmElementToParish({
      type: "way",
      id: 22,
      center: { lat: 1.1, lon: 2.2 },
      tags: FULL_TAGS,
    });
    expect(p!.latitude).toBe(1.1);
    expect(p!.longitude).toBe(2.2);
    expect(p!.placeId).toBe("osm:way/22");
  });

  it("accepts denomination=catholic as well as roman_catholic, nothing else", () => {
    // `catholic` (294k objects worldwide) is the more common OSM value for a
    // Roman Catholic church; the strict old filter rejected it and capped the
    // directory at a fraction of the real supply. Distinct bodies stay out.
    expect(
      osmElementToParish({ type: "node", id: 1, tags: { ...FULL_TAGS, denomination: "catholic" } })
        ?.denomination,
    ).toBe("catholic");
    for (const d of [
      "old_catholic",
      "independent_catholic",
      "polish_national_catholic",
      "orthodox",
      "anglican",
      "roman_catholic_traditionalist",
      "",
    ]) {
      expect(
        osmElementToParish({ type: "node", id: 1, tags: { ...FULL_TAGS, denomination: d } }),
      ).toBeNull();
    }
  });

  it("requires a name plus either a locality tag or coordinates — never invents either", () => {
    expect(
      osmElementToParish({ type: "node", id: 1, tags: { ...FULL_TAGS, name: "" } }),
    ).toBeNull();
    const { "addr:city": _c, ...noCity } = FULL_TAGS;
    void _c;
    // No locality AND no coordinates → cannot be located → rejected.
    expect(osmElementToParish({ type: "node", id: 1, tags: noCity })).toBeNull();
    // No locality but coordinates → accepted with an EMPTY city (not guessed).
    const byCoords = osmElementToParish({
      type: "node",
      id: 1,
      lat: 42.3,
      lon: -71.1,
      tags: noCity,
    });
    expect(byCoords).not.toBeNull();
    expect(byCoords!.city).toBeUndefined();
    // A locality with no street address → accepted with an empty address.
    const { "addr:street": _s, "addr:housenumber": _h, ...noAddr } = FULL_TAGS;
    void _s;
    void _h;
    const byCity = osmElementToParish({ type: "node", id: 1, tags: noAddr });
    expect(byCity).not.toBeNull();
    expect(byCity!.formattedAddress).toBe("");
  });

  it("takes the locality from any addr:* locality tag, then is_in", () => {
    expect(localityFromTags({ "addr:place": "Ballyvourney" })).toBe("Ballyvourney");
    expect(localityFromTags({ "addr:suburb": "Bandra" })).toBe("Bandra");
    expect(localityFromTags({ "addr:village": "Sant'Anna" })).toBe("Sant'Anna");
    expect(localityFromTags({ is_in: "Kraków, Małopolskie, Poland" })).toBe("Kraków");
    // A single-part is_in is a region/country, not a city.
    expect(localityFromTags({ is_in: "Italy" })).toBe("");
    expect(localityFromTags({})).toBe("");
  });

  it("falls back to the tile country code when the element has none, and skips ruins", () => {
    const { "addr:country": _cc, ...noCountry } = FULL_TAGS;
    void _cc;
    const p = osmElementToParish({ type: "node", id: 3, tags: noCountry }, { countryCode: "IE" });
    expect(p!.countryCode).toBe("IE");
    expect(p!.country).toBe("Ireland");
    expect(
      osmElementToParish({ type: "node", id: 4, tags: { ...FULL_TAGS, ruins: "yes" } }),
    ).toBeNull();
  });

  it("drops a non-http website but still maps the parish", () => {
    const p = osmElementToParish({
      type: "node",
      id: 5,
      tags: { ...FULL_TAGS, website: "not a url" },
    });
    expect(p).not.toBeNull();
    expect(p!.website).toBeUndefined();
  });

  it("slugs a non-Latin name by its name:en, never by the locality alone", () => {
    const korean = (tags: Record<string, string>) =>
      osmElementToParish({
        type: "node",
        id: 77,
        lat: 40.76,
        lon: -73.92,
        tags: { name: "천주교 성 요셉 성당", denomination: "roman_catholic", ...tags },
      })!;
    expect(
      korean({ "name:en": "St. Joseph Korean Catholic Church", "addr:city": "New York" }).slugBase,
    ).toBe("st-joseph-korean-catholic-church-new-york");
    // No Latin name at all: the source id, not "new-york".
    expect(korean({ "addr:city": "New York" }).slugBase).toBe("parish-node-77");
    // A Latin name keeps its own slug.
    expect(
      osmElementToParish({ type: "node", id: 1, lat: 1, lon: 1, tags: FULL_TAGS })!.slugBase,
    ).toBe("cathedral-of-the-holy-cross-boston");
  });

  it("folds parish names to their distinctive words for the proximity dedup", () => {
    expect(normalizedParishName("St. Mary Catholic Church")).toBe("mary");
    expect(normalizedParishName("Parish of Saint Mary")).toBe("mary");
    expect(normalizedParishName("Parroquia de San José")).toBe("jose");
    expect(normalizedParishName("Catholic Church")).toBe("");
  });
});

describe("osmElementToParish — address mapping", () => {
  const base = { name: "St. Clemens", religion: "christian", denomination: "roman_catholic" };
  const at = (tags: Record<string, string>, fallback: { countryCode?: string } = {}) =>
    osmElementToParish({ type: "way", id: 77, center: { lat: 50.3, lon: 7.2 }, tags }, fallback);

  it("composes the street line in the country's own order", () => {
    const de = at({
      ...base,
      "addr:street": "Kirchplatz",
      "addr:housenumber": "3",
      "addr:city": "Mayen",
      "addr:country": "DE",
    });
    expect(de!.formattedAddress).toBe("Kirchplatz 3");
    // The tile fallback decides the order when there is no addr:country.
    expect(
      at({ ...base, "addr:street": "Kirchplatz", "addr:housenumber": "3" }, { countryCode: "AT" })!
        .formattedAddress,
    ).toBe("Kirchplatz 3");
    expect(
      at({ ...base, "addr:street": "Main Street", "addr:housenumber": "7", "addr:country": "US" })!
        .formattedAddress,
    ).toBe("7 Main Street");
  });

  it("uses addr:place as the street of a place-addressed house, and never a bare number", () => {
    expect(
      at({ ...base, "addr:place": "Lhota", "addr:housenumber": "12", "addr:country": "CZ" })!
        .formattedAddress,
    ).toBe("Lhota 12");
    // addr:place with no number is a locality, not a street line.
    const placeOnly = at({ ...base, "addr:place": "Lhota", "addr:country": "CZ" })!;
    expect(placeOnly.formattedAddress).toBe("");
    expect(placeOnly.city).toBe("Lhota");
    expect(at({ ...base, "addr:housenumber": "12", "addr:country": "CZ" })!.formattedAddress).toBe(
      "",
    );
  });

  it("keeps a postcode that fits the country and drops one that does not", () => {
    expect(at({ ...base, "addr:postcode": "56727", "addr:country": "DE" })!.postcode).toBe("56727");
    expect(
      at({ ...base, "addr:postcode": "Mayen", "addr:country": "DE" })!.postcode,
    ).toBeUndefined();
    expect(at({ ...base, "addr:postcode": "3474 mc" }, { countryCode: "NL" })!.postcode).toBe(
      "3474 MC",
    );
  });

  it("gives a scheme-less website https:// when it parses, and drops what does not", () => {
    expect(at({ ...base, website: "www.pfarrei-mayen.de" })!.website).toBe(
      "https://www.pfarrei-mayen.de",
    );
    expect(at({ ...base, "contact:website": "stclemens.org/messen" })!.website).toBe(
      "https://stclemens.org/messen",
    );
    expect(at({ ...base, website: "not a url" })!.website).toBeUndefined();
    expect(at({ ...base, website: "localhost" })!.website).toBeUndefined();
    expect(at({ ...base, website: "mailto:x@example.org" })!.website).toBeUndefined();
    expect(at({ ...base, website: "ftp://files.example.org" })!.website).toBeUndefined();
  });

  it("records whether the country came from a tag or the tile fallback", () => {
    expect(at({ ...base, "addr:country": "DE" }, { countryCode: "NL" })!.countrySource).toBe("tag");
    expect(at(base, { countryCode: "NL" })!.countrySource).toBe("tile");
    expect(at(base)!.countrySource).toBeUndefined();
  });

  it("designates chapels by tag or a clear name, never by a place name", () => {
    expect(at({ ...base, building: "chapel" })!.designation).toBe("chapel");
    expect(at({ ...base, place_of_worship: "chapel" })!.designation).toBe("chapel");
    expect(at({ ...base, name: "Marienkapelle" })!.designation).toBe("chapel");
    expect(at({ ...base, name: "Onze-Lieve-Vrouwekapel" })!.designation).toBe("chapel");
    expect(at({ ...base, name: "Chapelle Notre-Dame-de-Pitié" })!.designation).toBe("chapel");
    expect(at({ ...base, name: "Kaplica św. Anny" })!.designation).toBe("chapel");
    expect(at({ ...base, name: "Sint-Niklaaskerk Kapelle-op-den-Bos" })!.designation).toBe(
      "parish",
    );
    expect(at({ ...base, name: "Grote of Sint-Laurenskerk" })!.designation).toBe("parish");
    // A basilica / cathedral / shrine keeps its own designation.
    expect(at({ ...base, name: "Basilique Notre-Dame", building: "chapel" })!.designation).toBe(
      "minor-basilica",
    );
  });
});

describe("parishExclusionFor — not a parish", () => {
  const base = { religion: "christian", denomination: "roman_catholic" };

  it("excludes wayside shrines, wayside crosses, crosses and grottoes by tag", () => {
    expect(parishExclusionFor("Bildstock", { place_of_worship: "wayside_shrine" })).toEqual({
      reason: "wayside-shrine",
      evidence: "place_of_worship=wayside_shrine",
    });
    expect(parishExclusionFor("Feldkapelle", { place_of_worship: "wayside_chapel" })?.reason).toBe(
      "wayside-chapel",
    );
    expect(parishExclusionFor("Wegkreuz", { historic: "wayside_cross" })?.reason).toBe(
      "wayside-cross",
    );
    expect(parishExclusionFor("Marterl", { historic: "wayside_shrine" })?.reason).toBe(
      "wayside-shrine",
    );
    expect(parishExclusionFor("Gipfelkreuz", { man_made: "cross" })?.reason).toBe("cross");
    expect(parishExclusionFor("Grotte", { place_of_worship: "lourdes_grotto" })?.reason).toBe(
      "lourdes-grotto",
    );
  });

  it("excludes only strictly numbered Stations of the Cross by name", () => {
    for (const name of [
      "2e Statie",
      "14e Statie",
      "1ste Statie",
      "3de Statie",
      "Statie I",
      "Statie XIV",
      "Kreuzwegstation V",
      "Die dritte Schmerz Mariens",
      "Der siebte Schmerz Mariens",
    ]) {
      expect(parishExclusionFor(name)?.reason, name).toBe("stations-of-the-cross");
    }
    for (const name of [
      "Grote of Sint-Laurenskerk",
      "Statiekerk",
      "Kreuzwegkapelle",
      "Kapelle der Schmerzhaften Mutter",
      "St. Statius",
    ]) {
      expect(parishExclusionFor(name), name).toBeNull();
    }
    // A prototype key is not a tag value.
    expect(parishExclusionFor("St. Mary", { place_of_worship: "constructor" })).toBeNull();
  });

  it("keeps an excluded element out of the candidates entirely", () => {
    const el = (tags: Record<string, string>) =>
      osmElementToParish({ type: "node", id: 5, lat: 52.3, lon: 4.69, tags: { ...base, ...tags } });
    expect(el({ name: "2e Statie" })).toBeNull();
    expect(el({ name: "Statie XIV" })).toBeNull();
    expect(el({ name: "Mariabeeld", place_of_worship: "wayside_shrine" })).toBeNull();
    expect(el({ name: "Grote of Sint-Laurenskerk" })).not.toBeNull();
  });
});

describe("the published summary sentence", () => {
  it("names the designation and the place, and nothing more", () => {
    expect(
      osmParishSummary({
        name: "Kapelle St. Georg",
        designation: "chapel",
        denomination: "roman_catholic",
        city: "Obersaxen-Mundaun",
        country: "Switzerland",
      }),
    ).toBe(
      "Kapelle St. Georg is a Roman Catholic chapel in Obersaxen-Mundaun, Switzerland, listed in OpenStreetMap as a Catholic place of worship.",
    );
    expect(osmParishSummary({ name: "X", designation: "minor-basilica" })).toBe(
      "X is a Catholic minor basilica, listed in OpenStreetMap as a Catholic place of worship.",
    );
  });

  it("recognises both machine forms for the row's own title — and nothing a person wrote", () => {
    const old =
      'Eglise Saint-Leon is a Catholic parish in Paris, France, listed in OpenStreetMap as a Catholic place of worship (denomination "catholic").';
    expect(machineParishSummary(old, "Eglise Saint-Leon")).toEqual({ denomination: "catholic" });
    const current = osmParishSummary({
      name: "St. Mary",
      designation: "parish",
      denomination: "roman_catholic",
    });
    expect(machineParishSummary(current, "St. Mary")).toEqual({ denomination: "roman_catholic" });
    expect(machineParishSummary(current, "St. Joseph")).toBeNull();
    expect(machineParishSummary("A beloved parish founded in 1890.", "St. Mary")).toBeNull();
    expect(machineParishSummary(undefined, "St. Mary")).toBeNull();
  });
});

describe("applyLookupToCandidate", () => {
  const NOW = Date.UTC(2026, 9, 31);
  const rome: NominatimPlace = {
    osmType: "way",
    osmId: 124282254,
    sourceRef: "osm:way/124282254",
    category: "amenity",
    type: "place_of_worship",
    name: "Chiesa di Sant'Eligio dei Ferrari",
    address: {
      road: "Via del Velabro",
      city: "Roma",
      state: "Lazio",
      postcode: "00153",
      country: "Italia",
      country_code: "it",
    },
    extratags: { building: "church" },
  };
  const candidate = (tags: Record<string, string>, fallback: { countryCode?: string } = {}) =>
    osmElementToParish(
      {
        type: "way",
        id: 124282254,
        center: { lat: 41.8899, lon: 12.4824 },
        tags: { name: "Sant'Eligio dei Ferrari", denomination: "catholic", ...tags },
      },
      fallback,
    )!;

  it("fills a new candidate's blank street, locality, state and postcode", () => {
    const c = candidate({}, { countryCode: "IT" });
    applyLookupToCandidate(c, rome, NOW);
    expect(c.formattedAddress).toBe("Via del Velabro");
    expect(c.city).toBe("Roma");
    expect(c.state).toBe("Lazio");
    expect(c.postcode).toBe("00153");
    expect(c.slugBase).toBe("sant-eligio-dei-ferrari-roma");
    expect(c.addressLookup).toEqual({ returned: true, used: true, precision: "street", at: NOW });
  });

  it("never replaces what the element's own tags say", () => {
    const c = candidate(
      { "addr:street": "Via Petroselli", "addr:city": "Rome" },
      { countryCode: "IT" },
    );
    applyLookupToCandidate(c, rome, NOW);
    expect(c.formattedAddress).toBe("Via Petroselli");
    expect(c.city).toBe("Rome");
  });

  it("replaces a tile-fallback country with Nominatim's, never an addr:country tag", () => {
    const tile = candidate({}, { countryCode: "TN" }); // a Tunisia tile over Italy
    applyLookupToCandidate(tile, rome, NOW);
    expect(tile.countryCode).toBe("IT");
    expect(tile.country).toBe("Italy");
    expect(tile.countrySource).toBe("nominatim");

    const tagged = candidate({ "addr:country": "VA" }, { countryCode: "IT" });
    applyLookupToCandidate(tagged, rome, NOW);
    expect(tagged.countryCode).toBe("VA");
    // A different country's address parts are not mixed in.
    expect(tagged.formattedAddress).toBe("");
    expect(tagged.postcode).toBeUndefined();
  });

  it("composes the tagged street line and checks the tagged postcode again in Nominatim's country", () => {
    const element = (tags: Record<string, string>) => ({
      type: "node",
      id: 41,
      lat: 29.7522,
      lon: -95.3592,
      tags: { name: "St. Joseph", denomination: "roman_catholic", ...tags },
    });
    const answer = (address: Record<string, string>): NominatimPlace => ({
      ...rome,
      osmType: "node",
      osmId: 41,
      sourceRef: "osm:node/41",
      address,
    });
    // A Houston church on a Mexican tile was composed street-first.
    const houston = osmElementToParish(
      element({
        "addr:street": "Main Street",
        "addr:housenumber": "1505",
        "addr:postcode": "77002",
      }),
      { countryCode: "MX" },
    )!;
    expect(houston.formattedAddress).toBe("Main Street 1505");
    applyLookupToCandidate(
      houston,
      answer({ road: "Main Street", city: "Houston", state: "Texas", country_code: "us" }),
      NOW,
    );
    expect(houston).toMatchObject({
      formattedAddress: "1505 Main Street",
      countryCode: "US",
      country: "United States",
      postcode: "77002",
    });

    // A Montréal church on a US tile: its own postcode fits only once the
    // country is right (Nominatim offers none here).
    const montreal = osmElementToParish(
      element({
        "addr:street": "Rue Saint-Denis",
        "addr:housenumber": "1255",
        "addr:postcode": "H2X 3J6",
      }),
      { countryCode: "US" },
    )!;
    expect(montreal.postcode).toBeUndefined();
    applyLookupToCandidate(
      montreal,
      answer({ road: "Rue Saint-Denis", city: "Montréal", country_code: "ca" }),
      NOW,
    );
    expect(montreal).toMatchObject({
      formattedAddress: "1255 Rue Saint-Denis",
      postcode: "H2X 3J6",
    });

    // addr:full is the mapper's own line and stays as written.
    const full = osmElementToParish(element({ "addr:full": "Main Street 1505, Houston" }), {
      countryCode: "MX",
    })!;
    applyLookupToCandidate(full, answer({ road: "Main Street", country_code: "us" }), NOW);
    expect(full.formattedAddress).toBe("Main Street 1505, Houston");
  });

  it("keeps the name:en slug when the lookup fills a Latin locality for a non-Latin name", () => {
    const korean = (tags: Record<string, string>) =>
      osmElementToParish({
        type: "node",
        id: 77,
        lat: 40.76,
        lon: -73.92,
        tags: { name: "천주교 성 요셉 성당", denomination: "roman_catholic", ...tags },
      })!;
    const newYork: NominatimPlace = {
      ...rome,
      osmType: "node",
      osmId: 77,
      sourceRef: "osm:node/77",
      address: { road: "Northern Boulevard", city: "New York", country_code: "us" },
    };
    const named = korean({ "name:en": "St. Joseph Korean Catholic Church" });
    expect(named.slugBase).toBe("st-joseph-korean-catholic-church");
    applyLookupToCandidate(named, newYork, NOW);
    expect(named.city).toBe("New York");
    expect(named.slugBase).toBe("st-joseph-korean-catholic-church-new-york");

    const unnamed = korean({});
    applyLookupToCandidate(unnamed, newYork, NOW);
    expect(unnamed.slugBase).toBe("parish-node-77");
  });

  it("records an object Nominatim no longer returns", () => {
    const c = candidate({}, { countryCode: "IT" });
    applyLookupToCandidate(c, null, NOW);
    expect(c.addressLookup).toEqual({
      returned: false,
      used: false,
      precision: "locality",
      at: NOW,
    });
    expect(c.formattedAddress).toBe("");
  });
});

/** A prisma stub with a real memory store (tiles, budget, skips live there). */
function makePrisma(opts: { rows?: Array<Record<string, unknown>> } = {}) {
  const store = new Map<string, { memoryValue: unknown; lastUsedAt: Date }>();
  const rows = opts.rows ?? [];
  const prisma = {
    adminWorkerMemory: {
      findUnique: vi.fn(
        async ({ where }: { where: { memoryType_memoryKey: { memoryKey: string } } }) => {
          const v = store.get(where.memoryType_memoryKey.memoryKey);
          return v ? { memoryValue: v.memoryValue, lastUsedAt: v.lastUsedAt } : null;
        },
      ),
      findMany: vi.fn(async ({ where }: { where: { memoryKey: { in: string[] } } }) =>
        where.memoryKey.in
          .filter((k) => store.has(k))
          .map((k) => ({ memoryKey: k, memoryValue: store.get(k)!.memoryValue })),
      ),
      upsert: vi.fn(
        async ({
          where,
          update,
        }: {
          where: { memoryType_memoryKey: { memoryKey: string } };
          update: { memoryValue?: unknown };
        }) => {
          const key = where.memoryType_memoryKey.memoryKey;
          store.set(key, {
            memoryValue: update.memoryValue ?? store.get(key)?.memoryValue ?? {},
            lastUsedAt: new Date(),
          });
          return {};
        },
      ),
    },
    publishedContent: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        return (
          rows.find((r) => {
            if (where.id !== undefined && r.id !== where.id) return false;
            if (where.sourceRef !== undefined && r.sourceRef !== where.sourceRef) return false;
            if (where.addressKey !== undefined && r.addressKey !== where.addressKey) return false;
            if (where.slug !== undefined && r.slug !== where.slug) return false;
            if (where.isPublished !== undefined && r.isPublished !== where.isPublished)
              return false;
            return true;
          }) ?? null
        );
      }),
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const lat = where.latitude as { gte: number; lte: number } | undefined;
        const lon = where.longitude as { gte: number; lte: number } | undefined;
        const sourceIn = (where.sourceRef as { in?: string[] } | undefined)?.in;
        return rows.filter((r) => {
          if (!r.isPublished) return false;
          if (where.addressKey !== undefined && r.addressKey !== where.addressKey) return false;
          if (sourceIn && !sourceIn.includes(String(r.sourceRef))) return false;
          if (
            lat &&
            !(typeof r.latitude === "number" && r.latitude >= lat.gte && r.latitude <= lat.lte)
          )
            return false;
          if (
            lon &&
            !(typeof r.longitude === "number" && r.longitude >= lon.gte && r.longitude <= lon.lte)
          )
            return false;
          return true;
        });
      }),
    },
    checklistItem: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: "ci1" })),
    },
    humanReviewQueue: { findFirst: vi.fn(async () => null), create: vi.fn(async () => ({})) },
    adminWorkerLog: { create: vi.fn(async () => ({})) },
  } as unknown as PrismaClient;
  return { prisma, store };
}

function stubOverpass(elements: unknown[]): typeof global.fetch {
  return vi.fn(async () => ({
    ok: true,
    headers: { get: () => "application/json" },
    json: async () => ({ elements }),
  })) as unknown as typeof global.fetch;
}

function publishedPayload(i = 0): Record<string, unknown> {
  return (mockedPublish.mock.calls[i]![1] as { payload: Record<string, unknown> }).payload;
}

describe("runOsmParishDiscovery", () => {
  it("publishes on the OSM tag with NO website fetch, even when the element has a website", async () => {
    global.fetch = stubOverpass([
      {
        type: "node",
        id: 10,
        lat: 42.34,
        lon: -71.07,
        tags: { ...FULL_TAGS, website: "https://holycross.example", phone: "+1 617 555 0100" },
      },
    ]);
    const { prisma } = makePrisma();

    const out = await runOsmParishDiscovery(prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
    });

    expect(out.enabled).toBe(true);
    expect(out.published).toBe(1);
    expect(out.tilesSwept).toBe(1);
    expect(mockedPublish).toHaveBeenCalledTimes(1);
    // The website is recorded for the verification lane, never fetched here.
    expect(mockedInspect).not.toHaveBeenCalled();
    const payload = publishedPayload();
    expect(payload.website).toBe("https://holycross.example");
    expect(payload.phone).toBe("+1 617 555 0100");
    expect(payload.sourceRef).toBe("osm:node/10");
    expect(payload.addressKey).toBeTruthy();
    expect(payload.country).toBe("United States");
    expect(payload.countryCode).toBe("US");
    // Deterministic lane: no brain screens, side effects batched per run.
    const input = mockedPublish.mock.calls[0]![1] as {
      skipBrainScreens?: boolean;
      skipPostPublishSideEffects?: boolean;
    };
    expect(input.skipBrainScreens).toBe(true);
    expect(input.skipPostPublishSideEffects).toBe(true);
  });

  it("publishes a coordinate-only element with an empty city when the reverse lookup is capped", async () => {
    process.env.ADMIN_WORKER_OSM_REVERSE_CAP = "0";
    const { "addr:city": _c, "addr:street": _s, "addr:housenumber": _h, ...bare } = FULL_TAGS;
    void _c;
    void _s;
    void _h;
    global.fetch = stubOverpass([{ type: "node", id: 20, lat: 42.3, lon: -71.1, tags: bare }]);
    const { prisma } = makePrisma();

    const out = await runOsmParishDiscovery(prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
    });

    expect(out.published).toBe(1);
    const payload = publishedPayload();
    expect(payload.city).toBeUndefined();
    expect(payload.address).toBeUndefined();
    expect(payload.latitude).toBe(42.3);
    expect(payload.longitude).toBe(-71.1);
    // The summary states only what the source says.
    expect(String(payload.summary)).not.toMatch(/ in ,/);
  });

  it("fills the city from ONE bounded Nominatim reverse lookup when the id lookup cannot answer", async () => {
    const { "addr:city": _c, "addr:street": _s, "addr:housenumber": _h, ...bare } = FULL_TAGS;
    void _c;
    void _s;
    void _h;
    const calls: string[] = [];
    global.fetch = vi.fn(async (url: string) => {
      calls.push(String(url));
      // The lookup-by-id is refused today; the reverse lookup still answers.
      if (String(url).includes("nominatim") && String(url).includes("/lookup")) {
        return { ok: false, status: 404, json: async () => ({}) };
      }
      if (String(url).includes("nominatim")) {
        return {
          ok: true,
          json: async () => ({
            address: { county: "Suffolk County", town: "Brookline", country_code: "us" },
          }),
        };
      }
      return {
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({
          elements: [{ type: "node", id: 21, lat: 42.33, lon: -71.12, tags: bare }],
        }),
      };
    }) as unknown as typeof global.fetch;
    const { prisma, store } = makePrisma();

    const out = await runOsmParishDiscovery(prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
    });

    expect(out.published).toBe(1);
    expect(calls.filter((u) => u.includes("nominatim") && u.includes("/reverse"))).toHaveLength(1);
    expect(calls.find((u) => u.includes("/reverse"))).toMatch(/zoom=10/);
    expect(publishedPayload().city).toBe("Brookline");
    expect(mockedPublish.mock.calls[0]![1].slug).toBe("cathedral-of-the-holy-cross-brookline");
    // The lookup was charged to the persisted daily budget row.
    const budgetKey = [...store.keys()].find((k) => k.startsWith("osm-budget:"))!;
    expect((store.get(budgetKey)!.memoryValue as { reverseUsed: number }).reverseUsed).toBe(1);
  });

  it("composes the street line again when the reverse lookup replaces the tile country", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ address: { city: "Houston", country_code: "us" } }),
    })) as unknown as typeof global.fetch;
    const candidate = osmElementToParish(
      {
        type: "node",
        id: 41,
        lat: 29.7522,
        lon: -95.3592,
        tags: {
          name: "St. Joseph",
          denomination: "roman_catholic",
          "addr:street": "Main Street",
          "addr:housenumber": "1505",
          "addr:postcode": "77002",
        },
      },
      { countryCode: "MX" },
    )!;
    const { prisma } = makePrisma();

    const outcome = await processOsmCandidate(prisma, candidate, {
      brainActive: true,
      reverse: { remaining: 1 },
    });

    expect(outcome).toBe("published");
    expect(publishedPayload()).toMatchObject({
      address: "1505 Main Street",
      city: "Houston",
      postalCode: "77002",
      countryCode: "US",
      country: "United States",
    });
  });

  it("keeps the name:en slug when the reverse lookup supplies the city", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ address: { city: "New York", country_code: "us" } }),
    })) as unknown as typeof global.fetch;
    const candidate = osmElementToParish({
      type: "node",
      id: 77,
      lat: 40.76,
      lon: -73.92,
      tags: {
        name: "천주교 성 요셉 성당",
        "name:en": "St. Joseph Korean Catholic Church",
        denomination: "roman_catholic",
      },
    })!;
    const { prisma } = makePrisma();

    await processOsmCandidate(prisma, candidate, { brainActive: true, reverse: { remaining: 1 } });

    expect(mockedPublish.mock.calls[0]![1].slug).toBe("st-joseph-korean-catholic-church-new-york");
  });

  it("enriches a re-swept parish in place (sourceRef match) instead of publishing a duplicate", async () => {
    global.fetch = stubOverpass([
      {
        type: "node",
        id: 10,
        lat: 42.34,
        lon: -71.07,
        tags: { ...FULL_TAGS, phone: "+1 617 555 0100" },
      },
    ]);
    const { prisma } = makePrisma({
      rows: [
        {
          id: "row1",
          slug: "cathedral-of-the-holy-cross-boston",
          title: "Cathedral of the Holy Cross",
          isPublished: true,
          sourceRef: "osm:node/10",
          payload: {
            slug: "cathedral-of-the-holy-cross-boston",
            title: "Cathedral of the Holy Cross",
            address: "1400 Washington Street",
            city: "Boston",
            citations: ["https://www.openstreetmap.org/node/10"],
          },
        },
      ],
    });

    const out = await runOsmParishDiscovery(prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
    });

    expect(out.published).toBe(0);
    expect(out.updated).toBe(1);
    expect(mockedPublish).not.toHaveBeenCalled();
    // A known parish spends no Nominatim lookup: the research lane keeps it.
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(out.addressLookups).toBe(0);
    expect(mockedProtect).toHaveBeenCalledTimes(1);
    const input = mockedProtect.mock.calls[0]![1];
    expect(input.contentId).toBe("row1");
    expect(input.proposedPayload.phone).toBe("+1 617 555 0100");
    expect(input.proposedPayload.latitude).toBe(42.34);
    // Enrich only: existing values are never replaced.
    expect(input.allowReplace).toBeUndefined();
    expect(input.proposedPayload.address).toBe("1400 Washington Street");
  });

  it("skips a candidate at the same address within 250 m of an already-published parish", async () => {
    global.fetch = stubOverpass([
      { type: "node", id: 13, lat: 42.34, lon: -71.07, tags: FULL_TAGS },
    ]);
    const { prisma } = makePrisma({
      rows: [
        {
          id: "dup1",
          slug: "existing",
          title: "Existing Parish",
          isPublished: true,
          sourceRef: "osm:node/999",
          addressKey: "1400 st washington boston ma",
          latitude: 42.3405,
          longitude: -71.0702,
          payload: {},
        },
      ],
    });

    const out = await runOsmParishDiscovery(prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
    });

    expect(out.published).toBe(0);
    expect(out.duplicates).toBe(1);
    expect(mockedPublish).not.toHaveBeenCalled();
  });

  it("publishes a parish that shares an address key with one 3 km away", async () => {
    global.fetch = stubOverpass([
      { type: "node", id: 13, lat: 42.34, lon: -71.07, tags: FULL_TAGS },
    ]);
    const { prisma } = makePrisma({
      rows: [
        {
          id: "far1",
          slug: "existing",
          title: "Existing Parish",
          isPublished: true,
          sourceRef: "osm:node/999",
          addressKey: "1400 st washington boston ma",
          latitude: 42.367,
          longitude: -71.07,
          payload: {},
        },
      ],
    });

    const out = await runOsmParishDiscovery(prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
    });

    expect(out.published).toBe(1);
    expect(out.duplicates).toBe(0);
  });

  it("publishes every street-less church in a city — a city is no address (the Rome case)", async () => {
    // Before the street rule each of these keyed as "roma" and all but the
    // first were dropped as duplicates.
    const elements = [1, 2, 3].map((i) => ({
      type: "node",
      id: 700 + i,
      lat: 41.89 + i / 100,
      lon: 12.48,
      tags: {
        name: `Chiesa di San Nome ${i}`,
        religion: "christian",
        denomination: "catholic",
        "addr:city": "Roma",
      },
    }));
    global.fetch = stubOverpass(elements);
    const { prisma } = makePrisma({
      rows: [
        {
          id: "first",
          slug: "san-pietro-roma",
          title: "San Pietro",
          isPublished: true,
          sourceRef: "osm:node/1",
          addressKey: "roma",
          latitude: 41.9022,
          longitude: 12.4539,
          payload: {},
        },
      ],
    });

    const out = await runOsmParishDiscovery(prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
    });

    expect(out.published).toBe(3);
    expect(out.duplicates).toBe(0);
    for (let i = 0; i < 3; i++) expect(publishedPayload(i).addressKey).toBeUndefined();
  });

  it("treats a same-named parish within ~200 m as the same place (no addressKey needed)", async () => {
    const { "addr:street": _s, "addr:housenumber": _h, ...noAddr } = FULL_TAGS;
    void _s;
    void _h;
    global.fetch = stubOverpass([
      {
        type: "node",
        id: 14,
        lat: 42.3401,
        lon: -71.0702,
        tags: { ...noAddr, name: "Holy Cross Cathedral" },
      },
    ]);
    const { prisma } = makePrisma({
      rows: [
        {
          id: "near1",
          slug: "cathedral-of-the-holy-cross-boston",
          title: "Cathedral of the Holy Cross",
          isPublished: true,
          sourceRef: null,
          latitude: 42.34,
          longitude: -71.07,
          payload: {
            slug: "cathedral-of-the-holy-cross-boston",
            title: "Cathedral of the Holy Cross",
            city: "Boston",
            address: "1400 Washington St",
            latitude: 42.34,
            longitude: -71.07,
            citations: ["https://maps.example/place"],
          },
        },
      ],
    });

    const out = await runOsmParishDiscovery(prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
    });

    expect(out.published).toBe(0);
    expect(out.duplicates).toBe(1);
    // …and the existing row learns its OSM identity for next time.
    expect(mockedProtect).toHaveBeenCalledTimes(1);
    expect(mockedProtect.mock.calls[0]![1].proposedPayload.sourceRef).toBe("osm:node/14");
  });

  it("gives a DIFFERENT parish with a colliding slug a stable suffix instead of skipping it", async () => {
    global.fetch = stubOverpass([
      {
        type: "node",
        id: 5678,
        lat: 41.9,
        lon: -87.7,
        tags: {
          ...FULL_TAGS,
          name: "St. Mary",
          "addr:street": "Oak St",
          "addr:housenumber": "9",
          "addr:city": "Chicago",
          "addr:postcode": "60614",
        },
      },
    ]);
    const { prisma } = makePrisma({
      rows: [
        {
          id: "other",
          slug: "st-mary-chicago",
          title: "St. Mary",
          isPublished: true,
          sourceRef: "osm:node/1",
          addressKey: "1 elm st chicago",
          latitude: 41.8,
          longitude: -87.6,
          payload: {},
        },
      ],
    });

    const out = await runOsmParishDiscovery(prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
    });

    expect(out.published).toBe(1);
    expect(mockedPublish.mock.calls[0]![1].slug).toBe("st-mary-chicago-60614");
  });

  it("falls back to the OSM id when the postcode suffix is taken too (a third same-named chapel)", async () => {
    // Barangay chapels repeat a dedication within one municipality and ZIP:
    // the postcode suffix is not unique, the OSM id is.
    const chapel = (id: number) => ({
      type: "node",
      id,
      lat: 14.08,
      lon: 121.15,
      tags: {
        name: "San Isidro Labrador Chapel",
        religion: "christian",
        denomination: "roman_catholic",
        "addr:city": "Tanauan",
        "addr:postcode": "4232",
        "addr:country": "PH",
      },
    });
    const holder = (id: string, slug: string, ref: string) => ({
      id,
      slug,
      title: "San Isidro Labrador Chapel",
      isPublished: true,
      sourceRef: ref,
      latitude: 14.11,
      longitude: 121.12,
      payload: {},
    });
    const base = "san-isidro-labrador-chapel-tanauan";
    global.fetch = stubOverpass([chapel(333)]);
    const third = makePrisma({
      rows: [holder("c1", base, "osm:node/111"), holder("c2", `${base}-4232`, "osm:node/222")],
    });
    const out = await runOsmParishDiscovery(third.prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
    });
    expect(out.published).toBe(1);
    expect(out.duplicates).toBe(0);
    expect(mockedPublish.mock.calls[0]![1].slug).toBe(`${base}-333`);

    // …and to the whole typed id when even the short id suffix is held.
    mockedPublish.mockClear();
    global.fetch = stubOverpass([chapel(98761234)]);
    const fourth = makePrisma({
      rows: [
        holder("c1", base, "osm:node/111"),
        holder("c2", `${base}-4232`, "osm:node/222"),
        holder("c3", `${base}-1234`, "osm:node/551234"),
      ],
    });
    await runOsmParishDiscovery(fourth.prisma, { brainActive: true, force: true, maxQueries: 1 });
    expect(mockedPublish.mock.calls[0]![1].slug).toBe(`${base}-n98761234`);
  });

  it("republishes a row that was unpublished (rollback) instead of skipping it forever", async () => {
    global.fetch = stubOverpass([
      { type: "node", id: 10, lat: 42.34, lon: -71.07, tags: FULL_TAGS },
    ]);
    const { prisma } = makePrisma({
      rows: [
        {
          id: "rolled",
          slug: "cathedral-of-the-holy-cross-boston",
          title: "Cathedral of the Holy Cross",
          isPublished: false,
          sourceRef: "osm:node/10",
          payload: {},
        },
      ],
    });

    const out = await runOsmParishDiscovery(prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
    });

    expect(out.published).toBe(1);
    expect(mockedPublish.mock.calls[0]![1].slug).toBe("cathedral-of-the-holy-cross-boston");
  });

  it("keeps its own row down while the parish it duplicates (`_meta.dedup`) is live", async () => {
    global.fetch = stubOverpass([
      { type: "node", id: 10, lat: 42.34, lon: -71.07, tags: FULL_TAGS },
    ]);
    const deduped = {
      id: "victim",
      slug: "cathedral-of-the-holy-cross-boston",
      title: "Cathedral of the Holy Cross",
      isPublished: false,
      sourceRef: "osm:node/10",
      payload: { _meta: { dedup: { keeperId: "keeper", keeperSlug: "holy-cross" } } },
    };
    const keeper = {
      id: "keeper",
      slug: "holy-cross",
      title: "Holy Cross",
      isPublished: true,
      sourceRef: "osm:way/99",
      payload: {},
    };
    const live = makePrisma({ rows: [deduped, keeper] });
    const kept = await runOsmParishDiscovery(live.prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
    });
    expect(kept.published).toBe(0);
    expect(kept.duplicates).toBe(1);

    // Once the keeper is gone, the row may come back.
    const gone = makePrisma({ rows: [deduped, { ...keeper, isPublished: false }] });
    const back = await runOsmParishDiscovery(gone.prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
    });
    expect(back.published).toBe(1);
  });

  it("remembers a gate failure per slug (osm-skip) so the next sweep does not retry it", async () => {
    mockedPublish.mockResolvedValue({
      kind: "blocked",
      blockedBy: "quality-score",
      reason: "low",
    } as never);
    global.fetch = stubOverpass([
      { type: "node", id: 10, lat: 42.34, lon: -71.07, tags: FULL_TAGS },
    ]);
    const { prisma, store } = makePrisma();

    const first = await runOsmParishDiscovery(prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
    });
    expect(first.rejected).toBe(1);
    expect(mockedPublish).toHaveBeenCalledTimes(1);
    const skip = store.get("osm-skip:cathedral-of-the-holy-cross-boston")?.memoryValue as {
      retryAfter: number;
    };
    expect(skip.retryAfter).toBeGreaterThan(Date.now());

    // Force the same tile to be due again and re-sweep it.
    store.delete("osm-tile:m:rome");
    store.delete("osm-tile-cursor");
    const second = await runOsmParishDiscovery(prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
    });
    expect(second.skipped).toBe(1);
    expect(mockedPublish).toHaveBeenCalledTimes(1); // not retried
  });

  it("checks the publish cap BEFORE per-candidate work and persists per-tile progress to resume", async () => {
    const elements = [1, 2, 3].map((i) => ({
      type: "node",
      id: i,
      lat: 42.3 + i / 100,
      lon: -71.1,
      tags: { ...FULL_TAGS, name: `Parish ${i}` },
    }));
    global.fetch = stubOverpass(elements);
    const { prisma, store } = makePrisma();

    const first = await runOsmParishDiscovery(prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
      maxPublishPerPass: 2,
    });
    expect(first.published).toBe(2);
    expect(prisma.publishedContent.findFirst).toHaveBeenCalled();
    const tile = store.get("osm-tile:m:rome")?.memoryValue as {
      status: string;
      resumeAfter: string | null;
    };
    expect(tile.status).toBe("IN_PROGRESS");
    expect(tile.resumeAfter).toBe("node/2");

    // The next run resumes after node/2: only the third parish is processed.
    mockedPublish.mockClear();
    const second = await runOsmParishDiscovery(prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
      maxPublishPerPass: 2,
    });
    expect(second.published).toBe(1);
    expect(mockedPublish.mock.calls[0]![1].slug).toBe("parish-3-boston");
    const done = store.get("osm-tile:m:rome")?.memoryValue as { status: string; nextDueAt: number };
    expect(done.status).toBe("SWEPT");
    expect(done.nextDueAt).toBeGreaterThan(Date.now());
  });

  it("marks a tile that hits the element cap DENSE_SPLIT and queues its quarters", async () => {
    process.env.ADMIN_WORKER_OSM_MAX_PUBLISH = "500";
    const elements = Array.from({ length: 500 }, (_, i) => ({
      type: "node",
      id: 1000 + i,
      lat: 41.8 + i / 10000,
      lon: 12.4,
      tags: { ...FULL_TAGS, name: `Parrocchia ${i}`, "addr:city": "Roma" },
    }));
    global.fetch = stubOverpass(elements);
    const { prisma, store } = makePrisma();

    const out = await runOsmParishDiscovery(prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
    });

    expect(out.published).toBe(500);
    const tile = store.get("osm-tile:m:rome")?.memoryValue as { status: string };
    expect(tile.status).toBe("DENSE_SPLIT");
    const queue = store.get("osm-tile-queue")?.memoryValue as { items: Array<{ id: string }> };
    expect(queue.items).toHaveLength(4);
    expect(
      queue.items.every((q) => q.id.startsWith("t:0.105:") || q.id.startsWith("t:0.155:")),
    ).toBe(true);
  });

  it("marks a tile FAILED (with backoff) when every mirror fails, never empty", async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 504,
      headers: { get: () => "" },
    })) as never;
    const { prisma, store } = makePrisma();

    const out = await runOsmParishDiscovery(prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
    });

    expect(out.published).toBe(0);
    expect(out.queriesRun).toBe(2); // primary + one failover, then stop
    const tile = store.get("osm-tile:m:rome")?.memoryValue as {
      status: string;
      failures: number;
      lastError: string;
    };
    expect(tile.status).toBe("FAILED");
    expect(tile.failures).toBe(1);
    expect(tile.lastError).toMatch(/504/);
  });

  it("stops for the day once the persisted Overpass budget is spent", async () => {
    global.fetch = stubOverpass([]);
    const { prisma, store } = makePrisma();
    const today = new Date().toISOString().slice(0, 10);
    store.set(`osm-budget:${today}`, { memoryValue: { used: 600 }, lastUsedAt: new Date() });

    const out = await runOsmParishDiscovery(prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
    });

    expect(out.budgetExhausted).toBe(true);
    expect(out.queriesRun).toBe(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("claims the tile durably (IN_PROGRESS + active) BEFORE the Overpass query so a killed run resumes it", async () => {
    const { prisma, store } = makePrisma();
    let seenDuringQuery: { status?: string } | undefined;
    let activeDuringQuery: { ids?: string[] } | undefined;
    global.fetch = vi.fn(async () => {
      seenDuringQuery = store.get("osm-tile:m:rome")?.memoryValue as { status?: string };
      activeDuringQuery = store.get("osm-tile-active")?.memoryValue as { ids?: string[] };
      return {
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({ elements: [] }),
      };
    }) as unknown as typeof global.fetch;

    await runOsmParishDiscovery(prisma, { brainActive: true, force: true, maxQueries: 1 });

    expect(seenDuringQuery?.status).toBe("IN_PROGRESS");
    expect(activeDuringQuery?.ids).toEqual(["m:rome"]);
    // A completed sweep releases the claim.
    expect((store.get("osm-tile:m:rome")?.memoryValue as { status: string }).status).toBe("SWEPT");
    expect((store.get("osm-tile-active")?.memoryValue as { ids: string[] }).ids).toEqual([]);
  });

  it("parks a tile FAILED after repeated runs died inside it without progress", async () => {
    global.fetch = stubOverpass([]);
    const { prisma, store } = makePrisma();
    // Simulate a run that died mid-query three times: IN_PROGRESS, no
    // resumeAfter, failures already at the limit.
    store.set("osm-tile:m:rome", {
      memoryValue: {
        status: "IN_PROGRESS",
        elementCount: 0,
        accepted: 0,
        published: 0,
        lastSweptAt: null,
        nextDueAt: null,
        resumeAfter: null,
        failures: 3,
        lastError: null,
        bbox: [41.79, 12.34, 42.0, 12.65],
        country: "Rome",
        deg: 0.31,
      },
      lastUsedAt: new Date(),
    });
    store.set("osm-tile-active", { memoryValue: { ids: ["m:rome"] }, lastUsedAt: new Date() });

    const out = await runOsmParishDiscovery(prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
    });

    expect(out.queriesRun).toBe(0); // parked without spending a query
    const tile = store.get("osm-tile:m:rome")?.memoryValue as {
      status: string;
      failures: number;
      nextDueAt: number;
      lastError: string;
    };
    expect(tile.status).toBe("FAILED");
    expect(tile.failures).toBe(4);
    expect(tile.nextDueAt).toBeGreaterThan(Date.now());
    expect(tile.lastError).toMatch(/died repeatedly/);
    expect((store.get("osm-tile-active")?.memoryValue as { ids: string[] }).ids).toEqual([]);
  });

  it("recognises a remembered gate failure by sourceRef BEFORE spending a reverse lookup", async () => {
    const { "addr:city": _c, "addr:street": _s, "addr:housenumber": _h, ...bare } = FULL_TAGS;
    void _c;
    void _s;
    void _h;
    const calls: string[] = [];
    global.fetch = vi.fn(async (url: string) => {
      calls.push(String(url));
      if (String(url).includes("nominatim")) {
        return { ok: true, json: async () => ({ address: { town: "Brookline" } }) };
      }
      return {
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({
          elements: [{ type: "node", id: 21, lat: 42.33, lon: -71.12, tags: bare }],
        }),
      };
    }) as unknown as typeof global.fetch;
    const { prisma, store } = makePrisma();
    store.set("osm-skip:osm:node/21", {
      memoryValue: { retryAfter: Date.now() + 60_000, reason: "blocked" },
      lastUsedAt: new Date(),
    });

    const out = await runOsmParishDiscovery(prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
    });

    expect(out.skipped).toBe(1);
    expect(mockedPublish).not.toHaveBeenCalled();
    expect(calls.some((u) => u.includes("nominatim"))).toBe(false);
  });

  it("records a gate failure under the sourceRef as well as the slug", async () => {
    mockedPublish.mockResolvedValue({ kind: "blocked", blockedBy: "safety", reason: "x" } as never);
    global.fetch = stubOverpass([
      { type: "node", id: 10, lat: 42.34, lon: -71.07, tags: FULL_TAGS },
    ]);
    const { prisma, store } = makePrisma();
    await runOsmParishDiscovery(prisma, { brainActive: true, force: true, maxQueries: 1 });
    expect(store.has("osm-skip:cathedral-of-the-holy-cross-boston")).toBe(true);
    expect(store.has("osm-skip:osm:node/10")).toBe(true);
  });

  it("is a no-op when disabled (skip-network)", async () => {
    process.env.ADMIN_WORKER_SKIP_NETWORK = "1";
    const { prisma } = makePrisma();
    const out = await runOsmParishDiscovery(prisma, { brainActive: true, force: true });
    expect(out.enabled).toBe(false);
    expect(out.published).toBe(0);
  });
});

describe("runOsmParishDiscovery — Nominatim lookup for new candidates", () => {
  const ELIGIO = {
    type: "node",
    id: 30,
    lat: 41.8899,
    lon: 12.4824,
    tags: {
      name: "Chiesa di Sant'Eligio dei Ferrari",
      religion: "christian",
      denomination: "catholic",
    },
  };
  const ANSWER = {
    osm_type: "node",
    osm_id: 30,
    category: "amenity",
    type: "place_of_worship",
    name: "Chiesa di Sant'Eligio dei Ferrari",
    address: {
      road: "Via del Velabro",
      city: "Roma",
      state: "Lazio",
      postcode: "00153",
      country: "Italia",
      country_code: "it",
    },
    extratags: { building: "church", denomination: "catholic" },
  };

  function overpassAndNominatim(answer: unknown[], elements: unknown[] = [ELIGIO]) {
    const calls: string[] = [];
    global.fetch = vi.fn(async (url: string) => {
      calls.push(String(url));
      if (String(url).includes("nominatim.openstreetmap.org/lookup")) {
        return { ok: true, status: 200, json: async () => answer };
      }
      if (String(url).includes("nominatim")) {
        return { ok: true, json: async () => ({ address: {} }) };
      }
      return {
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({ elements }),
      };
    }) as unknown as typeof global.fetch;
    return calls;
  }

  it("fills a street-less candidate from one batched lookup before it is published", async () => {
    const calls = overpassAndNominatim([ANSWER]);
    const { prisma } = makePrisma();

    const out = await runOsmParishDiscovery(prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
    });

    expect(out.published).toBe(1);
    expect(out.addressLookups).toBe(1);
    const lookup = calls.find((u) => u.includes("/lookup"))!;
    expect(new URL(lookup).searchParams.get("osm_ids")).toBe("N30");
    // The id lookup answered for this very object: no reverse lookup as well.
    expect(calls.some((u) => u.includes("/reverse"))).toBe(false);

    const payload = publishedPayload();
    expect(payload).toMatchObject({
      address: "Via del Velabro",
      city: "Roma",
      state: "Lazio",
      postalCode: "00153",
      countryCode: "IT",
      country: "Italy",
      addressKey: "del velabro via 00153 lazio",
    });
    expect(mockedPublish.mock.calls[0]![1].slug).toBe("chiesa-di-sant-eligio-dei-ferrari-roma");
    expect(String(payload.summary)).toBe(
      "Chiesa di Sant'Eligio dei Ferrari is a Catholic parish in Roma, Italy, listed in OpenStreetMap as a Catholic place of worship.",
    );
    const meta = (payload._meta as { addressResearch: Record<string, unknown> }).addressResearch;
    expect(meta).toMatchObject({
      status: "complete",
      missing: [],
      precision: "street",
      sources: ["osm", "nominatim"],
      attempts: 1,
    });
  });

  it("dedups on the address the lookup supplied", async () => {
    // With a house number the key names one building: the same key within
    // 250 m is the same church, whatever it is called.
    overpassAndNominatim([{ ...ANSWER, address: { ...ANSWER.address, house_number: "9" } }]);
    const { prisma } = makePrisma({
      rows: [
        {
          id: "known",
          slug: "sant-eligio",
          title: "Sant'Eligio",
          isPublished: true,
          sourceRef: "osm:way/124282254",
          addressKey: "9 del velabro via 00153 lazio",
          latitude: 41.89,
          longitude: 12.4825,
          payload: {},
        },
      ],
    });

    const out = await runOsmParishDiscovery(prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
    });

    expect(out.duplicates).toBe(1);
    expect(mockedPublish).not.toHaveBeenCalled();
  });

  it("publishes a parish church 90 m from a chapel on the same square — a street is no building", async () => {
    // Nominatim answers with the square and no house number, so both churches
    // share the key "kirchplatz 82496 bayern"; their names differ.
    const pfarrkirche = {
      type: "way",
      id: 20,
      center: { lat: 47.5701, lon: 11.0002 },
      tags: { name: "Pfarrkirche St. Georg", religion: "christian", denomination: "catholic" },
    };
    overpassAndNominatim(
      [
        {
          osm_type: "way",
          osm_id: 20,
          category: "amenity",
          type: "place_of_worship",
          name: "Pfarrkirche St. Georg",
          address: {
            road: "Kirchplatz",
            village: "Oberau",
            state: "Bayern",
            postcode: "82496",
            country: "Deutschland",
            country_code: "de",
          },
          extratags: { building: "church" },
        },
      ],
      [pfarrkirche],
    );
    const { prisma } = makePrisma({
      rows: [
        {
          id: "chapel",
          slug: "friedhofskapelle-st-michael-oberau",
          title: "Friedhofskapelle St. Michael",
          isPublished: true,
          sourceRef: "osm:node/10",
          addressKey: "kirchplatz 82496 bayern",
          latitude: 47.5709,
          longitude: 11.0002,
          payload: {},
        },
      ],
    });

    const out = await runOsmParishDiscovery(prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
    });

    expect(out.duplicates).toBe(0);
    expect(out.published).toBe(1);
    expect(publishedPayload()).toMatchObject({
      title: "Pfarrkirche St. Georg",
      address: "Kirchplatz",
      addressKey: "kirchplatz 82496 bayern",
    });
  });

  it("records a candidate Nominatim no longer returns, and publishes it anyway", async () => {
    overpassAndNominatim([]);
    const { prisma } = makePrisma();

    const out = await runOsmParishDiscovery(prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
    });

    expect(out.published).toBe(1);
    const meta = (publishedPayload()._meta as { addressResearch: Record<string, unknown> })
      .addressResearch;
    expect(meta.status).toBe("needs_research");
  });

  it("publishes as before, unresearched, when the lookup budget is spent", async () => {
    process.env.ADMIN_WORKER_NOMINATIM_DAILY_BUDGET = "1";
    const calls = overpassAndNominatim([ANSWER]);
    const { prisma, store } = makePrisma();
    const today = new Date().toISOString().slice(0, 10);
    store.set(`nominatim-lookup:${today}`, { memoryValue: { used: 1 }, lastUsedAt: new Date() });

    const out = await runOsmParishDiscovery(prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
    });

    expect(out.published).toBe(1);
    expect(out.addressLookups).toBe(0);
    expect(calls.some((u) => u.includes("/lookup"))).toBe(false);
    // No research state: the research lane picks it up first.
    expect(publishedPayload()._meta).toBeUndefined();
    expect(publishedPayload().address).toBeUndefined();
  });
});
