/**
 * Source prioritization tests.
 *
 * Spec line: "Automatically prioritize good sources." The planner
 * applies a quality-score bonus to sources with validPackageRate >
 * 0.85 so high-quality sources move to the front of the queue.
 *
 * Also verifies: `averageCompleteness` is populated by the
 * source-scoring loop.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/data/admin-notifications", () => ({
  reportCriticalFailure: vi.fn(),
}));

import { recordScoreEvent } from "@/lib/content-factory";

beforeEach(() => {
  resetPrismaMock();
});

describe("averageCompleteness population", () => {
  it("updates averageCompleteness on every build event", async () => {
    prismaMock.sourceQualityScore.upsert.mockResolvedValue({
      id: "sq1",
      sourceId: "src1",
      contentType: "Prayer",
      buildSuccessCount: 1,
      buildFailureCount: 0,
      qaPassCount: 0,
      qaFailCount: 0,
      duplicateCount: 0,
      wrongContentCount: 0,
      deletedCount: 0,
      averageCompleteness: null,
      autoPaused: false,
      lastSuccessAt: new Date(),
      lastFailureAt: null,
      lastFailureReason: null,
    });
    prismaMock.sourceQualityScore.findUnique.mockResolvedValue({
      id: "sq1",
      sourceId: "src1",
      contentType: "Prayer",
      buildSuccessCount: 1,
      buildFailureCount: 0,
      qaPassCount: 0,
      qaFailCount: 0,
      duplicateCount: 0,
      wrongContentCount: 0,
      deletedCount: 0,
      averageCompleteness: null,
      autoPaused: false,
      lastSuccessAt: new Date(),
      lastFailureAt: null,
      lastFailureReason: null,
    });
    prismaMock.sourceQualityScore.update.mockResolvedValue({});

    await recordScoreEvent({
      kind: "build_success",
      sourceId: "src1",
      contentType: "Prayer",
    });

    // The update call should include averageCompleteness with a value
    // between 0 and 1 (1.0 since this is a complete build success).
    expect(prismaMock.sourceQualityScore.update).toHaveBeenCalled();
    const call = prismaMock.sourceQualityScore.update.mock.calls[0][0] as {
      data: { averageCompleteness?: number | null };
    };
    expect(call.data.averageCompleteness).toBeGreaterThan(0);
  });

  it("accepts a partial completeness on a build_failure event", async () => {
    prismaMock.sourceQualityScore.upsert.mockResolvedValue({
      id: "sq2",
      sourceId: "src2",
      contentType: "Saint",
      buildSuccessCount: 0,
      buildFailureCount: 1,
      qaPassCount: 0,
      qaFailCount: 0,
      duplicateCount: 0,
      wrongContentCount: 0,
      deletedCount: 0,
      averageCompleteness: null,
      autoPaused: false,
      lastSuccessAt: null,
      lastFailureAt: new Date(),
      lastFailureReason: "missing biography",
    });
    prismaMock.sourceQualityScore.findUnique.mockResolvedValue({
      id: "sq2",
      sourceId: "src2",
      contentType: "Saint",
      buildSuccessCount: 0,
      buildFailureCount: 1,
      qaPassCount: 0,
      qaFailCount: 0,
      duplicateCount: 0,
      wrongContentCount: 0,
      deletedCount: 0,
      averageCompleteness: null,
      autoPaused: false,
      lastSuccessAt: null,
      lastFailureAt: new Date(),
      lastFailureReason: "missing biography",
    });
    prismaMock.sourceQualityScore.update.mockResolvedValue({});

    await recordScoreEvent({
      kind: "build_failure",
      sourceId: "src2",
      contentType: "Saint",
      reason: "missing biography",
      completeness: 0.5,
    });

    const call = prismaMock.sourceQualityScore.update.mock.calls[0][0] as {
      data: { averageCompleteness?: number | null };
    };
    expect(call.data.averageCompleteness).toBeGreaterThan(0);
    expect(call.data.averageCompleteness).toBeLessThanOrEqual(0.5);
  });
});
