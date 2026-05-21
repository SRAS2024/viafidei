/**
 * Pipeline status + blocker identification.
 *
 * Pins the section-8 blocker codes: walking the chain in order, the
 * first stage with work upstream but nothing downstream names the
 * blocker.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import {
  identifyPipelineBlocker,
  getPipelineStatus,
  type PipelineStatusMetrics,
} from "@/lib/diagnostics/pipeline-status";

const HEALTHY: PipelineStatusMetrics = {
  queuePending: 0,
  queueRunning: 1,
  workerHealthy: true,
  sourceDocuments: 10,
  buildLogs: 10,
  completePackages: 8,
  qaPasses: 6,
  persistedPackages: 6,
  strictPublicRows: 6,
};

beforeEach(() => {
  resetPrismaMock();
});

describe("identifyPipelineBlocker", () => {
  it("flags worker_not_processing_queue when pending jobs have no worker", () => {
    expect(identifyPipelineBlocker({ ...HEALTHY, queuePending: 9, workerHealthy: false })).toBe(
      "worker_not_processing_queue",
    );
  });

  it("flags source_fetch_not_running when the worker is healthy but no source documents", () => {
    expect(identifyPipelineBlocker({ ...HEALTHY, sourceDocuments: 0 })).toBe(
      "source_fetch_not_running",
    );
  });

  it("flags fetch_to_build_not_enqueued when source documents exist but no build logs", () => {
    expect(identifyPipelineBlocker({ ...HEALTHY, buildLogs: 0 })).toBe(
      "fetch_to_build_not_enqueued",
    );
  });

  it("flags builders_not_creating_complete_packages when builds run but none complete", () => {
    expect(identifyPipelineBlocker({ ...HEALTHY, completePackages: 0 })).toBe(
      "builders_not_creating_complete_packages",
    );
  });

  it("flags strict_qa_rejecting_packages when complete packages exist but no QA passes", () => {
    expect(identifyPipelineBlocker({ ...HEALTHY, qaPasses: 0 })).toBe(
      "strict_qa_rejecting_packages",
    );
  });

  it("flags public_gate_failed when persisted rows exist but no strict public rows", () => {
    expect(identifyPipelineBlocker({ ...HEALTHY, strictPublicRows: 0 })).toBe("public_gate_failed");
  });

  it("returns null when the pipeline is flowing end to end", () => {
    expect(identifyPipelineBlocker(HEALTHY)).toBeNull();
  });

  it("reports the upstream blocker first when several stages are empty", () => {
    // Worker dead AND no source docs AND no builds — worker wins.
    expect(
      identifyPipelineBlocker({
        ...HEALTHY,
        queuePending: 9,
        workerHealthy: false,
        sourceDocuments: 0,
        buildLogs: 0,
      }),
    ).toBe("worker_not_processing_queue");
  });
});

describe("getPipelineStatus", () => {
  it("identifies worker_not_processing_queue from live counts", async () => {
    prismaMock.ingestionJobQueue.count.mockResolvedValue(9);
    prismaMock.workerHeartbeat.count.mockResolvedValue(0);

    const status = await getPipelineStatus();

    expect(status.queuePending).toBe(9);
    expect(status.workerHealthy).toBe(false);
    expect(status.blocker).toBe("worker_not_processing_queue");
  });
});
