/**
 * End-to-end test of the worker build cycle.
 *
 * Validates the fix for the BUILT-vs-APPROVED_FOR_BUILD bug: the engine
 * must permit a build when the item is in APPROVED_FOR_BUILD (the normal
 * case) AND when the item is being rebuilt from BUILT / APPROVED / PUBLISHED.
 *
 * Uses a mocked Prisma client for speed and isolation. The curated knowledge
 * short-circuit means we don't need real HTTP calls.
 */

import { describe, it, expect, vi } from "vitest";

import { runBuildEngine } from "@/lib/worker/build/engine";
import type { ChecklistItem } from "@prisma/client";

function fakeItem(
  approvalStatus: ChecklistItem["approvalStatus"],
  contentType: ChecklistItem["contentType"] = "PRAYER",
  canonicalSlug = "our-father",
): ChecklistItem {
  return {
    id: "ci-1",
    contentType,
    canonicalName: "Our Father",
    canonicalSlug,
    aliases: [],
    summary: null,
    approvalStatus,
    priority: 10,
    needsHumanReview: false,
    humanReviewReason: null,
    authorityLevelHint: "VATICAN",
    duplicateOfId: null,
    notes: null,
    metadata: null,
    discoveredAt: new Date(),
    sourceVerifiedAt: new Date(),
    approvedForBuildAt: new Date(),
    builtAt: null,
    qaPendingAt: null,
    approvedAt: null,
    rejectedAt: null,
    publishedAt: null,
    rejectedReason: null,
    publishedContentRef: null,
    approvedByUsername: null,
    rejectedByUsername: null,
    publishedByUsername: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as ChecklistItem;
}

function makePrisma(item: ChecklistItem) {
  return {
    checklistItem: {
      findUnique: vi.fn().mockResolvedValue({ ...item, citations: [] }),
    },
    checklistCitation: {
      update: vi.fn(),
    },
    workerBuildLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  } as never;
}

describe("build engine guard accepts rebuild states", () => {
  it("accepts APPROVED_FOR_BUILD (first build)", async () => {
    const prisma = makePrisma(fakeItem("APPROVED_FOR_BUILD"));
    const result = await runBuildEngine(
      { prisma },
      { buildJobId: "job-1", checklistItemId: "ci-1" },
    );
    expect(result.ok).toBe(true);
  });

  it("accepts BUILT (worker re-runs)", async () => {
    const prisma = makePrisma(fakeItem("BUILT"));
    const result = await runBuildEngine(
      { prisma },
      { buildJobId: "job-1", checklistItemId: "ci-1" },
    );
    expect(result.ok).toBe(true);
  });

  it("accepts PUBLISHED (admin Rebuild)", async () => {
    const prisma = makePrisma(fakeItem("PUBLISHED"));
    const result = await runBuildEngine(
      { prisma },
      { buildJobId: "job-1", checklistItemId: "ci-1" },
    );
    expect(result.ok).toBe(true);
  });

  it("rejects DISCOVERED (not yet approved)", async () => {
    const prisma = makePrisma(fakeItem("DISCOVERED"));
    const result = await runBuildEngine(
      { prisma },
      { buildJobId: "job-1", checklistItemId: "ci-1" },
    );
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toMatch(/not approved/);
  });

  it("rejects REJECTED (admin said no)", async () => {
    const prisma = makePrisma(fakeItem("REJECTED"));
    const result = await runBuildEngine(
      { prisma },
      { buildJobId: "job-1", checklistItemId: "ci-1" },
    );
    expect(result.ok).toBe(false);
  });
});

describe("curated knowledge short-circuit", () => {
  it("succeeds for our-father (in curated knowledge) with no citations", async () => {
    // Our Father is in the knowledge base, so the engine should
    // produce a full package without needing fetched sources.
    const prisma = makePrisma(fakeItem("APPROVED_FOR_BUILD", "PRAYER", "our-father"));
    const result = await runBuildEngine(
      { prisma },
      { buildJobId: "job-1", checklistItemId: "ci-1" },
    );
    expect(result.ok).toBe(true);
    expect(result.package).toBeDefined();
    expect(result.package!.title).toBe("Our Father");
    expect(result.package!.confidence).toBeGreaterThan(0.9);
    expect(result.package!.citations.length).toBeGreaterThan(0);
  });

  it("succeeds for baptism (curated sacrament) with no citations", async () => {
    const prisma = makePrisma(fakeItem("APPROVED_FOR_BUILD", "SACRAMENT", "baptism"));
    const result = await runBuildEngine(
      { prisma },
      { buildJobId: "job-1", checklistItemId: "ci-1" },
    );
    expect(result.ok).toBe(true);
    expect(result.package!.payload.sacramentKey).toBe("baptism");
  });
});
