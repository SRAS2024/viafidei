/**
 * Adaptive acquisition (spec §16), change sensing (§14 "Ears") and the
 * information-gain model (§17).
 *
 * Pins: the cheapest adequate reader is planned first, an unchanged source is
 * satisfied from the durable read instead of being re-fetched, a JS-only host
 * earns the browser, learned outcomes are remembered per host, and an action
 * that would teach the project nothing scores below one that closes a real gap.
 */
import { describe, expect, it } from "vitest";

import {
  planAcquisition,
  recallHostStrategy,
  recordAcquisitionOutcome,
  METHOD_COST,
} from "@/lib/admin-worker/acquisition-planner";
import { rereadIntervalFor, senseUrl } from "@/lib/admin-worker/change-sensing";
import {
  estimateInformationGain,
  rankByInformationGain,
  MIN_WORTHWHILE_RATIO,
} from "@/lib/admin-worker/information-gain";

interface MemoryRow {
  memoryType: string;
  memoryKey: string;
  memoryValue: unknown;
}

function fakePrisma(opts: {
  reads?: Array<{
    sourceUrl: string;
    checksum: string;
    etag: string | null;
    lastModifiedHeader: string | null;
    createdAt: Date;
  }>;
  memory?: MemoryRow[];
  strategyStats?: Array<{
    dimension: string;
    method: string;
    contentType: string;
    ewma: number;
    attempts: number;
    successes: number;
  }>;
}) {
  const memory = new Map<string, MemoryRow>(
    (opts.memory ?? []).map((m) => [`${m.memoryType}|${m.memoryKey}`, m]),
  );
  return {
    memory,
    adminWorkerSourceRead: {
      findFirst: async ({ where }: { where: { sourceUrl: string } }) =>
        (opts.reads ?? []).find((r) => r.sourceUrl === where.sourceUrl) ?? null,
      findMany: async () => opts.reads ?? [],
    },
    adminWorkerMemory: {
      findUnique: async ({
        where,
      }: {
        where: { memoryType_memoryKey: { memoryType: string; memoryKey: string } };
      }) =>
        memory.get(
          `${where.memoryType_memoryKey.memoryType}|${where.memoryType_memoryKey.memoryKey}`,
        ) ?? null,
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { memoryType_memoryKey: { memoryType: string; memoryKey: string } };
        create: MemoryRow;
        update: { memoryValue?: unknown };
      }) => {
        const key = `${where.memoryType_memoryKey.memoryType}|${where.memoryType_memoryKey.memoryKey}`;
        const existing = memory.get(key);
        memory.set(key, {
          memoryType: where.memoryType_memoryKey.memoryType,
          memoryKey: where.memoryType_memoryKey.memoryKey,
          memoryValue: existing ? (update.memoryValue ?? existing.memoryValue) : create.memoryValue,
        });
        return memory.get(key)!;
      },
    },
    adminWorkerStrategyStat: {
      findMany: async () => opts.strategyStats ?? [],
      findUnique: async () => null,
      upsert: async () => ({}),
    },
  } as never;
}

describe("change sensing", () => {
  it("skips a source that was read inside its learned change interval", async () => {
    const prisma = fakePrisma({
      reads: [
        {
          sourceUrl: "https://www.vatican.va/a",
          checksum: "abc",
          etag: '"v1"',
          lastModifiedHeader: "Wed, 01 Jan 2025 00:00:00 GMT",
          createdAt: new Date(Date.now() - 60_000),
        },
      ],
    });
    const sense = await senseUrl(prisma, "https://www.vatican.va/a");
    expect(sense.shouldRead).toBe(false);
    expect(sense.knownChecksum).toBe("abc");
    expect(sense.conditionalHeaders["If-None-Match"]).toBe('"v1"');
    expect(sense.reason).toMatch(/durable source read/i);
  });

  it("re-reads once the interval has elapsed, conditionally", async () => {
    const prisma = fakePrisma({
      reads: [
        {
          sourceUrl: "https://www.vatican.va/a",
          checksum: "abc",
          etag: '"v1"',
          lastModifiedHeader: null,
          createdAt: new Date(Date.now() - 30 * 24 * 3_600_000),
        },
      ],
    });
    const sense = await senseUrl(prisma, "https://www.vatican.va/a");
    expect(sense.shouldRead).toBe(true);
    expect(sense.conditionalHeaders["If-None-Match"]).toBe('"v1"');
  });

  it("lengthens the interval for sources that never change", () => {
    const busy = rereadIntervalFor({
      changed: 8,
      unchanged: 2,
      meanChangeGapMs: null,
      lastChangedAt: null,
      updatedAt: new Date().toISOString(),
    });
    const static_ = rereadIntervalFor({
      changed: 0,
      unchanged: 40,
      meanChangeGapMs: null,
      lastChangedAt: null,
      updatedAt: new Date().toISOString(),
    });
    expect(busy).toBeLessThan(static_);
  });
});

describe("acquisition planning", () => {
  it("puts the durable read first when nothing has changed", async () => {
    const prisma = fakePrisma({
      reads: [
        {
          sourceUrl: "https://www.vatican.va/a",
          checksum: "abc",
          etag: null,
          lastModifiedHeader: null,
          createdAt: new Date(Date.now() - 60_000),
        },
      ],
    });
    const plan = await planAcquisition(prisma, { url: "https://www.vatican.va/a" });
    expect(plan.steps[0]?.method).toBe("durable-read");
    expect(plan.satisfiedByCache).toBe(true);
  });

  it("prefers cheap readers and keeps the browser as a last resort", async () => {
    const prisma = fakePrisma({});
    const plan = await planAcquisition(prisma, { url: "https://example.org/page" });
    const methods = plan.steps.map((s) => s.method);
    expect(methods).toContain("static-http");
    expect(methods.indexOf("static-http")).toBeLessThan(methods.indexOf("dynamic-browser"));
    expect(METHOD_COST["dynamic-browser"]).toBeGreaterThan(METHOD_COST["static-http"]);
  });

  it("escalates to the browser for a host known to render client-side", async () => {
    const prisma = fakePrisma({
      memory: [
        {
          memoryType: "GENERIC",
          memoryKey: "acquisition.host.js-only.example",
          memoryValue: {
            preferred: "dynamic-browser",
            discouraged: [],
            requiresBrowser: true,
            structuredEndpoints: [],
            updatedAt: new Date().toISOString(),
          },
        },
      ],
    });
    const plan = await planAcquisition(prisma, { url: "https://js-only.example/page" });
    expect(plan.steps[0]?.method).toBe("dynamic-browser");
    expect(plan.steps[0]?.reason).toMatch(/client-side|justified/i);
  });

  it("remembers what worked for a host", async () => {
    const prisma = fakePrisma({});
    await recordAcquisitionOutcome(prisma, {
      url: "https://data.example/api",
      method: "structured-api",
      ok: true,
      structuredEndpoint: "https://data.example/api",
    });
    const learned = await recallHostStrategy(prisma, "data.example");
    expect(learned?.preferred).toBe("structured-api");
    expect(learned?.structuredEndpoints).toContain("https://data.example/api");
  });
});

describe("information gain", () => {
  it("values closing a wide content gap over re-reading known material", () => {
    const useful = estimateInformationGain({
      objective: "close the PARISH gap",
      method: "static-http",
      goalGap: 900,
      goalTarget: 1000,
    });
    const wasteful = estimateInformationGain({
      objective: "re-read a known page",
      method: "dynamic-browser",
      goalGap: 0,
      alreadyKnown: true,
    });
    expect(useful.ratio).toBeGreaterThan(wasteful.ratio);
    expect(useful.worthwhile).toBe(true);
    expect(wasteful.worthwhile).toBe(false);
    expect(wasteful.reasons.join(" ")).toMatch(/already covered/i);
  });

  it("redirects to a cheaper untried method when one exists", () => {
    const estimate = estimateInformationGain({
      objective: "read a page",
      method: "dynamic-browser",
      goalGap: 50,
      goalTarget: 100,
      cheaperUntriedMethod: "static-http",
    });
    expect(estimate.preferInstead).toBe("static-http");
    expect(estimate.worthwhile).toBe(false);
  });

  it("penalises repeating a known failure", () => {
    const fresh = estimateInformationGain({ objective: "x", method: "static-http", goalGap: 10 });
    const repeat = estimateInformationGain({
      objective: "x",
      method: "static-http",
      goalGap: 10,
      previouslyFailed: true,
    });
    expect(repeat.gain).toBeLessThan(fresh.gain);
  });

  it("ranks candidate actions by gain per unit of local resource", () => {
    const ranked = rankByInformationGain([
      {
        action: "browser-render",
        input: { objective: "a", method: "dynamic-browser", goalGap: 100, goalTarget: 100 },
      },
      {
        action: "conditional-revalidate",
        input: { objective: "b", method: "conditional-http", goalGap: 100, goalTarget: 100 },
      },
    ]);
    expect(ranked[0].action).toBe("conditional-revalidate");
    expect(ranked[0].estimate.ratio).toBeGreaterThan(MIN_WORTHWHILE_RATIO);
  });
});
