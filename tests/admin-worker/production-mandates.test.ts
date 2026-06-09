/**
 * Production mandates:
 *   - live sitemap + cache probing is REQUIRED in production (probes the
 *     real generated output / public route unless explicitly disabled), and
 *   - the full ten-dimension quality model is the only active publish gate.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { liveProbeEnabled } from "@/lib/admin-worker/search-sitemap-cache-verifiers";
// Hoisted to module scope on purpose: the admin-worker barrel transitively
// loads the whole pipeline, so its first-time transform/evaluation is heavy.
// Paying that cost once here (during file load) instead of inside a timed test
// body keeps the export-surface assertion below from intermittently tripping
// the per-test timeout under full-suite parallel load.
import * as adminWorkerBarrel from "@/lib/admin-worker";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("live probing is mandatory in production", () => {
  it("is enabled in production by default", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_WORKER_DISABLE_LIVE_PROBE", "");
    expect(liveProbeEnabled()).toBe(true);
  });

  it("is disabled only via the documented explicit opt-out", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_WORKER_DISABLE_LIVE_PROBE", "1");
    expect(liveProbeEnabled()).toBe(false);
  });

  it("is off outside production (dev / test) so offline runs don't probe", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("ADMIN_WORKER_DISABLE_LIVE_PROBE", "");
    expect(liveProbeEnabled()).toBe(false);
  });
});

describe("full quality model is the only active publish gate", () => {
  it("recordQualityScore stores every dimension + threshold + pass/fail + failed dimensions", async () => {
    const { recordQualityScore } = await import("@/lib/admin-worker/quality");
    const created: Array<Record<string, unknown>> = [];
    const prisma = {
      contentQualityScore: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          return { id: "q1" };
        }),
      },
    } as unknown as Parameters<typeof recordQualityScore>[0];

    await recordQualityScore(prisma, {
      contentType: "PRAYER",
      contentId: "c1",
      completenessScore: 1,
      correctnessScore: 1,
      formattingScore: 1,
      sourceAuthorityScore: 1,
      fieldProvenanceScore: 1,
      validationEvidenceScore: 1,
      duplicateSafetyScore: 1,
      publicRenderingScore: 1,
      doctrinalSensitivityScore: 1,
      packageConsistencyScore: 1,
    });

    const row = created[0];
    // Every full-model dimension is stored.
    for (const dim of [
      "sourceAuthorityScore",
      "fieldProvenanceScore",
      "duplicateSafetyScore",
      "doctrinalSensitivityScore",
      "packageConsistencyScore",
    ]) {
      expect(row[dim]).toBeDefined();
    }
    expect(row.threshold).toBeDefined();
    expect(row.passed).toBe(true);
    expect(Array.isArray(row.failedDimensions)).toBe(true);
  });

  it("the only quality scorer stores the full ten-dimension model (no reduced columns)", async () => {
    const { recordQualityScore } = await import("@/lib/admin-worker/quality");
    const created: Array<Record<string, unknown>> = [];
    const prisma = {
      contentQualityScore: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          return { id: "q1" };
        }),
      },
    } as unknown as Parameters<typeof recordQualityScore>[0];
    await recordQualityScore(prisma, {
      contentType: "PRAYER",
      contentId: "c1",
      completenessScore: 1,
      correctnessScore: 1,
      formattingScore: 1,
      sourceAuthorityScore: 1,
      fieldProvenanceScore: 1,
      validationEvidenceScore: 1,
      duplicateSafetyScore: 1,
      publicRenderingScore: 1,
      doctrinalSensitivityScore: 1,
      packageConsistencyScore: 1,
    });
    const row = created[0];
    for (const k of [
      "completenessScore",
      "correctnessScore",
      "formattingScore",
      "sourceAuthorityScore",
      "fieldProvenanceScore",
      "validationEvidenceScore",
      "duplicateSafetyScore",
      "publicRenderingScore",
      "doctrinalSensitivityScore",
      "packageConsistencyScore",
      "finalScore",
      "threshold",
      "passed",
      "failedDimensions",
    ]) {
      expect(row[k]).toBeDefined();
    }
    // The reduced-model columns no longer exist.
    expect(row.sourceEvidenceScore).toBeUndefined();
    expect(row.validationScore).toBeUndefined();
    expect(row.renderScore).toBeUndefined();
  });

  it("the only quality scorer is the full model — no reduced / V2 variants remain", () => {
    const mod = adminWorkerBarrel as unknown as Record<string, unknown>;
    expect(typeof mod.computeFinalScore).toBe("function");
    expect(typeof mod.recordQualityScore).toBe("function");
    expect(mod.computeFinalScoreV2).toBeUndefined();
    expect(mod.recordQualityScoreV2).toBeUndefined();
  });

  it("the publish orchestrator gates on the full quality model (recordQualityScore)", async () => {
    // A doctrinally-sensitive item with no verifier sign-off drives the
    // full-model doctrinalSensitivity dimension to 0 → finalScore 0 → the
    // publish is refused. (A reduced 6-dim model would have let it pass.)
    vi.resetModules();
    vi.doMock("@/lib/admin-worker/repair", () => ({
      flagCacheRefresh: vi.fn(async () => ({ kind: "ok", attempted: true, succeeded: true })),
      flagSitemapRefresh: vi.fn(async () => ({ kind: "ok", attempted: true, succeeded: true })),
      flagSearchRefresh: vi.fn(async () => ({ kind: "ok", attempted: true, succeeded: true })),
    }));
    vi.doMock("@/lib/admin-worker/content-goals", () => ({
      refreshContentGoals: vi.fn(async () => undefined),
    }));
    vi.doMock("@/lib/admin-worker/logs", () => ({
      writeAdminWorkerLog: vi.fn(async () => undefined),
    }));
    vi.doMock("@/lib/admin-worker/public-routes", () => ({
      publicRouteFor: vi.fn(() => ({ tab: "x", tabPath: "/x", slugPath: "/x/y", cacheTags: [] })),
    }));
    const { runPublishOrchestrator } = await import("@/lib/admin-worker/publish-orchestrator");
    const prisma = {
      publishedContent: { findFirst: vi.fn(async () => null) },
      contentQualityScore: { create: vi.fn(async () => ({ id: "q1" })) },
      adminWorkerRepairPlan: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({ id: "rp" })),
      },
    } as unknown as Parameters<typeof runPublishOrchestrator>[0];

    const result = await runPublishOrchestrator(prisma, {
      contentType: "APPARITION",
      contentId: "ci-1",
      title: "Unverified Apparition",
      slug: "unverified",
      payload: {} as never,
      authorityLevel: "VATICAN",
      finalScore: 0.97,
      qaPassed: true,
      hasSourceEvidence: true,
      isDoctrinallySensitive: true,
      confidence: 0.97,
      // no verifier → doctrinalSensitivity dimension = 0 in the full model
    });
    expect(["blocked", "repair", "review"]).toContain(result.kind);
  });
});
