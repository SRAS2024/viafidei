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
