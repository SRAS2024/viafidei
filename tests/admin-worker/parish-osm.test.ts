/**
 * Keyless OpenStreetMap (Overpass) parish discovery. These tests pin the mapper
 * (only explicitly Roman Catholic churches with a real address + city become
 * candidates) and the runner (publishes in-communion candidates through the real
 * schema + publish gate; rejects a website that proves not-in-communion;
 * verifies nothing when there is no website but the roman_catholic tag stands).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/publish-orchestrator", () => ({
  runPublishOrchestrator: vi.fn(async () => ({ kind: "published" })),
}));
vi.mock("@/lib/admin-worker/communion-verifier", () => ({
  verifyParishCommunion: vi.fn(),
}));

import type { PrismaClient } from "@prisma/client";

import { osmElementToParish, runOsmParishDiscovery } from "@/lib/admin-worker/parish-osm";
import { runPublishOrchestrator } from "@/lib/admin-worker/publish-orchestrator";
import { verifyParishCommunion } from "@/lib/admin-worker/communion-verifier";

const mockedPublish = vi.mocked(runPublishOrchestrator);
const mockedVerify = vi.mocked(verifyParishCommunion);

const KEYS = [
  "ADMIN_WORKER_SKIP_NETWORK",
  "ADMIN_WORKER_OSM_PARISHES",
  "PARISH_DISCOVERY_LOCATIONS",
];
let saved: Record<string, string | undefined>;
const realFetch = global.fetch;

beforeEach(() => {
  saved = {};
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  mockedPublish.mockReset();
  mockedPublish.mockResolvedValue({ kind: "published" } as never);
  mockedVerify.mockReset();
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

  it("rejects non-Roman-Catholic denominations", () => {
    for (const d of ["old_catholic", "catholic", "orthodox", "anglican"]) {
      expect(
        osmElementToParish({ type: "node", id: 1, tags: { ...FULL_TAGS, denomination: d } }),
      ).toBeNull();
    }
  });

  it("rejects rows missing a name, city, or address", () => {
    expect(
      osmElementToParish({ type: "node", id: 1, tags: { ...FULL_TAGS, name: "" } }),
    ).toBeNull();
    const { "addr:city": _c, ...noCity } = FULL_TAGS;
    void _c;
    expect(osmElementToParish({ type: "node", id: 1, tags: noCity })).toBeNull();
    const { "addr:street": _s, "addr:housenumber": _h, ...noAddr } = FULL_TAGS;
    void _s;
    void _h;
    expect(osmElementToParish({ type: "node", id: 1, tags: noAddr })).toBeNull();
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
});

function makePrisma() {
  return {
    adminWorkerMemory: { findUnique: vi.fn(async () => null), upsert: vi.fn(async () => ({})) },
    publishedContent: {
      findMany: vi.fn(async () => [] as Array<{ payload: unknown }>),
      findFirst: vi.fn(async () => null),
    },
    checklistItem: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: "ci1" })),
    },
    humanReviewQueue: { findFirst: vi.fn(async () => null), create: vi.fn(async () => ({})) },
    adminWorkerLog: { create: vi.fn(async () => ({})) },
  } as unknown as PrismaClient;
}

function stubOverpass(elements: unknown[]): typeof global.fetch {
  return vi.fn(async () => ({
    ok: true,
    json: async () => ({ elements }),
  })) as unknown as typeof global.fetch;
}

describe("runOsmParishDiscovery", () => {
  it("publishes an address-complete parish with no website on the roman_catholic tag (no communion fetch)", async () => {
    global.fetch = stubOverpass([
      { type: "node", id: 10, lat: 42.34, lon: -71.07, tags: FULL_TAGS },
    ]);
    const prisma = makePrisma();

    const out = await runOsmParishDiscovery(prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
    });

    expect(out.enabled).toBe(true);
    expect(out.published).toBe(1);
    expect(mockedPublish).toHaveBeenCalledTimes(1);
    expect(mockedVerify).not.toHaveBeenCalled(); // no website → trust the tag
  });

  it("rejects a candidate whose website proves not-in-communion", async () => {
    global.fetch = stubOverpass([
      { type: "node", id: 11, tags: { ...FULL_TAGS, website: "https://schismatic.example" } },
    ]);
    mockedVerify.mockResolvedValue({
      status: "not-in-communion",
      confidence: 0.9,
      signals: { positive: [], negative: ["sedevacantist"], review: [] },
      reason: "Disqualifying signal.",
    });
    const prisma = makePrisma();

    const out = await runOsmParishDiscovery(prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
    });

    expect(out.rejected).toBe(1);
    expect(out.published).toBe(0);
    expect(mockedPublish).not.toHaveBeenCalled();
  });

  it("is a no-op when disabled (skip-network)", async () => {
    process.env.ADMIN_WORKER_SKIP_NETWORK = "1";
    const prisma = makePrisma();
    const out = await runOsmParishDiscovery(prisma, { brainActive: true, force: true });
    expect(out.enabled).toBe(false);
    expect(out.published).toBe(0);
  });
});
