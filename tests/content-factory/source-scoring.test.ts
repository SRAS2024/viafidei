/**
 * Source scoring tests.
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

describe("recordScoreEvent", () => {
  it("upserts a SourceQualityScore row on every event", async () => {
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
    expect(prismaMock.sourceQualityScore.upsert).toHaveBeenCalledTimes(1);
  });
});

describe("recordScoreEvent — auto-pauses bad sources", () => {
  function scoreRow(over: Partial<Record<string, unknown>>) {
    return {
      id: "sq-bad",
      sourceId: "src-bad",
      contentType: "Prayer",
      buildSuccessCount: 0,
      buildFailureCount: 0,
      qaPassCount: 0,
      qaFailCount: 0,
      duplicateCount: 0,
      wrongContentCount: 0,
      deletedCount: 0,
      autoPaused: false,
      autoPausedAt: null,
      validPackageRate: null,
      wrongContentRate: null,
      averageCompleteness: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastFailureReason: null,
      ...over,
    };
  }

  it("flips autoPaused = true when build failure rate crosses 80% with >= 50 attempts", async () => {
    // Simulate the state AFTER this event lands: 10 successes, 50
    // failures (≈83% failure rate, 17% valid) over 60 attempts.
    const after = scoreRow({
      buildSuccessCount: 10,
      buildFailureCount: 50,
    });
    prismaMock.sourceQualityScore.upsert.mockResolvedValue(after);
    prismaMock.sourceQualityScore.findUnique.mockResolvedValue(after);
    let updateData: Record<string, unknown> = {};
    prismaMock.sourceQualityScore.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        updateData = data;
        return { ...after, ...data };
      },
    );
    prismaMock.ingestionSource.update.mockResolvedValue({});

    await recordScoreEvent({
      kind: "build_failure",
      sourceId: "src-bad",
      contentType: "Prayer",
      reason: "missing required fields",
    });

    expect(updateData.autoPaused).toBe(true);
    expect(updateData.validPackageRate).toBeLessThan(0.2);
    // The cascade pauses the IngestionSource row itself.
    expect(prismaMock.ingestionSource.update).toHaveBeenCalledTimes(1);
  });

  it("does NOT pause when total attempts are below the minimum (50)", async () => {
    const after = scoreRow({
      buildSuccessCount: 1,
      buildFailureCount: 9, // 90% failure rate but only 10 attempts
    });
    prismaMock.sourceQualityScore.upsert.mockResolvedValue(after);
    prismaMock.sourceQualityScore.findUnique.mockResolvedValue(after);
    let updateData: Record<string, unknown> = {};
    prismaMock.sourceQualityScore.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        updateData = data;
        return { ...after, ...data };
      },
    );
    prismaMock.ingestionSource.update.mockResolvedValue({});

    await recordScoreEvent({
      kind: "build_failure",
      sourceId: "src-bad",
      contentType: "Prayer",
    });

    expect(updateData.autoPaused).toBe(false);
    // The IngestionSource row must not be touched.
    expect(prismaMock.ingestionSource.update).not.toHaveBeenCalled();
  });

  it("flips autoPaused = true when wrong-content rate crosses 50% with >= 50 attempts", async () => {
    // wrongContentRate = wrongContentCount / (qaPassCount + qaFailCount).
    // 35 / (10 + 40) = 70% > 50%, with 50 total qa attempts >= MIN.
    const after = scoreRow({
      buildSuccessCount: 5,
      buildFailureCount: 5,
      qaPassCount: 10,
      qaFailCount: 40,
      wrongContentCount: 35,
      duplicateCount: 5,
    });
    prismaMock.sourceQualityScore.upsert.mockResolvedValue(after);
    prismaMock.sourceQualityScore.findUnique.mockResolvedValue(after);
    let updateData: Record<string, unknown> = {};
    prismaMock.sourceQualityScore.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        updateData = data;
        return { ...after, ...data };
      },
    );
    prismaMock.ingestionSource.update.mockResolvedValue({});

    await recordScoreEvent({
      kind: "wrong_content",
      sourceId: "src-bad",
      contentType: "Prayer",
      reason: "page was a livestream, not a prayer",
    });

    expect(updateData.autoPaused).toBe(true);
  });

  it("flips autoPaused = true after 200 failures with zero successes (no-success budget)", async () => {
    const after = scoreRow({
      buildSuccessCount: 0,
      buildFailureCount: 201,
    });
    prismaMock.sourceQualityScore.upsert.mockResolvedValue(after);
    prismaMock.sourceQualityScore.findUnique.mockResolvedValue(after);
    let updateData: Record<string, unknown> = {};
    prismaMock.sourceQualityScore.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        updateData = data;
        return { ...after, ...data };
      },
    );
    prismaMock.ingestionSource.update.mockResolvedValue({});

    await recordScoreEvent({
      kind: "build_failure",
      sourceId: "src-bad",
      contentType: "Prayer",
    });

    expect(updateData.autoPaused).toBe(true);
  });

  it("does not re-pause an already-paused source (no double cascade)", async () => {
    const after = scoreRow({
      buildSuccessCount: 0,
      buildFailureCount: 100,
      autoPaused: true,
      autoPausedAt: new Date("2025-01-01"),
    });
    prismaMock.sourceQualityScore.upsert.mockResolvedValue(after);
    prismaMock.sourceQualityScore.findUnique.mockResolvedValue(after);
    prismaMock.sourceQualityScore.update.mockResolvedValue({});
    prismaMock.ingestionSource.update.mockResolvedValue({});

    await recordScoreEvent({
      kind: "build_failure",
      sourceId: "src-bad",
      contentType: "Prayer",
    });

    // ingestionSource.update is NOT called again — the source is
    // already paused.
    expect(prismaMock.ingestionSource.update).not.toHaveBeenCalled();
  });
});
