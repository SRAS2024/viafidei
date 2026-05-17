/**
 * Saved-content pruning tests.
 *
 * Spec line: "Saved content should gracefully remove references to
 * deleted invalid rows." Cascade FK handles hard-deleted rows; the
 * pruneOrphanedSaves() sweep handles still-existing-but-no-longer-
 * public rows (archived, render-gate failed, threshold-eligibility
 * cleared).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { pruneOrphanedSaves } from "@/lib/data/saved";

beforeEach(() => {
  resetPrismaMock();
});

describe("pruneOrphanedSaves", () => {
  it("deletes saves whose target is not currently public", async () => {
    prismaMock.userSavedPrayer.deleteMany.mockResolvedValue({ count: 3 });
    prismaMock.userSavedSaint.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.userSavedApparition.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.userSavedParish.deleteMany.mockResolvedValue({ count: 2 });
    prismaMock.userSavedDevotion.deleteMany.mockResolvedValue({ count: 0 });

    const result = await pruneOrphanedSaves();
    expect(result.prayers).toBe(3);
    expect(result.saints).toBe(1);
    expect(result.parishes).toBe(2);
    expect(prismaMock.userSavedPrayer.deleteMany).toHaveBeenCalledTimes(1);
    // Verify the where clause excludes currently-public rows.
    const callArg = prismaMock.userSavedPrayer.deleteMany.mock.calls[0][0] as {
      where: { prayer: { NOT: Record<string, unknown> } };
    };
    expect(callArg.where.prayer.NOT.publicRenderReady).toBe(true);
    expect(callArg.where.prayer.NOT.isThresholdEligible).toBe(true);
  });
});
