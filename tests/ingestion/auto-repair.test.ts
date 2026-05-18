/**
 * Auto-repair worker — proves each broken stage triggers the
 * matching recovery action.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

const getReportMock = vi.fn();
vi.mock("@/lib/diagnostics/pipeline-broken-here", () => ({
  getPipelineBrokenHereReport: () => getReportMock(),
  countSourceDocumentsWaitingForBuild: vi.fn().mockResolvedValue({ count: 0, thresholdMs: 1000 }),
}));

const renderGateMock = vi.fn();
const postIngestionMock = vi.fn();
vi.mock("@/lib/ingestion/queue/auto-cleanup", () => ({
  autoEnqueueRenderGateCleanup: (...a: unknown[]) => renderGateMock(...a),
  autoEnqueuePostIngestionCleanup: (...a: unknown[]) => postIngestionMock(...a),
}));

beforeEach(() => {
  resetPrismaMock();
  getReportMock.mockReset();
  renderGateMock.mockReset();
  postIngestionMock.mockReset();
  prismaMock.ingestionJobQueue.findFirst.mockResolvedValue(null);
  prismaMock.ingestionJobQueue.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: `q-${Math.random()}`,
      ...data,
    }),
  );
  prismaMock.contentPackageBuildLog.findFirst.mockResolvedValue(null);
});

describe("runAutoRepairPass", () => {
  it("enqueues content_build for each source-document-waiting-for-build sample", async () => {
    const { runAutoRepairPass } = await import("@/lib/ingestion/queue/auto-repair");
    getReportMock.mockResolvedValue({
      generatedAt: new Date(),
      totalBroken: 1,
      entries: [
        {
          stage: "source_document_waiting_for_build",
          label: "Source documents waiting for build",
          count: 1,
          samples: [
            {
              sourceDocumentId: "doc-1",
              sourceUrl: "https://example.com/p",
              detail: "stuck",
            },
          ],
          thresholdMs: 1000,
          automaticNextAction: "enqueue_content_build_for_each_allowed_content_type",
        },
      ],
    });
    prismaMock.sourceDocument.findUnique.mockResolvedValue({
      id: "doc-1",
      sourceUrl: "https://example.com/p",
      sourceHost: "example.com",
      contentChecksum: "ck",
      sourceId: "src-1",
    });
    prismaMock.ingestionSource.findUnique.mockResolvedValue({
      id: "src-1",
      canIngestPrayers: true,
      canIngestSaints: false,
      canIngestApparitions: false,
      canIngestParishes: false,
      canIngestDevotions: false,
      canIngestNovenas: false,
      canIngestSacraments: false,
      canIngestRosaryGuides: false,
      canIngestConsecrations: false,
      canIngestSpiritualGuides: false,
      canIngestLiturgy: false,
      canIngestHistory: false,
      canProvideScriptureText: false,
    });

    const report = await runAutoRepairPass();

    expect(report.actionsTaken.some((a) => a.kind === "enqueue_content_build")).toBe(true);
  });

  it("enqueues a render-gate cleanup for persisted_but_public_gate_failed entries", async () => {
    const { runAutoRepairPass } = await import("@/lib/ingestion/queue/auto-repair");
    getReportMock.mockResolvedValue({
      generatedAt: new Date(),
      totalBroken: 1,
      entries: [
        {
          stage: "persisted_but_public_gate_failed",
          label: "Persisted but public gate failed",
          count: 1,
          samples: [{ contentType: "Prayer", slug: "broken-prayer" }],
          thresholdMs: 0,
          automaticNextAction: "run_strict_revalidation",
        },
      ],
    });

    const report = await runAutoRepairPass();

    expect(renderGateMock).toHaveBeenCalledTimes(1);
    expect(report.actionsTaken).toContainEqual(
      expect.objectContaining({ kind: "enqueue_render_gate_cleanup", slug: "broken-prayer" }),
    );
  });

  it("does nothing when the pipeline-broken-here report is empty", async () => {
    const { runAutoRepairPass } = await import("@/lib/ingestion/queue/auto-repair");
    getReportMock.mockResolvedValue({ generatedAt: new Date(), totalBroken: 0, entries: [] });
    const report = await runAutoRepairPass();
    expect(report.actionsTaken).toHaveLength(0);
    expect(report.errors).toHaveLength(0);
  });
});
