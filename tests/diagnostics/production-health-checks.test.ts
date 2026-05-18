/**
 * Production health checks — proves the helper returns a pass/fail
 * report covering each spec-listed failure condition.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/ingestion/queue/heartbeat", () => ({
  hasHealthyWorker: vi.fn().mockResolvedValue(true),
}));

import { runProductionHealthChecks } from "@/lib/diagnostics/production-health-checks";

beforeEach(() => {
  resetPrismaMock();
  prismaMock.ingestionJobQueue.count.mockResolvedValue(0);
  prismaMock.contentPackageBuildLog.count.mockResolvedValue(0);
  prismaMock.sourceDocument.findMany.mockResolvedValue([]);
  prismaMock.contentPackageBuildLog.findFirst.mockResolvedValue(null);
  prismaMock.rejectedContentLog.count.mockResolvedValue(0);
  prismaMock.workerHeartbeat.count.mockResolvedValue(1);
  prismaMock.securityEvent.count.mockResolvedValue(0);
  prismaMock.prayer.count.mockResolvedValue(0);
  prismaMock.saint.count.mockResolvedValue(0);
});

describe("runProductionHealthChecks", () => {
  it("returns pass=true for every check when the system is healthy", async () => {
    const report = await runProductionHealthChecks();
    expect(report.healthy).toBe(true);
    expect(report.failedCount).toBe(0);
    const ids = report.checks.map((c) => c.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "worker_heartbeat",
        "queue_with_no_worker",
        "source_documents_with_no_build",
        "builds_without_qa_pass",
        "qa_pass_without_public",
        "admin_metrics_load",
        "security_event_logging",
        "rejected_content_logging",
      ]),
    );
  });

  it("fails the queue check when pending > 0 and no worker is running", async () => {
    prismaMock.ingestionJobQueue.count.mockImplementation(
      async (args: { where?: { status?: string } } = {}) => {
        if (args.where?.status === "pending") return 5;
        return 0;
      },
    );
    const { hasHealthyWorker } = await import("@/lib/ingestion/queue/heartbeat");
    (hasHealthyWorker as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const report = await runProductionHealthChecks();

    const failed = report.checks.find((c) => c.id === "queue_with_no_worker");
    expect(failed?.passed).toBe(false);
    expect(report.healthy).toBe(false);
  });

  it("fails the builds-without-QA check when builds exist but every one was rejected", async () => {
    prismaMock.contentPackageBuildLog.count.mockResolvedValue(10);
    prismaMock.rejectedContentLog.count.mockResolvedValue(10);
    const report = await runProductionHealthChecks();
    const failed = report.checks.find((c) => c.id === "builds_without_qa_pass");
    expect(failed?.passed).toBe(false);
  });
});
