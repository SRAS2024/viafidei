/**
 * SourceCoverage (spec §23). Verifies the per-content-type coverage
 * scorecard, including the "blocked by coverage" flag and its
 * recommendation.
 */

import { describe, expect, it, vi } from "vitest";

import { runSourceCoverage } from "@/lib/admin-worker/source-coverage";

function makePrisma(opts: {
  goals: Array<{ contentType: string; gapCount: number }>;
  primary?: number;
  validation?: number;
  enrichment?: number;
  recentCandidates?: number;
  recentBuilds?: number;
  recentPublishes?: number;
}) {
  return {
    contentGoal: {
      findMany: vi.fn(async () => opts.goals),
    },
    authoritySource: {
      count: vi.fn(async () => opts.primary ?? 0),
    },
    adminWorkerSourceReputation: {
      count: vi.fn(async ({ where }: { where: { sourceRole?: string } }) => {
        if (where.sourceRole === "validation_source") return opts.validation ?? 0;
        if (where.sourceRole === "enrichment_source") return opts.enrichment ?? 0;
        return 0;
      }),
    },
    candidateSourceUrl: {
      count: vi.fn(async () => opts.recentCandidates ?? 0),
    },
    workerBuildJob: {
      count: vi.fn(async () => opts.recentBuilds ?? 0),
    },
    publishedContent: {
      count: vi.fn(async () => opts.recentPublishes ?? 0),
    },
    adminWorkerSourceCoverage: {
      upsert: vi.fn(async () => ({})),
    },
  } as unknown as Parameters<typeof runSourceCoverage>[0];
}

describe("runSourceCoverage — spec §23", () => {
  it("flags blocked-by-coverage when there are zero primary sources", async () => {
    const prisma = makePrisma({
      goals: [{ contentType: "PRAYER", gapCount: 30 }],
      primary: 0,
      recentCandidates: 0,
      recentBuilds: 0,
      recentPublishes: 0,
    });
    const rows = await runSourceCoverage(prisma);
    expect(rows[0].blockedByCoverage).toBe(true);
    expect(rows[0].coverageScore).toBeLessThan(0.4);
    expect(rows[0].blockReason).toMatch(/primary source/);
    expect(rows[0].recommendation).toMatch(/Add/);
  });

  it("flags blocked-by-coverage when primaries exist but no candidates surfaced", async () => {
    const prisma = makePrisma({
      goals: [{ contentType: "PRAYER", gapCount: 30 }],
      primary: 3,
      recentCandidates: 0,
      recentBuilds: 0,
      recentPublishes: 0,
    });
    const rows = await runSourceCoverage(prisma);
    expect(rows[0].blockedByCoverage).toBe(true);
    expect(rows[0].recommendation).toMatch(/DiscoveryOrchestrator/);
  });

  it("does not flag blocked-by-coverage when coverage is healthy", async () => {
    const prisma = makePrisma({
      goals: [{ contentType: "PRAYER", gapCount: 30 }],
      primary: 5,
      validation: 2,
      enrichment: 1,
      recentCandidates: 20,
      recentBuilds: 5,
      recentPublishes: 3,
    });
    const rows = await runSourceCoverage(prisma);
    expect(rows[0].blockedByCoverage).toBe(false);
    expect(rows[0].coverageScore).toBeGreaterThanOrEqual(0.4);
  });

  it("does not flag blocked-by-coverage when the gap is zero (maintenance mode)", async () => {
    const prisma = makePrisma({
      goals: [{ contentType: "PRAYER", gapCount: 0 }],
      primary: 0,
      recentCandidates: 0,
      recentBuilds: 0,
      recentPublishes: 0,
    });
    const rows = await runSourceCoverage(prisma);
    expect(rows[0].blockedByCoverage).toBe(false);
  });

  it("upserts the scorecard so the admin UI always has a fresh row", async () => {
    const prisma = makePrisma({
      goals: [{ contentType: "PRAYER", gapCount: 30 }],
      primary: 3,
    });
    await runSourceCoverage(prisma);
    expect(
      vi.mocked(prisma.adminWorkerSourceCoverage.upsert as ReturnType<typeof vi.fn>),
    ).toHaveBeenCalled();
  });
});
