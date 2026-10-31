/**
 * The Nominatim lookup-by-OSM-id client: 50 ids per request, one shared
 * spaced slot held until each request settles (spacing measured from the
 * moment a request goes out), a persisted daily budget charged inside it to
 * the day the request goes out, a
 * persisted 15-minute cooldown after a 429 / 403 / 5xx, idle under
 * skip-network — and a mapper that invents nothing (a county is not a
 * locality, a postal code must fit its country). Fixture: real answers for
 * street-less published parishes (tests/fixtures/nominatim-lookup-sample.json).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@prisma/client";

import {
  lookupOsmPlaces,
  nominatimAddressParts,
  nominatimBudgetRemaining,
  nominatimCooldownUntil,
  osmLookupId,
  withNominatimSlot,
  type NominatimPlace,
} from "@/lib/admin-worker/nominatim-lookup";

const SAMPLE = JSON.parse(
  readFileSync(join(process.cwd(), "tests/fixtures/nominatim-lookup-sample.json"), "utf8"),
) as Array<Record<string, unknown>>;

function makePrisma() {
  const store = new Map<string, { memoryValue: unknown; lastUsedAt: Date }>();
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
          update: { memoryValue: unknown };
        }) => {
          store.set(where.memoryType_memoryKey.memoryKey, {
            memoryValue: update.memoryValue,
            lastUsedAt: new Date(),
          });
          return {};
        },
      ),
    },
  } as unknown as PrismaClient;
  return { prisma, store };
}

/** Answers with the fixture entries whose ids were asked for. */
function fixtureFetch(extra: Array<Record<string, unknown>> = []) {
  return vi.fn(async (url: string) => {
    const ids = new URL(url).searchParams.get("osm_ids")!.split(",");
    const all = [...SAMPLE, ...extra];
    const body = all.filter((p) =>
      ids.includes(`${String(p.osm_type)[0]!.toUpperCase()}${String(p.osm_id)}`),
    );
    return { ok: true, status: 200, json: async () => body };
  });
}

function refOf(p: Record<string, unknown>): string {
  return `osm:${String(p.osm_type)}/${String(p.osm_id)}`;
}

function place(osmType: string, osmId: number): NominatimPlace {
  const raw = SAMPLE.find((p) => p.osm_type === osmType && p.osm_id === osmId)!;
  return {
    osmType: osmType as NominatimPlace["osmType"],
    osmId,
    sourceRef: refOf(raw),
    category: String(raw.category),
    type: String(raw.type),
    name: String(raw.name),
    address: raw.address as Record<string, string>,
    extratags: (raw.extratags ?? {}) as Record<string, string>,
  };
}

const KEYS = [
  "ADMIN_WORKER_SKIP_NETWORK",
  "ADMIN_WORKER_NOMINATIM_SPACING_MS",
  "ADMIN_WORKER_NOMINATIM_DAILY_BUDGET",
];
let saved: Record<string, string | undefined>;
beforeEach(() => {
  saved = {};
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  process.env.ADMIN_WORKER_NOMINATIM_SPACING_MS = "0";
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("osmLookupId", () => {
  it("maps a parish sourceRef to a lookup id and refuses anything else", () => {
    expect(osmLookupId("osm:way/315087672")).toBe("W315087672");
    expect(osmLookupId("osm:node/9645844302")).toBe("N9645844302");
    expect(osmLookupId("osm:relation/5563719")).toBe("R5563719");
    expect(osmLookupId("ChIJ-places-id")).toBeNull();
    expect(osmLookupId(null)).toBeNull();
  });
});

describe("lookupOsmPlaces", () => {
  it("asks for up to 50 ids per request with the identifying User-Agent", async () => {
    const { prisma, store } = makePrisma();
    const refs = Array.from({ length: 120 }, (_, i) => `osm:node/${1000 + i}`);
    const fetchImpl = fixtureFetch();

    const res = await lookupOsmPlaces(prisma, refs, { fetchImpl: fetchImpl as never });

    expect(res.requests).toBe(3);
    const urls = fetchImpl.mock.calls.map((c) => new URL(String(c[0])));
    expect(urls.map((u) => u.searchParams.get("osm_ids")!.split(",").length)).toEqual([50, 50, 20]);
    expect(urls[0]!.origin + urls[0]!.pathname).toBe("https://nominatim.openstreetmap.org/lookup");
    expect(urls[0]!.searchParams.get("format")).toBe("jsonv2");
    expect(urls[0]!.searchParams.get("addressdetails")).toBe("1");
    expect(urls[0]!.searchParams.get("extratags")).toBe("1");
    const init = fetchImpl.mock.calls[0]![1] as unknown as { headers: Record<string, string> };
    expect(init.headers["User-Agent"]).toMatch(/^ViaFideiAdminWorker\/1\.0 /);
    // Every request is charged to the persisted daily budget.
    const budget = [...store.entries()].find(([k]) => k.startsWith("nominatim-lookup:"))!;
    expect((budget[1].memoryValue as { used: number }).used).toBe(3);
    expect(res.notReturned).toHaveLength(120);
  });

  it("returns the answered objects by sourceRef and reports the ones it no longer knows", async () => {
    const { prisma } = makePrisma();
    const known = SAMPLE.slice(0, 3).map(refOf);
    const res = await lookupOsmPlaces(prisma, [...known, "osm:way/1", "not-osm"], {
      fetchImpl: fixtureFetch() as never,
    });
    expect([...res.places.keys()]).toEqual(known);
    expect(res.notReturned).toEqual(["osm:way/1"]);
    expect(res.unresolved).toEqual([]);
    expect(res.places.get(known[0]!)!.address.road).toBe("Rue de l'Église");
  });

  it("stops before any request once the daily budget is spent", async () => {
    process.env.ADMIN_WORKER_NOMINATIM_DAILY_BUDGET = "2";
    const { prisma, store } = makePrisma();
    const today = new Date().toISOString().slice(0, 10);
    store.set(`nominatim-lookup:${today}`, { memoryValue: { used: 2 }, lastUsedAt: new Date() });
    const fetchImpl = fixtureFetch();

    const res = await lookupOsmPlaces(prisma, ["osm:node/1"], { fetchImpl: fetchImpl as never });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(res.stopReason).toBe("budget");
    expect(res.unresolved).toEqual(["osm:node/1"]);
    expect(await nominatimBudgetRemaining(prisma)).toBe(0);
  });

  it("cools down for 15 minutes on a 429, persisted for every later caller", async () => {
    const { prisma } = makePrisma();
    const now = Date.now();
    const refused = vi.fn(async () => ({ ok: false, status: 429, json: async () => [] }));

    const first = await lookupOsmPlaces(prisma, ["osm:node/1", "osm:node/2"], {
      fetchImpl: refused as never,
      now: () => now,
    });
    expect(first.stopReason).toBe("refused");
    expect(first.unresolved).toEqual(["osm:node/1", "osm:node/2"]);
    const until = await nominatimCooldownUntil(prisma, now);
    expect(until).toBe(now + 15 * 60 * 1000);

    const later = fixtureFetch();
    const second = await lookupOsmPlaces(prisma, ["osm:node/1"], {
      fetchImpl: later as never,
      now: () => now + 60_000,
    });
    expect(second.stopReason).toBe("cooldown");
    expect(later).not.toHaveBeenCalled();
    // …and asks again once the cooldown is over.
    const after = await lookupOsmPlaces(prisma, ["osm:node/1"], {
      fetchImpl: later as never,
      now: () => now + 16 * 60 * 1000,
    });
    expect(after.requests).toBe(1);
  });

  it("treats a 403 or a 5xx as a refusal too, but a malformed answer only as an error", async () => {
    for (const status of [403, 503]) {
      const { prisma } = makePrisma();
      const res = await lookupOsmPlaces(prisma, ["osm:node/1"], {
        fetchImpl: vi.fn(async () => ({ ok: false, status, json: async () => [] })) as never,
      });
      expect(res.stopReason, String(status)).toBe("refused");
      expect(await nominatimCooldownUntil(prisma)).not.toBeNull();
    }
    const { prisma } = makePrisma();
    const res = await lookupOsmPlaces(prisma, ["osm:node/1"], {
      fetchImpl: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as never,
    });
    expect(res.stopReason).toBe("error");
    expect(res.unresolved).toEqual(["osm:node/1"]);
    expect(await nominatimCooldownUntil(prisma)).toBeNull();
  });

  it("honours a per-call request cap", async () => {
    const { prisma } = makePrisma();
    const refs = Array.from({ length: 120 }, (_, i) => `osm:way/${i + 1}`);
    const res = await lookupOsmPlaces(prisma, refs, {
      fetchImpl: fixtureFetch() as never,
      maxRequests: 1,
    });
    expect(res.requests).toBe(1);
    expect(res.stopReason).toBe("request-cap");
    expect(res.unresolved).toHaveLength(70);
  });

  it("is idle under skip-network", async () => {
    process.env.ADMIN_WORKER_SKIP_NETWORK = "1";
    const { prisma } = makePrisma();
    const fetchImpl = fixtureFetch();
    const res = await lookupOsmPlaces(prisma, ["osm:node/1"], { fetchImpl: fetchImpl as never });
    expect(res.stopReason).toBe("skip-network");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("never loses a charge when two lanes look up at once", async () => {
    const { prisma, store } = makePrisma();
    await Promise.all([
      lookupOsmPlaces(prisma, ["osm:node/1"], { fetchImpl: fixtureFetch() as never }),
      lookupOsmPlaces(prisma, ["osm:node/2"], { fetchImpl: fixtureFetch() as never }),
    ]);
    const budget = [...store.entries()].find(([k]) => k.startsWith("nominatim-lookup:"))!;
    expect((budget[1].memoryValue as { used: number }).used).toBe(2);
  });

  it("charges the day the request goes out, not the day its budget was first read", async () => {
    // The budget is read at 23:59:59.960 UTC; the slot then waits ~80 ms for
    // the previous request, so the request goes out after midnight.
    process.env.ADMIN_WORKER_NOMINATIM_SPACING_MS = "80";
    const midnight = Date.UTC(2026, 10, 1);
    const started = Date.now();
    const now = () => midnight - 40 + (Date.now() - started);
    const { prisma, store } = makePrisma();
    store.set("nominatim-lookup:2026-10-31", {
      memoryValue: { used: 1500, lastCallAt: Date.now() },
      lastUsedAt: new Date(),
    });

    const res = await lookupOsmPlaces(prisma, ["osm:node/1"], {
      fetchImpl: fixtureFetch() as never,
      now,
    });

    expect(res.requests).toBe(1);
    expect(store.get("nominatim-lookup:2026-11-01")!.memoryValue).toMatchObject({ used: 1 });
    expect(store.get("nominatim-lookup:2026-10-31")!.memoryValue).toMatchObject({ used: 1500 });
  });

  it("does not send once a refusal met by another caller is on record", async () => {
    const { prisma } = makePrisma();
    const refused = vi.fn(async () => ({ ok: false, status: 429, json: async () => [] }));
    const later = fixtureFetch();
    const [first, second] = await Promise.all([
      lookupOsmPlaces(prisma, ["osm:node/1"], { fetchImpl: refused as never }),
      lookupOsmPlaces(prisma, ["osm:node/2"], { fetchImpl: later as never }),
    ]);
    expect(first.stopReason).toBe("refused");
    expect(second.stopReason).toBe("cooldown");
    expect(later).not.toHaveBeenCalled();
  });
});

describe("withNominatimSlot", () => {
  it("serialises callers and spaces their requests", async () => {
    const sent: number[] = [];
    await Promise.all(
      [0, 1, 2].map(() =>
        withNominatimSlot(40, null, async (markSent) => {
          markSent();
          sent.push(Date.now());
        }),
      ),
    );
    expect(sent).toHaveLength(3);
    expect(sent[1]! - sent[0]!).toBeGreaterThanOrEqual(35);
    expect(sent[2]! - sent[1]!).toBeGreaterThanOrEqual(35);
  });

  it("spaces from the moment a request went out, however slow the work before it", async () => {
    const sent: number[] = [];
    await Promise.all([
      withNominatimSlot(50, null, async (markSent) => {
        // e.g. a slow budget write on a busy connection pool
        await new Promise((resolve) => setTimeout(resolve, 40));
        markSent();
        sent.push(Date.now());
      }),
      withNominatimSlot(50, null, async (markSent) => {
        markSent();
        sent.push(Date.now());
      }),
    ]);
    expect(sent[1]! - sent[0]!).toBeGreaterThanOrEqual(45);
  });

  it("holds the slot until the request has settled", async () => {
    const events: string[] = [];
    await Promise.all([
      withNominatimSlot(0, null, async (markSent) => {
        markSent();
        await new Promise((resolve) => setTimeout(resolve, 20));
        events.push("first settled");
      }),
      withNominatimSlot(0, null, async () => {
        events.push("second started");
      }),
    ]);
    expect(events).toEqual(["first settled", "second started"]);
  });
});

describe("nominatimAddressParts", () => {
  it("maps a French church with only a parent street", () => {
    expect(nominatimAddressParts(place("way", 337419964))).toEqual({
      street: "Rue de l'Église",
      houseNumber: "",
      streetLine: "Rue de l'Église",
      locality: "Brunehamel",
      state: "Hauts-de-France",
      postalCode: "02360",
      countryCode: "FR",
      country: "France",
      precision: "street",
    });
  });

  it("maps Rome, New York, Mexico City, Vienna and a Dutch postcode", () => {
    expect(nominatimAddressParts(place("way", 124282254))).toMatchObject({
      streetLine: "Via del Velabro",
      locality: "Roma",
      state: "Lazio",
      postalCode: "00153",
      countryCode: "IT",
      country: "Italy",
    });
    expect(nominatimAddressParts(place("node", 357617634))).toMatchObject({
      streetLine: "249th Street",
      locality: "New York",
      state: "New York",
      postalCode: "11422",
      countryCode: "US",
    });
    expect(nominatimAddressParts(place("node", 2937976911))).toMatchObject({
      locality: "Ciudad de México",
      postalCode: "02169",
      countryCode: "MX",
    });
    expect(nominatimAddressParts(place("way", 216478859))).toMatchObject({
      streetLine: "Lorettoplatz",
      locality: "Wien",
      state: "",
      postalCode: "1210",
      countryCode: "AT",
    });
    expect(nominatimAddressParts(place("way", 278086192)).postalCode).toBe("3474 MC");
  });

  it("never takes an Irish county or municipal district as the locality", () => {
    // municipality "County Galway", region "Loughrea Municipal District".
    expect(nominatimAddressParts(place("way", 97157991))).toMatchObject({
      streetLine: "N67",
      locality: "",
      state: "",
      countryCode: "IE",
      postalCode: undefined,
    });
    // city "Ballinasloe Municipal District", municipality "County Galway".
    expect(nominatimAddressParts(place("way", 262780719)).locality).toBe("");
  });

  it("composes a house number in the country's order and calls it rooftop", () => {
    const p = place("way", 379074378);
    const withNumber = { ...p, address: { ...p.address, house_number: "3" } };
    expect(nominatimAddressParts(withNumber)).toMatchObject({
      streetLine: "Kirchplatz 3",
      locality: "Mayen",
      postalCode: "56727",
      precision: "rooftop",
    });
  });

  it("drops a postcode that does not fit the country", () => {
    const p = place("way", 124282254);
    expect(
      nominatimAddressParts({ ...p, address: { ...p.address, postcode: "00153;00186" } })
        .postalCode,
    ).toBeUndefined();
  });
});
