/**
 * Tests for the dashboard bulk actions: verify-all, build-all, reject.
 */

import { describe, it, expect, vi } from "vitest";

import { bulkActionCounts, bulkVerifyAll, bulkBuildAll, bulkReject } from "@/lib/worker";

function makePrisma() {
  return {
    checklistItem: {
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    checklistCitation: {
      updateMany: vi.fn(),
    },
    workerBuildJob: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  } as never;
}

describe("bulkActionCounts", () => {
  it("counts only DISCOVERED items with at least one approved citation", async () => {
    const prisma: any = makePrisma();
    prisma.checklistItem.findMany.mockResolvedValue([
      { id: "1", citations: [{ sourceHost: "vatican.va" }] },
      { id: "2", citations: [{ sourceHost: "random.example.com" }] },
      { id: "3", citations: [{ sourceHost: "usccb.org" }, { sourceHost: "x.example" }] },
    ]);
    prisma.checklistItem.count.mockResolvedValue(4);
    const counts = await bulkActionCounts(prisma);
    expect(counts.discoveredReadyToVerify).toBe(2);
    expect(counts.verifiedReadyToBuild).toBe(4);
  });
});

describe("bulkVerifyAll", () => {
  it("verifies all discovered items with approved citations", async () => {
    const prisma: any = makePrisma();
    prisma.checklistItem.findMany.mockResolvedValue([
      {
        id: "1",
        canonicalSlug: "our-father",
        citations: [{ sourceHost: "vatican.va" }],
      },
      {
        id: "2",
        canonicalSlug: "x",
        citations: [{ sourceHost: "bogus.example" }],
      },
    ]);
    prisma.checklistItem.update.mockImplementation(async (args: any) => ({ id: args.where.id }));
    prisma.checklistItem.findUnique = vi.fn().mockImplementation(async (args: any) => ({
      id: args.where.id,
      citations: [{ sourceHost: "vatican.va" }],
    }));
    prisma.checklistCitation.updateMany.mockResolvedValue({ count: 1 });

    const result = await bulkVerifyAll(prisma, {});
    expect(result.attempted).toBe(2);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors[0]).toContain("x");
  });
});

describe("bulkBuildAll", () => {
  it("skips items whose schema requires human review unless overridden", async () => {
    const prisma: any = makePrisma();
    prisma.checklistItem.findMany.mockResolvedValue([
      {
        id: "1",
        canonicalSlug: "saint-joseph",
        contentType: "SAINT",
        approvalStatus: "SOURCE_VERIFIED",
      },
      {
        id: "2",
        canonicalSlug: "fatima-apparition",
        contentType: "APPARITION",
        approvalStatus: "SOURCE_VERIFIED",
      },
    ]);
    prisma.checklistItem.findUnique = vi.fn().mockImplementation(async (args: any) => ({
      id: args.where.id,
      contentType: args.where.id === "2" ? "APPARITION" : "SAINT",
      approvalStatus: "SOURCE_VERIFIED",
      citations: [{ id: "c1" }, { id: "c2" }],
    }));
    prisma.checklistItem.update.mockResolvedValue({});
    prisma.workerBuildJob.findFirst.mockResolvedValue(null);
    prisma.workerBuildJob.create.mockImplementation(async (args: any) => ({
      id: `job-${args.data.checklistItemId}`,
    }));

    const result = await bulkBuildAll(prisma, {});
    expect(result.attempted).toBe(2);
    // APPARITION schema has requiresHumanReview=true, so it is skipped
    expect(result.failed).toBeGreaterThanOrEqual(1);
    expect(result.errors.some((e) => e.includes("fatima"))).toBe(true);
  });
});

describe("bulkReject", () => {
  it("requires a reason and rejects all matching items", async () => {
    const prisma: any = makePrisma();
    prisma.checklistItem.findMany.mockResolvedValue([
      { id: "1", canonicalSlug: "a" },
      { id: "2", canonicalSlug: "b" },
    ]);
    prisma.checklistItem.update.mockResolvedValue({});

    const result = await bulkReject(prisma, {
      approvalStatus: "DISCOVERED",
      reason: "test",
    });
    expect(result.attempted).toBe(2);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(0);
  });
});
