/**
 * RepairOrchestrator (spec §17). Verifies plans actually execute,
 * exhausted plans are abandoned, and backoff is respected.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/repair", () => ({
  flagCacheRefresh: vi.fn(async () => ({
    kind: "cache_failed",
    attempted: true,
    succeeded: true,
    reason: "flagged",
  })),
  flagSitemapRefresh: vi.fn(async () => ({
    kind: "sitemap_failed",
    attempted: true,
    succeeded: true,
    reason: "flagged",
  })),
  flagSearchRefresh: vi.fn(async () => ({
    kind: "search_failed",
    attempted: true,
    succeeded: true,
    reason: "flagged",
  })),
  recoverStuckQueue: vi.fn(async () => ({
    kind: "queue_stuck",
    attempted: false,
    succeeded: true,
    reason: "no stuck jobs",
  })),
  recreateMissingSourceJobs: vi.fn(async () => ({
    kind: "source_jobs_missing",
    attempted: true,
    succeeded: true,
    reason: "ok",
  })),
  pauseChronicallyFailingSource: vi.fn(async () => ({
    kind: "repeated_source_failure",
    attempted: true,
    succeeded: true,
    reason: "paused",
  })),
}));

vi.mock("@/lib/admin-worker/state", () => ({
  writeHeartbeat: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/source-reputation", () => ({
  recordSourceOutcome: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/memory", () => ({
  rememberFailurePattern: vi.fn(async () => undefined),
  // Spec §9 follow-up: every repair attempt feeds outcome learning.
  rememberOutcome: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/source-reputation-hooks", () => ({
  // Spec §9 follow-up: failed repairs penalise source reputation.
  pushReputation: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/discovery-orchestrator", () => ({
  runDiscoveryOrchestrator: vi.fn(async () => ({
    surfaced: 3,
    rejected: 0,
    hostsSkipped: [],
    strategies: [],
    errors: [],
  })),
}));

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

import { runRepairOrchestrator } from "@/lib/admin-worker/repair-orchestrator";

function makePrisma(plans: Array<Record<string, unknown>>) {
  const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
  return {
    updates,
    prisma: {
      adminWorkerRepairPlan: {
        findMany: vi.fn(async () => plans),
        update: vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
          updates.push({ id: args.where.id, data: args.data });
          return { ...plans.find((p) => p.id === args.where.id), ...args.data };
        }),
      },
      // Spec §9: CACHE_FAILED handler re-verifies via
      // verifyCacheFreshness, which reads the cache_refresh_flagged
      // log row. The mock returns a recent row so the verify passes.
      adminWorkerLog: {
        findFirst: vi.fn(async () => ({
          createdAt: new Date(),
          message: "cache flagged",
          safeMetadata: {},
        })),
      },
      publishedContent: {
        // Cache freshness needs the published row to exist; no stored
        // checksum → the offline cache-log fallback decides freshness.
        findFirst: vi.fn(async () => ({ title: "X", payload: {}, contentChecksum: null })),
      },
    } as unknown as Parameters<typeof runRepairOrchestrator>[0],
  };
}

describe("runRepairOrchestrator — durable plan execution (spec §17)", () => {
  it("executes a CACHE_FAILED plan via flagCacheRefresh", async () => {
    const { prisma, updates } = makePrisma([
      {
        id: "p1",
        kind: "CACHE_FAILED",
        failedEntity: "tag-x",
        repairAction: "refresh cache",
        status: "PENDING",
        attempts: 0,
        maxAttempts: 5,
        lastAttemptAt: null,
        nextAttemptAt: null,
      },
    ]);
    const result = await runRepairOrchestrator(prisma);
    expect(result.plansExecuted).toBe(1);
    expect(result.plansSucceeded).toBe(1);
    // The final update marks it SUCCEEDED.
    const success = updates.find((u) => u.data.status === "SUCCEEDED");
    expect(success).toBeTruthy();
  });

  it("executes a HEARTBEAT_STALE plan by writing the heartbeat", async () => {
    const { prisma } = makePrisma([
      {
        id: "p2",
        kind: "HEARTBEAT_STALE",
        failedEntity: null,
        repairAction: "heartbeat",
        status: "PENDING",
        attempts: 0,
        maxAttempts: 5,
        lastAttemptAt: null,
        nextAttemptAt: null,
      },
    ]);
    const result = await runRepairOrchestrator(prisma);
    expect(result.plansSucceeded).toBe(1);
    const { writeHeartbeat } = await import("@/lib/admin-worker/state");
    expect(vi.mocked(writeHeartbeat)).toHaveBeenCalled();
  });

  it("abandons plans that have reached maxAttempts", async () => {
    const { prisma } = makePrisma([
      {
        id: "p3",
        kind: "CACHE_FAILED",
        failedEntity: "tag-x",
        repairAction: "refresh cache",
        status: "PENDING",
        attempts: 5,
        maxAttempts: 5,
        lastAttemptAt: new Date(),
        nextAttemptAt: null,
      },
    ]);
    const result = await runRepairOrchestrator(prisma);
    expect(result.plansAbandoned).toBe(1);
    expect(result.results[0].status).toBe("ABANDONED");
  });

  it("drives an abandoned artifact-repair plan's artifact to terminal REJECTED (unsticks NEEDS_REPAIR)", async () => {
    const artifactUpdates: Array<{
      where: { id: string; status: { in: string[] } };
      data: { status: string };
    }> = [];
    const prisma = {
      adminWorkerRepairPlan: {
        findMany: vi.fn(async () => [
          {
            id: "ap1",
            kind: "STRICT_QA_FAILED",
            failedEntity: "artifact-123", // an artifact id, not a host
            repairAction: "x",
            status: "PENDING",
            attempts: 5,
            maxAttempts: 5,
            lastAttemptAt: new Date(),
            nextAttemptAt: null,
            metadata: {},
          },
        ]),
        update: vi.fn(async () => ({})),
      },
      adminWorkerPackageArtifact: {
        updateMany: vi.fn(async (args: (typeof artifactUpdates)[number]) => {
          artifactUpdates.push(args);
          return { count: 1 };
        }),
      },
      adminWorkerLog: { create: vi.fn(async () => ({})), findFirst: vi.fn(async () => null) },
    } as unknown as Parameters<typeof runRepairOrchestrator>[0];

    const out = await runRepairOrchestrator(prisma);
    expect(out.plansAbandoned).toBe(1);
    expect(artifactUpdates).toHaveLength(1);
    expect(artifactUpdates[0].where.id).toBe("artifact-123");
    expect(artifactUpdates[0].where.status.in).toContain("NEEDS_REPAIR");
    expect(artifactUpdates[0].data.status).toBe("REJECTED");
  });

  it("resolves (does NOT retry/abandon) an EXTRACT_FAILED plan for a structured-built type", async () => {
    // PARISH is grown from OSM, not web extraction, so re-extracting its web
    // read is futile. The plan must resolve terminally instead of churning
    // toward abandonment (the root of the Repair-orchestrator FAIL).
    const updates: Array<{ data: { status?: string } }> = [];
    const prisma = {
      adminWorkerRepairPlan: {
        findMany: vi.fn(async () => [
          {
            id: "ep1",
            kind: "EXTRACT_FAILED",
            failedEntity: "diocese.example",
            repairAction: "re-extract",
            status: "PENDING",
            attempts: 1,
            maxAttempts: 5,
            lastAttemptAt: new Date(),
            nextAttemptAt: null,
            metadata: { sourceReadId: "read-parish" },
          },
        ]),
        update: vi.fn(async (arg: (typeof updates)[number]) => {
          updates.push(arg);
          return {};
        }),
      },
      adminWorkerSourceRead: {
        findUnique: vi.fn(async () => ({
          id: "read-parish",
          sourceUrl: "https://diocese.example/parish",
          sourceHost: "diocese.example",
          extractedTitle: "St. Mary",
          extractedText: "…",
          extractedHeadings: [],
          detectedContentType: "PARISH",
        })),
      },
      adminWorkerLog: { create: vi.fn(async () => ({})), findFirst: vi.fn(async () => null) },
    } as unknown as Parameters<typeof runRepairOrchestrator>[0];

    const out = await runRepairOrchestrator(prisma);
    expect(out.plansAbandoned).toBe(0);
    expect(out.plansSucceeded).toBe(1); // resolved terminally, not retried
    // The RUNNING→resolved update carries SUCCEEDED (ok:true), not PENDING retry.
    const statuses = updates.map((u) => u.data.status).filter(Boolean);
    expect(statuses).toContain("SUCCEEDED");
    expect(statuses).not.toContain("PENDING");
  });

  it("auto-reconciles a stale plan whose type moved to a structured feed (knows we fixed it)", async () => {
    // A historical EXTRACT_FAILED plan for a PARISH read can never succeed by
    // re-extraction now that PARISH is OSM-built. When the fix ships, the next
    // repair pass must recognise the now-invalid plan and close it terminally —
    // that is how the worker "knows we fixed it" — instead of letting it pin the
    // repair-orchestrator health red forever.
    const updates: Array<{ where: { id: string }; data: Record<string, unknown> }> = [];
    let findManyCall = 0;
    const prisma = {
      adminWorkerRepairPlan: {
        findMany: vi.fn(async () => {
          findManyCall += 1;
          // 1st call = reconcile sweep (PENDING/RUNNING/ABANDONED); 2nd call =
          // the main due-plan fetch, which sees nothing left to run.
          if (findManyCall === 1) {
            return [
              // Drain-filed shape: contentType recorded straight on metadata
              // (the primary, artifact-independent path).
              {
                id: "stale-meta",
                failedEntity: "artifact-parish-1",
                metadata: {
                  artifactId: "artifact-parish-1",
                  gate: "MISSING_CITATIONS",
                  contentType: "PARISH",
                },
              },
              // Read-backed shape: type resolved via the source read behind it.
              {
                id: "stale-read",
                failedEntity: "diocese.example",
                metadata: { sourceReadId: "read-parish" },
              },
              // A genuinely web-repairable plan must be left untouched.
              { id: "keep-guide", failedEntity: "some.host", metadata: { contentType: "SAINT" } },
            ];
          }
          return [];
        }),
        update: vi.fn(async (arg: { where: { id: string }; data: Record<string, unknown> }) => {
          updates.push(arg);
          return {};
        }),
      },
      adminWorkerSourceRead: {
        findMany: vi.fn(async () => [{ id: "read-parish", detectedContentType: "PARISH" }]),
      },
      adminWorkerPackageArtifact: { findMany: vi.fn(async () => []) },
      adminWorkerLog: { create: vi.fn(async () => ({})), findFirst: vi.fn(async () => null) },
    } as unknown as Parameters<typeof runRepairOrchestrator>[0];

    const out = await runRepairOrchestrator(prisma);
    expect(out.plansReconciled).toBe(2); // both PARISH plans, not the SAINT one
    // It never re-ran the stale plans as due repairs.
    expect(out.plansAbandoned).toBe(0);
    expect(out.plansExecuted).toBe(0);
    for (const id of ["stale-meta", "stale-read"]) {
      const reconciled = updates.find((u) => u.where.id === id);
      expect(reconciled?.data.status).toBe("SUCCEEDED");
      expect(String(reconciled?.data.finalResult)).toContain("structured-feed-built");
    }
    expect(updates.find((u) => u.where.id === "keep-guide")).toBeUndefined();
  });

  it("auto-reconciles moot artifact plans: healed / duplicate-consumed / dangling", async () => {
    // Three EXTRACT_FAILED plans that can no longer achieve anything:
    //  1. its artifact is already CHECKLIST_READY (healed by a duplicate
    //     extraction) — repair achieved;
    //  2. its source read was consumed as DUPLICATE — nothing to re-extract;
    //  3. neither the read nor the artifact exists any more (dangling).
    // Without reconciliation each burns 5 attempts and abandons — the live
    // "Repair orchestrator FAIL: 31 abandoned in last 7d" spiral.
    const updates: Array<{ where: { id: string }; data: Record<string, unknown> }> = [];
    let findManyCall = 0;
    const prisma = {
      adminWorkerRepairPlan: {
        findMany: vi.fn(async () => {
          findManyCall += 1;
          if (findManyCall === 1) {
            return [
              {
                id: "plan-healed",
                kind: "EXTRACT_FAILED",
                failedEntity: "art-healed",
                metadata: { artifactId: "art-healed", contentType: "CHURCH_DOCUMENT" },
              },
              {
                id: "plan-dup",
                kind: "EXTRACT_FAILED",
                failedEntity: "www.vatican.va",
                metadata: { sourceReadId: "read-dup" },
              },
              {
                id: "plan-dangling",
                kind: "EXTRACT_FAILED",
                failedEntity: "art-gone",
                metadata: { artifactId: "art-gone", contentType: "SAINT" },
              },
              // Still-live plan (artifact broken, read present) — untouched.
              {
                id: "plan-live",
                kind: "EXTRACT_FAILED",
                failedEntity: "art-live",
                metadata: {
                  artifactId: "art-live",
                  sourceReadId: "read-live",
                  contentType: "SAINT",
                },
                // Not due (future nextAttemptAt) so the main loop skips it.
                nextAttemptAt: new Date(Date.now() + 3_600_000),
                attempts: 0,
                maxAttempts: 5,
              },
            ];
          }
          return [];
        }),
        update: vi.fn(async (arg: { where: { id: string }; data: Record<string, unknown> }) => {
          updates.push(arg);
          return {};
        }),
      },
      adminWorkerSourceRead: {
        findMany: vi.fn(async () => [
          { id: "read-dup", detectedContentType: "DUPLICATE" },
          { id: "read-live", detectedContentType: "SAINT" },
        ]),
      },
      adminWorkerPackageArtifact: {
        findMany: vi.fn(async () => [
          { id: "art-healed", contentType: "CHURCH_DOCUMENT", status: "CHECKLIST_READY" },
          { id: "art-live", contentType: "SAINT", status: "NEEDS_REPAIR" },
        ]),
      },
      adminWorkerLog: { create: vi.fn(async () => ({})), findFirst: vi.fn(async () => null) },
    } as unknown as Parameters<typeof runRepairOrchestrator>[0];

    const out = await runRepairOrchestrator(prisma);
    expect(out.plansReconciled).toBe(3);
    const byId = (id: string) => updates.find((u) => u.where.id === id);
    expect(byId("plan-healed")?.data.status).toBe("SUCCEEDED");
    expect(String(byId("plan-healed")?.data.finalResult)).toContain("repair already achieved");
    expect(byId("plan-dup")?.data.status).toBe("SUCCEEDED");
    expect(String(byId("plan-dup")?.data.finalResult)).toContain("DUPLICATE");
    expect(byId("plan-dangling")?.data.status).toBe("SUCCEEDED");
    expect(String(byId("plan-dangling")?.data.finalResult)).toContain("dangling");
    expect(byId("plan-live")).toBeUndefined();
  });

  it("schedules a backoff retry when execution fails", async () => {
    // Replace cache flag to throw.
    const { flagCacheRefresh } = await import("@/lib/admin-worker/repair");
    vi.mocked(flagCacheRefresh).mockRejectedValueOnce(new Error("boom"));
    const { prisma, updates } = makePrisma([
      {
        id: "p4",
        kind: "CACHE_FAILED",
        failedEntity: "tag-x",
        repairAction: "refresh cache",
        status: "PENDING",
        attempts: 0,
        maxAttempts: 3,
        lastAttemptAt: null,
        nextAttemptAt: null,
      },
    ]);
    const result = await runRepairOrchestrator(prisma);
    expect(result.plansFailed).toBe(1);
    const retry = updates.find((u) => u.data.status === "PENDING" && u.data.attempts === 1);
    expect(retry).toBeTruthy();
    expect(retry?.data.nextAttemptAt).toBeInstanceOf(Date);
  });

  it("dispatches DISCOVERY_FAILED to the DiscoveryOrchestrator", async () => {
    const { prisma } = makePrisma([
      {
        id: "p5",
        kind: "DISCOVERY_FAILED",
        failedEntity: "PRAYER",
        repairAction: "discovery",
        status: "PENDING",
        attempts: 0,
        maxAttempts: 5,
        lastAttemptAt: null,
        nextAttemptAt: null,
      },
    ]);
    await runRepairOrchestrator(prisma);
    const { runDiscoveryOrchestrator } = await import("@/lib/admin-worker/discovery-orchestrator");
    expect(vi.mocked(runDiscoveryOrchestrator)).toHaveBeenCalled();
  });

  it("returns zero counts when no plans are due", async () => {
    const future = new Date(Date.now() + 10 * 60 * 1000);
    const { prisma } = makePrisma([
      {
        id: "p6",
        kind: "CACHE_FAILED",
        failedEntity: "tag",
        repairAction: "cache",
        status: "PENDING",
        attempts: 0,
        maxAttempts: 5,
        lastAttemptAt: null,
        nextAttemptAt: future,
      },
    ]);
    // findMany default returns all rows in our mock — to simulate "no plans
    // due", return an empty array for BOTH the reconcile sweep and the main
    // due-plan fetch.
    (prisma.adminWorkerRepairPlan.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const result = await runRepairOrchestrator(prisma);
    expect(result.plansConsidered).toBe(0);
    expect(result.plansExecuted).toBe(0);
  });
});
