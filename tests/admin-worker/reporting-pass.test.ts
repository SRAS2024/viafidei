/**
 * Reporting pass: records growth snapshots + source coverage, throttled to ~1/h
 * so the loop can call it every pass. These tests pin the throttle (skips when
 * run recently) and that it delegates to both engines when it does run.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/growth-orchestrator", () => ({
  runGrowthOrchestrator: vi.fn(async () => ({
    assessments: [{ contentType: "PRAYER" }, { contentType: "SAINT" }],
    repairPlansFiled: 1,
    movedToMaintenance: 0,
  })),
}));
vi.mock("@/lib/admin-worker/source-coverage", () => ({
  runSourceCoverage: vi.fn(async () => [{ contentType: "PRAYER" }, { contentType: "SAINT" }]),
}));

import type { PrismaClient } from "@prisma/client";

import { maybeRunReportingPass } from "@/lib/admin-worker/reporting-pass";
import { runGrowthOrchestrator } from "@/lib/admin-worker/growth-orchestrator";
import { runSourceCoverage } from "@/lib/admin-worker/source-coverage";

const mockedGrowth = vi.mocked(runGrowthOrchestrator);
const mockedCoverage = vi.mocked(runSourceCoverage);

beforeEach(() => {
  mockedGrowth.mockClear();
  mockedCoverage.mockClear();
});
afterEach(() => vi.restoreAllMocks());

/** Throttle row state: lastUsedAt drives whether the pass runs. */
function makePrisma(lastUsedAt: Date | null) {
  const upsert = vi.fn(async () => ({}));
  return {
    upsert,
    prisma: {
      adminWorkerMemory: {
        findUnique: vi.fn(async () => (lastUsedAt ? { lastUsedAt } : null)),
        upsert,
      },
    } as unknown as PrismaClient,
  };
}

describe("maybeRunReportingPass", () => {
  it("runs both engines when not throttled and reports the counts", async () => {
    const { prisma, upsert } = makePrisma(null);

    const out = await maybeRunReportingPass(prisma, { passId: "p1" });

    expect(out.ran).toBe(true);
    expect(out.growthAssessed).toBe(2);
    expect(out.repairPlansFiled).toBe(1);
    expect(out.coverageRows).toBe(2);
    expect(mockedGrowth).toHaveBeenCalledTimes(1);
    expect(mockedCoverage).toHaveBeenCalledTimes(1);
    // The throttle marker is stamped so the next pass skips.
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("skips (throttled) when it ran within the last hour", async () => {
    const { prisma } = makePrisma(new Date(Date.now() - 5 * 60 * 1000)); // 5 min ago

    const out = await maybeRunReportingPass(prisma);

    expect(out.ran).toBe(false);
    expect(mockedGrowth).not.toHaveBeenCalled();
    expect(mockedCoverage).not.toHaveBeenCalled();
  });

  it("force bypasses the throttle", async () => {
    const { prisma } = makePrisma(new Date()); // just ran

    const out = await maybeRunReportingPass(prisma, { force: true });

    expect(out.ran).toBe(true);
    expect(mockedGrowth).toHaveBeenCalledTimes(1);
  });
});
