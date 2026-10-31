/**
 * The "why no content growth" diagnostic must FIRST report the worker-level
 * gates that turn off every publishing path (curated, structured, AND the
 * fetcher chain): the worker process not running and the worker paused. These
 * are the most common reason a worker that was growing suddenly plateaus, and
 * the pipeline walk underneath can't see them — so the diagnostic would
 * otherwise mislead.
 *
 * A degraded Python brain is NOT such a gate any more: the curated,
 * structured, liturgical and OSM lanes keep publishing in safe-degraded mode
 * (worker-lanes.ts), and only the web funnel waits for the brain. The walk
 * therefore records it, keeps going so a real funnel blocker (no candidates,
 * failing fetches) is still named, and reports BRAIN_DEGRADED where the funnel
 * stops on the brain — with an explanation that says what keeps growing.
 */
import { describe, expect, it } from "vitest";

import type { PrismaClient } from "@prisma/client";
import { diagnoseWhyNoGrowth } from "@/lib/admin-worker/why-no-growth";

function prismaWith(opts: {
  lastHeartbeatAt: Date | null;
  paused?: boolean;
  pausedReason?: string | null;
  finalBrain?: string | null;
  /** Master switch row; undefined → the memory model is absent (switch unreadable). */
  masterSwitchOn?: boolean;
  /** Candidate URLs (all of them prioritized). Default 600. */
  candidates?: number;
  /** Fetch attempts in the last 24h, and how many succeeded. Default 0. */
  recentFetches?: number;
  successfulFetches?: number;
}): PrismaClient {
  const recentFetches = opts.recentFetches ?? 0;
  return {
    ...(opts.masterSwitchOn === undefined
      ? {}
      : {
          adminWorkerMemory: {
            findUnique: async ({
              where,
            }: {
              where: { memoryType_memoryKey: { memoryKey: string } };
            }) =>
              where.memoryType_memoryKey.memoryKey === "worker.execution.switch"
                ? { memoryValue: { on: opts.masterSwitchOn }, updatedAt: new Date() }
                : null,
          },
        }),
    // Downstream funnel models: 600 prioritized candidates and nothing fetched,
    // so a walk that wrongly continues past an OFF worker lands on
    // FETCH_NOT_RUNNING.
    candidateSourceUrl: { count: async () => opts.candidates ?? 600 },
    adminWorkerFetchResult: {
      count: async ({ where }: { where?: { succeeded?: boolean } } = {}) =>
        where?.succeeded ? (opts.successfulFetches ?? recentFetches) : recentFetches,
    },
    // A healthy funnel past the fetcher, so a walk that gets that far reports
    // what is really left.
    adminWorkerSourceRead: { count: async () => 10 },
    adminWorkerSourceBlock: { count: async () => 40 },
    adminWorkerPackageArtifact: { count: async () => 5 },
    adminWorkerCrossSourceVerification: { count: async () => 3 },
    adminWorkerStrictQAResult: { findMany: async () => [] },
    contentQualityScore: { findMany: async () => [] },
    publishedContent: { count: async () => 5 },
    postPublishVerification: { count: async () => 0 },
    contentGoal: {
      findFirst: async () => ({ contentType: "SAINT", gapCount: 100 }),
      count: async () => 15,
    },
    adminWorkerState: {
      findFirst: async () => ({
        lastHeartbeatAt: opts.lastHeartbeatAt,
        paused: opts.paused ?? false,
        pausedReason: opts.pausedReason ?? null,
      }),
    },
    adminWorkerLog: {
      findFirst: async () =>
        opts.finalBrain === undefined ? null : { safeMetadata: { finalBrain: opts.finalBrain } },
    },
    // Lets the "active" scenario walk past the gates and land on the next
    // downstream blocker instead of throwing on an unmocked model.
    authoritySource: { count: async () => 5 },
    adminWorkerDecision: { findFirst: async () => null },
  } as unknown as PrismaClient;
}

const minsAgo = (m: number) => new Date(Date.now() - m * 60_000);

describe("why-no-growth worker gates", () => {
  it("reports WORKER_NOT_RUNNING when the heartbeat is stale", async () => {
    const r = await diagnoseWhyNoGrowth(prismaWith({ lastHeartbeatAt: minsAgo(20) }));
    expect(r.blocker).toBe("WORKER_NOT_RUNNING");
    expect(r.exactTable).toContain("lastHeartbeatAt");
  });

  it("reports WORKER_NOT_RUNNING when there is no heartbeat at all", async () => {
    const r = await diagnoseWhyNoGrowth(prismaWith({ lastHeartbeatAt: null }));
    expect(r.blocker).toBe("WORKER_NOT_RUNNING");
  });

  it("reports WORKER_PAUSED when live but paused by an operator", async () => {
    const r = await diagnoseWhyNoGrowth(
      prismaWith({ lastHeartbeatAt: minsAgo(1), paused: true, pausedReason: "maintenance" }),
    );
    expect(r.blocker).toBe("WORKER_PAUSED");
    expect(r.blockerExplanation).toContain("maintenance");
  });

  it("reports BRAIN_DEGRADED where the funnel stops on the brain (no fetches)", async () => {
    const r = await diagnoseWhyNoGrowth(
      prismaWith({ lastHeartbeatAt: minsAgo(1), finalBrain: "degraded" }),
    );
    expect(r.blocker).toBe("BRAIN_DEGRADED");
    expect(r.blockerExplanation).toContain("safe-degraded");
    // No fetches is the brain's symptom, not a fetcher fault to repair.
    expect(r.nextAutomaticRepair).toMatch(/Python intelligence service/);
  });

  it("passes all worker gates when live, unpaused, and brain active (python)", async () => {
    const r = await diagnoseWhyNoGrowth(
      prismaWith({ lastHeartbeatAt: minsAgo(1), finalBrain: "python" }),
    );
    // Not one of the worker-level blockers — the walk proceeds past them.
    expect(["WORKER_NOT_RUNNING", "WORKER_PAUSED", "BRAIN_DEGRADED"]).not.toContain(r.blocker);
    const gates = r.checks.filter((c) =>
      ["WORKER_NOT_RUNNING", "WORKER_PAUSED", "BRAIN_DEGRADED"].includes(c.stage),
    );
    expect(gates.every((c) => c.ok)).toBe(true);
  });
});

/**
 * OFF is an answer, not a symptom: with the master switch off the funnel
 * underneath legitimately shows no fetches, and the walk used to name
 * FETCH_NOT_RUNNING ("check the worker heartbeat") two lines under the OFF
 * check.
 */
describe("why-no-growth: intentionally OFF worker", () => {
  it("reports WORKER_OFF and stops the funnel walk when the switch is OFF and no heartbeat", async () => {
    const r = await diagnoseWhyNoGrowth(
      prismaWith({ lastHeartbeatAt: minsAgo(2 * 24 * 60), masterSwitchOn: false }),
    );
    expect(r.blocker).toBe("WORKER_OFF");
    expect(r.blockerExplanation).toMatch(/intentionally inactive/);
    expect(r.exactTable).toBe("AdminWorkerMemory(worker.execution.switch)");
    expect(r.nextAutomaticRepair).toMatch(/switch the Admin Worker ON/);
    // The downstream stages are recorded but never promoted to the blocker.
    expect(r.checks.find((c) => c.stage === "WORKER_OFF")?.ok).toBe(false);
    expect(r.checks.some((c) => c.stage === "FETCH_NOT_RUNNING")).toBe(true);
  });

  it("walks the funnel normally when the switch is OFF but a live heartbeat exists (npm run worker:local)", async () => {
    const r = await diagnoseWhyNoGrowth(
      prismaWith({ lastHeartbeatAt: minsAgo(1), masterSwitchOn: false, finalBrain: "python" }),
    );
    expect(r.blocker).not.toBe("WORKER_OFF");
    expect(r.blocker).not.toBe("WORKER_NOT_RUNNING");
  });

  it("does not treat an unreadable switch as OFF (falls back to the heartbeat evidence)", async () => {
    const r = await diagnoseWhyNoGrowth(prismaWith({ lastHeartbeatAt: minsAgo(20) }));
    expect(r.blocker).toBe("WORKER_NOT_RUNNING");
  });
});

describe("why-no-growth: a degraded brain pauses the web funnel only", () => {
  const degraded = (over: Parameters<typeof prismaWith>[0]) =>
    diagnoseWhyNoGrowth(
      prismaWith({ lastHeartbeatAt: minsAgo(1), finalBrain: "degraded", ...over }),
    );

  it("says what keeps growing instead of claiming every publishing path stopped", async () => {
    const r = await degraded({ lastHeartbeatAt: minsAgo(1), recentFetches: 10 });
    // Healthy funnel, recent fetches: nothing but the brain stands in the way.
    expect(r.blocker).toBe("BRAIN_DEGRADED");
    expect(r.blockerExplanation).toMatch(/WEB funnel is paused/);
    expect(r.blockerExplanation).toMatch(
      /Curated, structured \(Wikidata\), liturgical and OSM parish growth continue/,
    );
    expect(r.blockerExplanation).not.toMatch(/does NOT publish|Every publishing path/);
    expect(r.nextWorkerDecision).toMatch(/safe-degraded/);
    const brain = r.checks.find((c) => c.stage === "BRAIN_DEGRADED");
    expect(brain?.ok).toBe(false);
    expect(brain?.label).toMatch(/web funnel/);
    // The walk went on past the brain check.
    expect(r.checks.some((c) => c.stage === "POST_PUBLISH_FAILING")).toBe(true);
  });

  it("still names a real funnel blocker upstream of the brain: no candidate URLs", async () => {
    const r = await degraded({ lastHeartbeatAt: minsAgo(1), candidates: 0 });
    expect(r.blocker).toBe("NO_CANDIDATE_URLS");
    expect(r.checks.find((c) => c.stage === "BRAIN_DEGRADED")?.ok).toBe(false);
  });

  it("still names failing fetches", async () => {
    const r = await degraded({
      lastHeartbeatAt: minsAgo(1),
      recentFetches: 10,
      successfulFetches: 2,
    });
    expect(r.blocker).toBe("FETCH_FAILING");
  });
});
