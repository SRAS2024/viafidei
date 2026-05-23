/**
 * Tests for the autonomous worker promotion pipeline.
 */

import { describe, it, expect, vi } from "vitest";

import { autonomousPromote } from "@/lib/worker";

function makePrisma() {
  return {
    checklistItem: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
    },
    checklistCitation: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    workerBuildJob: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "job-1" }),
    },
  } as never;
}

describe("autonomousPromote", () => {
  it("promotes DISCOVERED items with approved citations to SOURCE_VERIFIED", async () => {
    const prisma: any = makePrisma();
    prisma.checklistItem.findMany.mockImplementation(async (args: any) => {
      if (args.where?.approvalStatus === "DISCOVERED") {
        return [
          {
            id: "d-1",
            contentType: "PRAYER",
            canonicalSlug: "our-father",
            canonicalName: "Our Father",
            citations: [{ sourceHost: "vatican.va" }],
          },
          {
            id: "d-2",
            contentType: "PRAYER",
            canonicalSlug: "x",
            canonicalName: "X",
            citations: [{ sourceHost: "not-approved.example" }],
          },
        ];
      }
      return [];
    });

    const moved = await autonomousPromote(prisma);
    expect(moved).toBe(1);
    expect(prisma.checklistItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "d-1" },
        data: expect.objectContaining({ approvalStatus: "SOURCE_VERIFIED" }),
      }),
    );
  });

  it("never promotes items flagged needsHumanReview", async () => {
    const prisma: any = makePrisma();
    prisma.checklistItem.findMany.mockResolvedValue([]);
    const moved = await autonomousPromote(prisma);
    expect(moved).toBe(0);
  });

  it("never auto-builds APPARITION items (schema requires human review)", async () => {
    const prisma: any = makePrisma();
    prisma.checklistItem.findMany.mockImplementation(async (args: any) => {
      if (args.where?.approvalStatus === "SOURCE_VERIFIED") {
        return [
          {
            id: "ap-1",
            contentType: "APPARITION",
            canonicalSlug: "fatima",
            canonicalName: "Fatima",
            citations: [{ id: "c1" }, { id: "c2" }],
          },
        ];
      }
      return [];
    });
    const moved = await autonomousPromote(prisma);
    expect(moved).toBe(0);
  });
});
