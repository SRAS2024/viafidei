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
  // The OSM runner now fetches the site ONCE via inspectParishWebsite, which
  // returns both the communion verdict and best-effort contact/schedule details.
  inspectParishWebsite: vi.fn(),
}));

import type { PrismaClient } from "@prisma/client";

import { osmElementToParish, runOsmParishDiscovery } from "@/lib/admin-worker/parish-osm";
import { runPublishOrchestrator } from "@/lib/admin-worker/publish-orchestrator";
import { inspectParishWebsite } from "@/lib/admin-worker/communion-verifier";

const mockedPublish = vi.mocked(runPublishOrchestrator);
const mockedInspect = vi.mocked(inspectParishWebsite);

/** Build the {verdict, details} shape inspectParishWebsite returns. */
function inspectResult(
  status: "in-communion" | "not-in-communion" | "unknown",
  details: Record<string, string> = {},
) {
  return {
    verdict: {
      status,
      confidence: status === "unknown" ? 0 : 0.8,
      signals: { positive: [], negative: [], review: [] },
      reason: `${status} (test)`,
    },
    details,
  } as never;
}

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
  mockedInspect.mockReset();
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
    expect(mockedInspect).not.toHaveBeenCalled(); // no website → trust the tag
  });

  it("publishes a candidate whose website is unreadable (unknown) by trusting the OSM tag", async () => {
    // An unreadable website (blocked egress / down / non-HTML) yields "unknown".
    // That is NOT evidence against communion, so the runner must fall back to
    // OSM's denomination=roman_catholic tag and publish — otherwise nearly every
    // OSM parish with a website strands in review whenever parish-site egress is
    // unavailable, which is exactly why parishes weren't publishing.
    global.fetch = stubOverpass([
      { type: "node", id: 12, tags: { ...FULL_TAGS, website: "https://unreachable.example" } },
    ]);
    mockedInspect.mockResolvedValue(inspectResult("unknown"));
    const prisma = makePrisma();

    const out = await runOsmParishDiscovery(prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
    });

    expect(mockedInspect).toHaveBeenCalledTimes(1); // it DID try the website first
    expect(out.published).toBe(1); // …then fell back to the OSM tag and published
    expect(out.rejected).toBe(0);
    expect(mockedPublish).toHaveBeenCalledTimes(1);
  });

  it("rejects a candidate whose website proves not-in-communion", async () => {
    global.fetch = stubOverpass([
      { type: "node", id: 11, tags: { ...FULL_TAGS, website: "https://schismatic.example" } },
    ]);
    mockedInspect.mockResolvedValue(inspectResult("not-in-communion"));
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

  it("skips a candidate whose address duplicates an already-published parish", async () => {
    // No website → verdict comes from the roman_catholic tag (in-communion),
    // so the ONLY thing keeping it from publishing is the address-duplicate gate.
    global.fetch = stubOverpass([
      { type: "node", id: 13, lat: 42.34, lon: -71.07, tags: FULL_TAGS },
    ]);
    const prisma = {
      adminWorkerMemory: { findUnique: vi.fn(async () => null), upsert: vi.fn(async () => ({})) },
      publishedContent: {
        findMany: vi.fn(async () => [] as Array<{ payload: unknown }>),
        // Slug-exists check (no payload filter) → null; address-key dedup check
        // (payload path filter) → a matching already-published parish.
        findFirst: vi.fn(async (args: { where?: { payload?: unknown } }) =>
          args?.where?.payload ? { id: "dup1", slug: "existing", title: "Existing Parish" } : null,
        ),
      },
      checklistItem: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({ id: "ci1" })),
      },
      humanReviewQueue: { findFirst: vi.fn(async () => null), create: vi.fn(async () => ({})) },
      adminWorkerLog: { create: vi.fn(async () => ({})) },
    } as unknown as PrismaClient;

    const out = await runOsmParishDiscovery(prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
    });

    expect(out.published).toBe(0);
    expect(out.rejected).toBe(1);
    expect(mockedPublish).not.toHaveBeenCalled();
  });

  it("carries scraped phone / Mass / confession details into the published payload", async () => {
    global.fetch = stubOverpass([
      { type: "node", id: 14, tags: { ...FULL_TAGS, website: "https://good.example" } },
    ]);
    mockedInspect.mockResolvedValue(
      inspectResult("in-communion", {
        phone: "(555) 111-2222",
        massTimes: "Sunday 9:00 am",
        confessionTimes: "Saturday 4:00 pm",
      }),
    );
    const prisma = makePrisma();

    const out = await runOsmParishDiscovery(prisma, {
      brainActive: true,
      force: true,
      maxQueries: 1,
    });

    expect(out.published).toBe(1);
    const payload = (mockedPublish.mock.calls[0]![1] as { payload: Record<string, unknown> })
      .payload;
    expect(payload.phone).toBe("(555) 111-2222");
    expect(payload.massTimes).toBe("Sunday 9:00 am");
    expect(payload.confessionTimes).toBe("Saturday 4:00 pm");
    expect(payload.addressKey).toBeTruthy();
  });

  it("is a no-op when disabled (skip-network)", async () => {
    process.env.ADMIN_WORKER_SKIP_NETWORK = "1";
    const prisma = makePrisma();
    const out = await runOsmParishDiscovery(prisma, { brainActive: true, force: true });
    expect(out.enabled).toBe(false);
    expect(out.published).toBe(0);
  });
});
