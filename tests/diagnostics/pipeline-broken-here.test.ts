/**
 * Pipeline broken here diagnostic.
 *
 * Proves the diagnostic detects each broken stage of the queue
 * chain and reports an automatic next action for it.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import {
  countSourceDocumentsWaitingForBuild,
  getPipelineBrokenHereReport,
} from "@/lib/diagnostics/pipeline-broken-here";

beforeEach(() => {
  resetPrismaMock();
});

describe("countSourceDocumentsWaitingForBuild", () => {
  it("counts documents that have no build log", async () => {
    prismaMock.sourceDocument.findMany.mockResolvedValue([
      { id: "doc-a" },
      { id: "doc-b" },
      { id: "doc-c" },
    ]);
    prismaMock.contentPackageBuildLog.findFirst.mockImplementation(async (args: unknown) => {
      const where = (args as { where?: { sourceDocumentId?: string } } | undefined)?.where;
      if (where?.sourceDocumentId === "doc-b") return { id: "log-1" };
      return null;
    });

    const result = await countSourceDocumentsWaitingForBuild();

    expect(result.count).toBe(2);
    expect(result.thresholdMs).toBeGreaterThan(0);
  });
});

describe("getPipelineBrokenHereReport", () => {
  it("returns one entry per broken stage with an automatic next action", async () => {
    prismaMock.sourceDocument.findMany.mockResolvedValue([]);
    prismaMock.contentPackageBuildLog.findMany.mockResolvedValue([]);
    prismaMock.contentPackageBuildLog.findFirst.mockResolvedValue(null);
    prismaMock.rejectedContentLog.findFirst.mockResolvedValue(null);
    prismaMock.prayer.findMany.mockResolvedValue([]);
    prismaMock.saint.findMany.mockResolvedValue([]);

    const report = await getPipelineBrokenHereReport();

    const stageIds = report.entries.map((e) => e.stage);
    expect(stageIds).toContain("source_document_waiting_for_build");
    expect(stageIds).toContain("build_succeeded_but_no_qa");
    expect(stageIds).toContain("qa_passed_but_no_persistence");
    expect(stageIds).toContain("persisted_but_public_gate_failed");
    // Every entry must carry an automatic next action.
    for (const e of report.entries) {
      expect(e.automaticNextAction).toMatch(/\w+/);
    }
  });

  it("flags persisted rows whose strict public gate failed", async () => {
    prismaMock.sourceDocument.findMany.mockResolvedValue([]);
    prismaMock.contentPackageBuildLog.findMany.mockResolvedValue([]);
    prismaMock.contentPackageBuildLog.findFirst.mockResolvedValue(null);
    prismaMock.rejectedContentLog.findFirst.mockResolvedValue(null);
    prismaMock.prayer.findMany.mockResolvedValue([
      { slug: "broken-prayer", publicRenderReady: false, isThresholdEligible: true },
    ]);
    prismaMock.saint.findMany.mockResolvedValue([]);

    const report = await getPipelineBrokenHereReport();

    const entry = report.entries.find((e) => e.stage === "persisted_but_public_gate_failed");
    expect(entry).toBeDefined();
    expect(entry!.count).toBe(1);
    expect(entry!.samples[0]).toMatchObject({
      contentType: "Prayer",
      slug: "broken-prayer",
    });
    expect(entry!.automaticNextAction).toBe("run_strict_revalidation");
  });
});
