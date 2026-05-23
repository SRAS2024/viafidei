/**
 * Tests for the publishing gate.
 */

import { describe, it, expect, vi } from "vitest";

import { publish } from "@/lib/worker/publishing";
import type { BuiltContentPackage } from "@/lib/worker/types";
import type { QAReport } from "@/lib/worker/qa";

function fakePkg(): BuiltContentPackage {
  return {
    contentType: "PRAYER",
    canonicalSlug: "our-father",
    title: "Our Father",
    fields: {},
    payload: { slug: "our-father", title: "Our Father" },
    authorityLevel: "VATICAN",
    confidence: 0.95,
    warnings: [],
    citations: ["https://www.vatican.va/"],
    needsHumanReview: false,
  };
}

function fakeQa(overrides: Partial<QAReport> = {}): QAReport {
  return {
    passed: true,
    completenessScore: 1,
    accuracyScore: 1,
    sourceCoverageScore: 1,
    formattingScore: 1,
    readabilityScore: 1,
    appCompatScore: 1,
    overallScore: 0.95,
    issues: [],
    warnings: [],
    fieldsValidated: [],
    recommendation: "publish",
    needsHumanReview: false,
    ...overrides,
  };
}

function makePrisma() {
  const checklistItem = { findUnique: vi.fn(), update: vi.fn() };
  const publishedContent = { upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() };
  const checklistVersion = { create: vi.fn() };
  return {
    checklistItem,
    publishedContent,
    checklistVersion,
  } as never;
}

describe("publishing gate", () => {
  it("refuses to publish when QA recommends reject", async () => {
    const prisma = makePrisma() as never as Awaited<ReturnType<typeof makePrisma>>;
    const result = await publish(prisma as never, {
      checklistItemId: "ci-1",
      pkg: fakePkg(),
      qa: fakeQa({ recommendation: "reject", overallScore: 0.3 }),
    });
    expect(result.published).toBe(false);
    expect(result.reason).toMatch(/QA recommended reject/);
  });

  it("refuses to publish when QA needs human review and forceReviewBypass is false", async () => {
    const prisma = makePrisma() as never;
    const result = await publish(prisma as never, {
      checklistItemId: "ci-1",
      pkg: fakePkg(),
      qa: fakeQa({ needsHumanReview: true }),
    });
    expect(result.published).toBe(false);
    expect(result.reason).toMatch(/human review/);
  });

  it("publishes when QA passes and the checklist item exists", async () => {
    const prisma: any = makePrisma();
    prisma.checklistItem.findUnique.mockResolvedValue({
      id: "ci-1",
      contentType: "PRAYER",
      canonicalSlug: "our-father",
    });
    prisma.publishedContent.findUnique.mockResolvedValue(null);
    prisma.publishedContent.upsert.mockResolvedValue({ id: "pub-1" });
    prisma.checklistItem.update.mockResolvedValue({});
    prisma.checklistVersion.create.mockResolvedValue({});

    const result = await publish(prisma, {
      checklistItemId: "ci-1",
      pkg: fakePkg(),
      qa: fakeQa(),
    });
    expect(result.published).toBe(true);
    expect(prisma.publishedContent.upsert).toHaveBeenCalled();
    expect(prisma.checklistVersion.create).toHaveBeenCalled();
  });

  it("emits a new version each time it republishes", async () => {
    const prisma: any = makePrisma();
    prisma.checklistItem.findUnique.mockResolvedValue({
      id: "ci-1",
      contentType: "PRAYER",
      canonicalSlug: "our-father",
    });
    prisma.publishedContent.findUnique.mockResolvedValue({ version: 3 });
    prisma.publishedContent.upsert.mockResolvedValue({ id: "pub-1" });
    prisma.checklistItem.update.mockResolvedValue({});
    prisma.checklistVersion.create.mockResolvedValue({});

    await publish(prisma, {
      checklistItemId: "ci-1",
      pkg: fakePkg(),
      qa: fakeQa(),
    });
    const upsertArgs = prisma.publishedContent.upsert.mock.calls[0]?.[0];
    expect(upsertArgs.update.version).toBe(4);
  });
});
