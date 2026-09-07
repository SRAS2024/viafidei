/**
 * Bounded Nominatim reverse lookup: only city-level fields are used (a county
 * is never a city), the per-run and daily caps are honoured, and failures
 * yield null so the caller publishes on coordinates instead of guessing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@prisma/client";

import { reverseLookupCity } from "@/lib/admin-worker/parish-geocode";
import { budgetKey } from "@/lib/admin-worker/parish-osm-overpass";

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

const KEYS = [
  "ADMIN_WORKER_SKIP_NETWORK",
  "ADMIN_WORKER_OSM_REVERSE_SPACING_MS",
  "ADMIN_WORKER_OSM_REVERSE_DAILY_BUDGET",
];
let saved: Record<string, string | undefined>;
beforeEach(() => {
  saved = {};
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  process.env.ADMIN_WORKER_OSM_REVERSE_SPACING_MS = "0";
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const ok = (address: Record<string, string>) =>
  vi.fn(async () => ({ ok: true, json: async () => ({ address }) }));

describe("reverseLookupCity", () => {
  it("returns the city/town/village/municipality and country code, charging the budget", async () => {
    const fetchImpl = ok({ village: "Ballyvourney", county: "County Cork", country_code: "ie" });
    const { prisma, store } = makePrisma();
    const budget = { remaining: 2 };

    const r = await reverseLookupCity(prisma, 51.9, -9.2, budget, {
      fetchImpl: fetchImpl as never,
    });

    expect(r).toEqual({ city: "Ballyvourney", countryCode: "IE" });
    expect(budget.remaining).toBe(1);
    expect(String(vi.mocked(fetchImpl).mock.calls[0]![0])).toMatch(/nominatim.*reverse.*zoom=10/);
    expect((store.get(budgetKey())!.memoryValue as { reverseUsed: number }).reverseUsed).toBe(1);
  });

  it("never promotes a county/state to a city", async () => {
    const fetchImpl = ok({ county: "Suffolk County", state: "Massachusetts" });
    const { prisma } = makePrisma();
    const r = await reverseLookupCity(
      prisma,
      42.3,
      -71.1,
      { remaining: 5 },
      { fetchImpl: fetchImpl as never },
    );
    expect(r.city).toBeNull();
  });

  it("stops at the per-run cap and the persisted daily cap without a request", async () => {
    const fetchImpl = ok({ city: "X" });
    const { prisma, store } = makePrisma();
    expect(
      (await reverseLookupCity(prisma, 1, 1, { remaining: 0 }, { fetchImpl: fetchImpl as never }))
        .city,
    ).toBeNull();
    process.env.ADMIN_WORKER_OSM_REVERSE_DAILY_BUDGET = "5";
    store.set(budgetKey(), { memoryValue: { reverseUsed: 5 }, lastUsedAt: new Date() });
    expect(
      (await reverseLookupCity(prisma, 1, 1, { remaining: 3 }, { fetchImpl: fetchImpl as never }))
        .city,
    ).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("is idle in skip-network mode and null on any error", async () => {
    const { prisma } = makePrisma();
    process.env.ADMIN_WORKER_SKIP_NETWORK = "1";
    const boom = vi.fn(async () => {
      throw new Error("down");
    });
    expect(
      (await reverseLookupCity(prisma, 1, 1, { remaining: 3 }, { fetchImpl: boom as never })).city,
    ).toBeNull();
    delete process.env.ADMIN_WORKER_SKIP_NETWORK;
    expect(
      (await reverseLookupCity(prisma, 1, 1, { remaining: 3 }, { fetchImpl: boom as never })).city,
    ).toBeNull();
  });
});
