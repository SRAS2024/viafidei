/**
 * Polite Overpass client: one endpoint at a time with failover (never a
 * parallel race), a persisted daily budget that charges every attempt and
 * refuses when spent, an Overpass `remark` error treated as failure (never an
 * empty tile), and the tile query shape (denomination regex, [timeout:90]).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@prisma/client";

import {
  buildTileQuery,
  budgetKey,
  overpassEndpoints,
  overpassMinSpacingMs,
  runOverpassQuery,
} from "@/lib/admin-worker/parish-osm-overpass";

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
  "ADMIN_WORKER_OSM_MIN_SPACING_MS",
  "ADMIN_WORKER_OSM_DAILY_BUDGET",
  "OVERPASS_ENDPOINTS",
];
let saved: Record<string, string | undefined>;
beforeEach(() => {
  saved = {};
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  process.env.ADMIN_WORKER_OSM_MIN_SPACING_MS = "0";
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => "application/json" },
    json: async () => body,
  };
}

describe("buildTileQuery", () => {
  it("asks for named Catholic places of worship in the bbox with a 90 s server timeout", () => {
    const q = buildTileQuery([41, 12, 42, 13], 500);
    expect(q).toContain("[timeout:90]");
    expect(q).toContain('["denomination"~"^(roman_catholic|catholic)$"]');
    expect(q).toContain('["name"](41,12,42,13)');
    expect(q).toContain("out center tags 500;");
  });

  it("spaces requests ≥ 5 s by default and lists the primary mirror first", () => {
    delete process.env.ADMIN_WORKER_OSM_MIN_SPACING_MS;
    expect(overpassMinSpacingMs()).toBe(5000);
    expect(overpassEndpoints()[0]).toBe("https://overpass-api.de/api/interpreter");
  });
});

describe("runOverpassQuery", () => {
  it("queries ONE endpoint and returns its elements without touching the mirrors", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ elements: [{ type: "node", id: 1 }] }));
    const { prisma, store } = makePrisma();

    const res = await runOverpassQuery(prisma, "q", { fetchImpl: fetchImpl as never });

    expect(res.ok).toBe(true);
    expect(res.elements).toHaveLength(1);
    expect(res.attempts).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(res.endpoint).toBe("https://overpass-api.de/api/interpreter");
    const budget = store.get(budgetKey())!.memoryValue as { used: number };
    expect(budget.used).toBe(1);
  });

  it("fails over to the next mirror on a non-2xx / Overpass runtime error, sequentially", async () => {
    const seen: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      seen.push(url);
      if (seen.length === 1) return jsonResponse({ remark: "runtime error: Query timed out" });
      return jsonResponse({ elements: [] });
    });
    const { prisma, store } = makePrisma();

    const res = await runOverpassQuery(prisma, "q", { fetchImpl: fetchImpl as never });

    expect(res.ok).toBe(true);
    expect(res.attempts).toBe(2);
    expect(seen).toEqual([
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
    ]);
    expect((store.get(budgetKey())!.memoryValue as { used: number }).used).toBe(2);
  });

  it("reports failure (never an empty success) when every tried mirror fails", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 504));
    const { prisma } = makePrisma();
    const res = await runOverpassQuery(prisma, "q", { fetchImpl: fetchImpl as never });
    expect(res.ok).toBe(false);
    expect(res.elements).toEqual([]);
    expect(res.attempts).toBe(2); // primary + one failover, bounded
    expect(res.error).toMatch(/504/);
  });

  it("refuses to query once the persisted daily budget is spent", async () => {
    process.env.ADMIN_WORKER_OSM_DAILY_BUDGET = "3";
    const fetchImpl = vi.fn(async () => jsonResponse({ elements: [] }));
    const { prisma, store } = makePrisma();
    store.set(budgetKey(), { memoryValue: { used: 3 }, lastUsedAt: new Date() });

    const res = await runOverpassQuery(prisma, "q", { fetchImpl: fetchImpl as never });

    expect(res.ok).toBe(false);
    expect(res.budgetExhausted).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
