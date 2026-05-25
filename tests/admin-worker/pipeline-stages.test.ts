/**
 * Pipeline-stage helpers — proves the chain order is correct + the
 * snapshot bucketises stages by status (spec §4).
 */

import { describe, expect, it, vi } from "vitest";

import { PIPELINE_ORDER, nextStage, pipelineSnapshot } from "@/lib/admin-worker/pipeline-stages";

describe("PIPELINE_ORDER", () => {
  it("starts with DISCOVERY and ends with CACHE", () => {
    expect(PIPELINE_ORDER[0]).toBe("DISCOVERY");
    expect(PIPELINE_ORDER[PIPELINE_ORDER.length - 1]).toBe("CACHE");
  });

  it("includes every spec-required stage", () => {
    for (const expected of [
      "DISCOVERY",
      "CANDIDATE",
      "FETCH",
      "READ",
      "CLASSIFY",
      "CHECKLIST_ITEM",
      "CITATION",
      "BUILD_JOB",
      "BUILD_PACKAGE",
      "VALIDATE",
      "QA",
      "PUBLISH",
      "POST_PUBLISH_VERIFY",
      "SEARCH_INDEX",
      "SITEMAP",
      "CACHE",
    ] as const) {
      expect(PIPELINE_ORDER).toContain(expected);
    }
  });
});

describe("nextStage", () => {
  it("returns the next stage in the chain", () => {
    expect(nextStage("DISCOVERY")).toBe("CANDIDATE");
    expect(nextStage("QA")).toBe("PUBLISH");
  });

  it("returns null at the end of the chain", () => {
    expect(nextStage("CACHE")).toBeNull();
  });
});

describe("pipelineSnapshot", () => {
  it("returns one row per stage with bucket counts", async () => {
    const prisma = {
      adminWorkerPipelineStage: {
        groupBy: vi.fn(async () => [
          { stageName: "DISCOVERY", status: "PENDING", _count: 3 },
          { stageName: "DISCOVERY", status: "SUCCEEDED", _count: 12 },
          { stageName: "PUBLISH", status: "FAILED", _count: 2 },
        ]),
      },
    } as unknown as Parameters<typeof pipelineSnapshot>[0];

    const snap = await pipelineSnapshot(prisma);
    expect(snap).toHaveLength(PIPELINE_ORDER.length);
    const discovery = snap.find((s) => s.stage === "DISCOVERY")!;
    expect(discovery.pending).toBe(3);
    expect(discovery.succeeded).toBe(12);
    const publish = snap.find((s) => s.stage === "PUBLISH")!;
    expect(publish.failed).toBe(2);
  });
});
