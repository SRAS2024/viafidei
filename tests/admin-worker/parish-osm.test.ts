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
  localityFromTags,
  normalizedParishName,
  osmElementToParish,
  runOsmParishDiscovery,
} from "@/lib/admin-worker/parish-osm";
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

  it("folds parish names to their distinctive words for the proximity dedup", () => {
    expect(normalizedParishName("St. Mary Catholic Church")).toBe("mary");
    expect(normalizedParishName("Parish of Saint Mary")).toBe("mary");
    expect(normalizedParishName("Parroquia de San José")).toBe("jose");
    expect(normalizedParishName("Catholic Church")).toBe("");
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
        return rows.filter((r) => {
          if (!r.isPublished) return false;
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

  it("fills the city from ONE bounded Nominatim reverse lookup (city|town|village|municipality only)", async () => {
    const { "addr:city": _c, "addr:street": _s, "addr:housenumber": _h, ...bare } = FULL_TAGS;
    void _c;
    void _s;
    void _h;
    const calls: string[] = [];
    global.fetch = vi.fn(async (url: string) => {
      calls.push(String(url));
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
    expect(calls.filter((u) => u.includes("nominatim"))).toHaveLength(1);
    expect(calls.find((u) => u.includes("nominatim"))).toMatch(/zoom=10/);
    expect(publishedPayload().city).toBe("Brookline");
    expect(mockedPublish.mock.calls[0]![1].slug).toBe("cathedral-of-the-holy-cross-brookline");
    // The lookup was charged to the persisted daily budget row.
    const budgetKey = [...store.keys()].find((k) => k.startsWith("osm-budget:"))!;
    expect((store.get(budgetKey)!.memoryValue as { reverseUsed: number }).reverseUsed).toBe(1);
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
    expect(mockedProtect).toHaveBeenCalledTimes(1);
    const input = mockedProtect.mock.calls[0]![1];
    expect(input.contentId).toBe("row1");
    expect(input.proposedPayload.phone).toBe("+1 617 555 0100");
    expect(input.proposedPayload.latitude).toBe(42.34);
    // Enrich only: existing values are never replaced.
    expect(input.allowReplace).toBeUndefined();
    expect(input.proposedPayload.address).toBe("1400 Washington Street");
  });

  it("skips a candidate whose address duplicates an already-published parish", async () => {
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
          addressKey: "1400 washington st boston ma",
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

  it("is a no-op when disabled (skip-network)", async () => {
    process.env.ADMIN_WORKER_SKIP_NETWORK = "1";
    const { prisma } = makePrisma();
    const out = await runOsmParishDiscovery(prisma, { brainActive: true, force: true });
    expect(out.enabled).toBe(false);
    expect(out.published).toBe(0);
  });
});
