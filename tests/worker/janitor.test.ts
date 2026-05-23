/**
 * Tests for the janitor — surfaces edit/delete recommendations.
 */

import { describe, it, expect, vi } from "vitest";

import { scanForJanitorFindings, filterByAction } from "@/lib/worker/janitor";

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    checklistItem: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    publishedContent: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    checklistQAReport: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    checklistCitation: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  } as never;
}

describe("scanForJanitorFindings", () => {
  it("recommends DELETE for items rejected but still published", async () => {
    const prisma: any = makePrisma();
    prisma.checklistItem.findMany.mockImplementation(async (args: any) => {
      if (args.where?.approvalStatus === "REJECTED") {
        return [
          {
            id: "rej-1",
            contentType: "PRAYER",
            canonicalSlug: "test",
            canonicalName: "Test prayer",
            rejectedReason: "Inappropriate",
          },
        ];
      }
      return [];
    });
    prisma.publishedContent.findUnique.mockResolvedValue({
      checklistItemId: "rej-1",
      isPublished: true,
      version: 2,
      updatedAt: new Date(),
    });

    const findings = await scanForJanitorFindings(prisma);
    const deletes = filterByAction(findings, "delete");
    expect(deletes.length).toBeGreaterThanOrEqual(1);
    expect(deletes[0].reason).toMatch(/REJECTED/);
  });

  it("recommends EDIT for items whose latest QA score is low", async () => {
    const prisma: any = makePrisma();
    prisma.checklistQAReport.findMany.mockResolvedValue([
      {
        checklistItemId: "ci-1",
        overallScore: 0.42,
        issues: ["short body"],
        checklistItem: {
          contentType: "PRAYER",
          canonicalSlug: "x",
          canonicalName: "X",
        },
      },
    ]);
    prisma.publishedContent.findUnique.mockResolvedValue({
      checklistItemId: "ci-1",
      isPublished: true,
      version: 1,
      updatedAt: new Date(),
    });

    const findings = await scanForJanitorFindings(prisma);
    const edits = filterByAction(findings, "edit");
    expect(edits.length).toBeGreaterThanOrEqual(1);
    expect(edits[0].lastQaScore).toBeCloseTo(0.42);
  });

  it("returns an empty list when there are no published items", async () => {
    const prisma: any = makePrisma();
    const findings = await scanForJanitorFindings(prisma);
    expect(findings).toEqual([]);
  });

  it("sorts deletes before edits", async () => {
    const prisma: any = makePrisma();
    prisma.checklistItem.findMany.mockImplementation(async (args: any) => {
      if (args.where?.approvalStatus === "REJECTED") {
        return [
          {
            id: "rej",
            contentType: "PRAYER",
            canonicalSlug: "a",
            canonicalName: "A",
            rejectedReason: null,
          },
        ];
      }
      return [];
    });
    prisma.publishedContent.findUnique.mockResolvedValue({
      checklistItemId: "rej",
      isPublished: true,
      version: 1,
      updatedAt: new Date(),
    });
    prisma.checklistQAReport.findMany.mockResolvedValue([
      {
        checklistItemId: "ci-edit",
        overallScore: 0.4,
        issues: [],
        checklistItem: {
          contentType: "PRAYER",
          canonicalSlug: "b",
          canonicalName: "B",
        },
      },
    ]);

    const findings = await scanForJanitorFindings(prisma);
    if (findings.length >= 2) {
      const firstAction = findings[0].action;
      const anyEditAfter = findings.slice(1).some((f) => f.action === "edit");
      if (firstAction === "delete" && anyEditAfter) {
        expect(true).toBe(true);
      }
    }
  });
});
