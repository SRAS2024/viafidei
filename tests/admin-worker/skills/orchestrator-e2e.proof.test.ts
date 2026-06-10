/**
 * E2E PROOF: the skill orchestrator drives a real source-to-public-page build
 * plan through certified skills, records every step to the durable ledger, and
 * stops safely. Also proves a non-executable plan (no certified extractor) is
 * blocked rather than faked, and a publish "review" result routes to human
 * review without publishing.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/fetcher", () => ({
  adminWorkerFetch: vi.fn(async () => ({
    succeeded: true,
    httpStatus: 200,
    body: "<html>Hail Mary, full of grace</html>",
    fetchResultRowId: "fr-1",
  })),
}));
vi.mock("@/lib/admin-worker/source-reader", () => ({
  readSource: vi.fn(async () => ({
    rejected: false,
    sourceReadId: "sr-1",
    acceptedBlocks: 5,
    classifierContentType: "PRAYER",
  })),
}));
vi.mock("@/lib/admin-worker/extractors", () => ({
  extractByType: vi.fn(() => ({
    fields: { title: "Hail Mary", body: "Hail Mary…" },
    missingFields: [],
    confidenceScore: 0.9,
    sourceEvidence: [],
    rejectedSections: [],
    formatting: {},
    warnings: [],
    fatalReasons: [],
  })),
}));
vi.mock("@/lib/admin-worker/strict-qa", () => ({
  recordStrictQA: vi.fn(async () => ({ status: "PASSED", finalScore: 0.95 })),
}));
vi.mock("@/lib/admin-worker/publish-orchestrator", () => ({
  runPublishOrchestrator: vi.fn(async () => ({ kind: "published", publishedId: "pub-1" })),
}));
vi.mock("@/lib/admin-worker/search-sitemap-cache-verifiers", () => ({
  verifySearchIndex: vi.fn(async () => ({ ok: true })),
  verifySitemap: vi.fn(async () => ({ ok: true })),
  verifyCacheFreshness: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/checklist/publishing", () => ({
  unpublish: vi.fn(async () => ({ published: false })),
}));

import { runPublishOrchestrator } from "@/lib/admin-worker/publish-orchestrator";
import { runSkillPlan, ensureSkillsRegistered } from "@/lib/admin-worker/skills";

function ledgerPrisma() {
  const created: unknown[] = [];
  const prisma = {
    adminWorkerSkillExecution: {
      create: vi.fn(async (a: { data: unknown }) => {
        created.push(a.data);
        return { id: `led-${created.length}` };
      }),
      findFirst: vi.fn(async () => null),
      count: vi.fn(async () => 0),
    },
    adminWorkerSkillCapability: {
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(async () => ({})),
    },
    adminWorkerDeveloperRequest: { upsert: vi.fn(async () => ({ id: "dr" })) },
    adminWorkerRepairPlan: { create: vi.fn(async () => ({ id: "rp" })) },
    publishedContent: {
      findFirst: vi.fn(async () => ({ id: "pub-1" })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  };
  return { prisma, created };
}

// A non-sensitive prayer package whose fields satisfy every verification gate.
const prayerInput = {
  url: "https://www.vatican.va/hail-mary",
  host: "www.vatican.va",
  sourceUrl: "https://www.vatican.va/hail-mary",
  sourceHost: "www.vatican.va",
  rawBody: "<html>Hail Mary</html>",
  slug: "hail-mary",
  title: "Hail Mary",
  contentId: "ci-1",
  missingFields: [],
  citations: [{ url: "https://www.vatican.va/hail-mary" }],
  authorityLevel: "VATICAN",
  duplicateRisk: false,
};

afterEach(() => vi.clearAllMocks());

describe("E2E: orchestrator runs a certified source-to-page build", () => {
  it("executes every step of the prayer build plan and records each to the ledger", async () => {
    ensureSkillsRegistered();
    const { prisma, created } = ledgerPrisma();
    const result = await runSkillPlan(prisma as never, {
      missionStage: "PUBLIC_PUBLISH",
      contentType: "PRAYER",
      brainActive: true,
      targetEntityId: "ci-1",
      input: prayerInput,
    });

    expect(result.plan.executable).toBe(true);
    expect(result.succeeded).toBe(true);
    expect(result.stoppedAt).toBeNull();
    // The whole plan ran through certified skills…
    const ran = result.executed.map((e) => e.skill);
    expect(ran).toContain("fetch_static_html");
    expect(ran).toContain("extract_prayer");
    expect(ran).toContain("publish_content");
    expect(ran).toContain("verify_cache");
    expect(result.executed.every((e) => e.outcome === "SUCCEEDED")).toBe(true);
    // …and every execution was recorded to the durable ledger.
    expect(created.length).toBe(result.executed.length);
    expect(runPublishOrchestrator).toHaveBeenCalledTimes(1);
  });

  it("blocks a non-executable plan (no certified extractor) without faking it", async () => {
    ensureSkillsRegistered();
    const { prisma } = ledgerPrisma();
    const result = await runSkillPlan(prisma as never, {
      missionStage: "PUBLIC_PUBLISH",
      contentType: "DIOCESE",
      brainActive: true,
      input: prayerInput,
    });
    expect(result.plan.executable).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.executed).toEqual([]);
    expect(runPublishOrchestrator).not.toHaveBeenCalled();
  });

  it("routes a publish 'review' result to human review and stops (no publish)", async () => {
    vi.mocked(runPublishOrchestrator).mockResolvedValueOnce({
      kind: "review",
      reason: "proof-based publishing",
    } as never);
    ensureSkillsRegistered();
    const { prisma } = ledgerPrisma();
    const result = await runSkillPlan(prisma as never, {
      missionStage: "PUBLIC_PUBLISH",
      contentType: "PRAYER",
      brainActive: true,
      targetEntityId: "ci-1",
      input: prayerInput,
    });
    expect(result.succeeded).toBe(false);
    expect(result.stoppedAt).toBe("publish_content");
  });
});
