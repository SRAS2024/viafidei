/**
 * Public growth recovery.
 *
 * Pins section 20: when the catalog has zero strict-public rows and
 * the worker is healthy, recovery kicks the pipeline and names the
 * exact stage it is stuck at.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/diagnostics/pipeline-status", () => ({ getPipelineStatus: vi.fn() }));
vi.mock("@/lib/ingestion/queue/source-job-repair", () => ({ runSourceJobRepair: vi.fn() }));
vi.mock("@/lib/ingestion/queue/queue", () => ({ enqueueJob: vi.fn() }));

import {
  runPublicGrowthRecovery,
  determineFailingStage,
} from "@/lib/diagnostics/public-growth-recovery";
import { getPipelineStatus } from "@/lib/diagnostics/pipeline-status";
import { runSourceJobRepair } from "@/lib/ingestion/queue/source-job-repair";
import { enqueueJob } from "@/lib/ingestion/queue/queue";
import type { PipelineStatus } from "@/lib/diagnostics/pipeline-status";

function status(overrides: Partial<PipelineStatus> = {}): PipelineStatus {
  return {
    generatedAt: new Date(),
    queuePending: 0,
    queueRunning: 0,
    workerHealthy: true,
    sourceDocuments: 0,
    buildLogs: 0,
    completePackages: 0,
    qaPasses: 0,
    persistedPackages: 0,
    strictPublicRows: 0,
    blocker: null,
    blockerMessage: "",
    errors: {},
    ...overrides,
  };
}

beforeEach(() => {
  resetPrismaMock();
  vi.mocked(getPipelineStatus).mockReset();
  vi.mocked(runSourceJobRepair).mockReset();
  vi.mocked(enqueueJob).mockReset();
});

describe("determineFailingStage", () => {
  it("names each stage of the pipeline", () => {
    expect(determineFailingStage(status({ workerHealthy: false }))).toBe("worker missing");
    expect(determineFailingStage(status({ workerHealthy: true }))).toBe("source jobs missing");
    expect(determineFailingStage(status({ queuePending: 5, sourceDocuments: 0 }))).toBe(
      "source documents not created",
    );
    expect(determineFailingStage(status({ sourceDocuments: 5, buildLogs: 0 }))).toBe(
      "builds not enqueued",
    );
    expect(
      determineFailingStage(status({ sourceDocuments: 5, buildLogs: 5, completePackages: 0 })),
    ).toBe("builders failing");
    expect(
      determineFailingStage(
        status({ sourceDocuments: 5, buildLogs: 5, completePackages: 5, qaPasses: 0 }),
      ),
    ).toBe("strict QA rejecting");
    expect(
      determineFailingStage(
        status({
          sourceDocuments: 5,
          buildLogs: 5,
          completePackages: 5,
          qaPasses: 5,
          persistedPackages: 0,
        }),
      ),
    ).toBe("persistence failing");
    expect(
      determineFailingStage(
        status({
          sourceDocuments: 5,
          buildLogs: 5,
          completePackages: 5,
          qaPasses: 5,
          persistedPackages: 5,
          strictPublicRows: 0,
        }),
      ),
    ).toBe("public gate failing");
  });
});

describe("runPublicGrowthRecovery", () => {
  it("does nothing when the catalog already has public content", async () => {
    vi.mocked(getPipelineStatus).mockResolvedValue(status({ strictPublicRows: 12 }));

    const report = await runPublicGrowthRecovery();

    expect(report.ranRecovery).toBe(false);
    expect(report.failingStage).toBe("none");
    expect(runSourceJobRepair).not.toHaveBeenCalled();
  });

  it("reports the worker as the failing stage when no worker is alive", async () => {
    vi.mocked(getPipelineStatus).mockResolvedValue(
      status({ strictPublicRows: 0, workerHealthy: false }),
    );

    const report = await runPublicGrowthRecovery();

    expect(report.ranRecovery).toBe(false);
    expect(report.failingStage).toBe("worker missing");
    expect(enqueueJob).not.toHaveBeenCalled();
  });

  it("repairs source jobs and enqueues the bootstrap when the catalog is empty", async () => {
    vi.mocked(getPipelineStatus)
      .mockResolvedValueOnce(status({ strictPublicRows: 0, workerHealthy: true }))
      .mockResolvedValueOnce(status({ strictPublicRows: 0, workerHealthy: true, queuePending: 4 }));
    vi.mocked(runSourceJobRepair).mockResolvedValue({
      generatedAt: new Date(),
      factoryReadySources: 5,
      sourcesWithActiveJobs: 0,
      sourcesWithZeroJobs: 5,
      discoveryJobsCreated: 5,
      skippedPaused: 0,
      skippedNotConfigured: 0,
      skippedDailyCapReached: 0,
      errors: [],
    });

    const report = await runPublicGrowthRecovery();

    expect(report.ranRecovery).toBe(true);
    expect(runSourceJobRepair).toHaveBeenCalled();
    expect(enqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({ jobKind: "content_growth_bootstrap" }),
    );
    expect(report.failingStage).toBe("source documents not created");
  });
});
