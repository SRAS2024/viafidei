/**
 * Innovation lab (adaptive-worker Phase D).
 *
 * Pins: a bounded, measure-only experiment picks the dimension with competing
 * methods, compares the top two by EWMA, persists a plan + result, and — only
 * when the margin is decisive with enough data on both — declares a winner and
 * remembers it. It never publishes.
 */
import { describe, expect, it } from "vitest";

import { runInnovationExperiment } from "@/lib/admin-worker/innovation-lab";

interface Stat {
  dimension: string;
  method: string;
  contentType: string;
  ewma: number;
  attempts: number;
  successes: number;
}

function fakePrisma(stats: Stat[]) {
  const plans: Record<string, unknown>[] = [];
  const results: Record<string, unknown>[] = [];
  const memory: Record<string, unknown>[] = [];
  const logs: Record<string, unknown>[] = [];
  let pid = 0;
  return {
    plans,
    results,
    memory,
    logs,
    adminWorkerStrategyStat: {
      findMany: async ({
        where,
      }: {
        where?: { dimension?: string; contentType?: { in: string[] } };
      }) => stats.filter((s) => (where?.dimension ? s.dimension === where.dimension : true)),
    },
    labExperimentPlan: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `plan${++pid}`, ...data };
        plans.push(row);
        return row;
      },
    },
    labExperimentResult: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        results.push(data);
        return data;
      },
    },
    adminWorkerMemory: {
      findUnique: async () => null,
      upsert: async ({ create }: { create: Record<string, unknown> }) => {
        memory.push(create);
        return create;
      },
    },
    adminWorkerLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        logs.push(data);
        return data;
      },
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FakePrisma = any;

function stat(dimension: string, method: string, ewma: number, attempts: number): Stat {
  return {
    dimension,
    method,
    contentType: "*",
    ewma,
    attempts,
    successes: Math.round(ewma * attempts),
  };
}

describe("runInnovationExperiment", () => {
  it("does not run when no dimension has two methods with enough data", async () => {
    const prisma = fakePrisma([stat("discovery", "SITEMAP", 0.9, 10)]); // only one method
    const res = await runInnovationExperiment(prisma as FakePrisma);
    expect(res.ran).toBe(false);
    expect(prisma.plans).toHaveLength(0);
  });

  it("declares + remembers a winner when the margin is decisive", async () => {
    const prisma = fakePrisma([
      stat("discovery", "SITEMAP", 0.9, 12),
      stat("discovery", "RSS", 0.4, 8),
    ]);
    const res = await runInnovationExperiment(prisma as FakePrisma, { passId: "p1" });
    expect(res.ran).toBe(true);
    expect(res.conclusive).toBe(true);
    expect(res.leader).toBe("SITEMAP");
    // Plan + result persisted (measure-only, publishes:false).
    expect(prisma.plans).toHaveLength(1);
    expect(prisma.plans[0].publishes).toBe(false);
    expect(prisma.results).toHaveLength(1);
    expect(prisma.results[0].conclusive).toBe(true);
    // Winner remembered for future method selection.
    expect(prisma.memory.some((m) => m.memoryKey === "strategy_winner:discovery")).toBe(true);
  });

  it("is inconclusive when the two methods are close", async () => {
    const prisma = fakePrisma([
      stat("discovery", "SITEMAP", 0.62, 10),
      stat("discovery", "RSS", 0.55, 10),
    ]);
    const res = await runInnovationExperiment(prisma as FakePrisma);
    expect(res.ran).toBe(true);
    expect(res.conclusive).toBe(false);
    expect(res.leader).toBeNull();
    // No winner remembered on an inconclusive result.
    expect(prisma.memory).toHaveLength(0);
    // But the plan + result are still recorded for the audit trail.
    expect(prisma.results).toHaveLength(1);
  });

  it("requires enough attempts on both groups to be conclusive", async () => {
    const prisma = fakePrisma([
      stat("discovery", "SITEMAP", 0.95, 10),
      stat("discovery", "RSS", 0.1, 2), // only 2 attempts → not enough
    ]);
    const res = await runInnovationExperiment(prisma as FakePrisma);
    // RSS has < MIN_ATTEMPTS_PER_GROUP, so the dimension has only one qualifying
    // method → the experiment does not run.
    expect(res.ran).toBe(false);
  });
});
