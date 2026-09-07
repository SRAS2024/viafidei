/**
 * Diagnostics honesty fixes:
 *   - liveness/progress ratings (last pass, last task, decision engine,
 *     content goals, heartbeat) must not go FAIL while the worker is
 *     intentionally OFF, and must not go FAIL when the execution state could
 *     not be read at all (database error ≠ worker failure);
 *   - post-publish / public-render / queue ratings are windowed to 7 days and
 *     rated on the recent failure ratio, so one historical FAIL row cannot
 *     pin them red forever;
 *   - the rollback rating surfaces EXPIRED restore-vs-delete reviews (content
 *     the worker unpublished that nobody decided on).
 */
import { describe, expect, it, vi } from "vitest";

import { runAdminWorkerDiagnostics } from "@/lib/admin-worker/diagnostics";

type Where = Record<string, unknown>;

interface Scenario {
  /** "on" | "off" | "unreadable" master switch. */
  execution?: "on" | "off" | "unreadable";
  lastPassAgeMs?: number;
  lastHeartbeatAgeMs?: number;
  /** PostPublishVerification: lifetime total, recent total, recent FAIL (result + publicPageCheck). */
  ppTotal?: number;
  ppRecent?: number;
  ppRecentFail?: number;
  /** WorkerBuildJob lifetime failed, recent failed, recent succeeded. */
  jobsFailed?: number;
  jobsFailedRecent?: number;
  jobsSucceededRecent?: number;
  expiredRollbackReviews?: number;
  goals?: Array<{
    desiredTarget: number;
    currentValidCount: number;
    gapCount: number;
    contentType: string;
  }>;
}

function makePrisma(s: Scenario) {
  const zero = vi.fn(async () => 0);
  const nul = vi.fn(async () => null);
  const empty = vi.fn(async () => []);
  const now = Date.now();

  const memoryFindUnique = vi.fn(
    async (arg: { where: { memoryType_memoryKey: { memoryKey: string } } }) => {
      if (s.execution === "unreadable") throw new Error("connection refused");
      const key = arg.where.memoryType_memoryKey.memoryKey;
      if (key === "worker.execution.switch") {
        return { memoryValue: { on: s.execution !== "off" }, updatedAt: new Date() };
      }
      return null;
    },
  );

  const ppCount = vi.fn(async (arg?: { where?: Where }) => {
    const w = arg?.where ?? {};
    const recent = "createdAt" in w;
    if (w.result === "FAIL" || w.publicPageCheck === "FAIL")
      return recent ? (s.ppRecentFail ?? 0) : 999;
    if (recent) return s.ppRecent ?? 0;
    return s.ppTotal ?? 0;
  });

  const jobCount = vi.fn(async (arg?: { where?: Where }) => {
    const w = arg?.where ?? {};
    const recent = "createdAt" in w;
    if (w.status === "failed") return recent ? (s.jobsFailedRecent ?? 0) : (s.jobsFailed ?? 0);
    if (w.status === "succeeded") return recent ? (s.jobsSucceededRecent ?? 0) : 0;
    return 0;
  });

  const reviewCount = vi.fn(async (arg?: { where?: Where }) => {
    const w = arg?.where ?? {};
    if (w.status === "EXPIRED") return s.expiredRollbackReviews ?? 0;
    return 0;
  });

  const target: Record<string, unknown> = {
    adminWorkerMemory: { findUnique: memoryFindUnique, findMany: empty, count: zero },
    adminWorkerState: {
      findUnique: vi.fn(async () => ({
        id: "singleton",
        paused: false,
        currentBlocker: null,
        currentMode: "CONSTANT_FILL",
        currentPriority: "SAINT",
        lastHeartbeatAt: s.lastHeartbeatAgeMs == null ? null : new Date(now - s.lastHeartbeatAgeMs),
        lastSuccessfulAt: null,
        lastFailedAt: null,
        recoveryAction: null,
      })),
      findFirst: nul,
    },
    adminWorkerPass: {
      findFirst: vi.fn(async () =>
        s.lastPassAgeMs == null
          ? null
          : { startedAt: new Date(now - s.lastPassAgeMs), status: "COMPLETED" },
      ),
      count: zero,
      findMany: empty,
    },
    adminWorkerDecision: { findFirst: nul, count: zero, findMany: empty },
    adminWorkerTask: { findFirst: nul, count: zero, findMany: empty },
    contentGoal: { findMany: vi.fn(async () => s.goals ?? []), count: zero, findFirst: nul },
    publishedContent: { count: zero, findFirst: nul, findMany: empty, groupBy: empty },
    postPublishVerification: { count: ppCount, findFirst: nul, findMany: empty },
    workerBuildJob: { count: jobCount, findFirst: nul, findMany: empty },
    humanReviewQueue: { count: reviewCount, findFirst: nul, findMany: empty },
    adminWorkerRepairPlan: { count: zero, findFirst: nul, findMany: empty, groupBy: empty },
  };
  return new Proxy(target, {
    get(t, prop: string) {
      if (prop in t) return t[prop];
      return { count: zero, findFirst: nul, findMany: empty, groupBy: empty, findUnique: nul };
    },
  }) as unknown as Parameters<typeof runAdminWorkerDiagnostics>[0];
}

async function rating(s: Scenario, key: string) {
  const ratings = await runAdminWorkerDiagnostics(makePrisma(s));
  const r = ratings.find((x) => x.key === key);
  if (!r) throw new Error(`rating ${key} not found`);
  return r;
}

const DAY = 24 * 60 * 60 * 1000;
const staleWorker: Scenario = {
  lastPassAgeMs: 8 * DAY,
  lastHeartbeatAgeMs: 8 * DAY,
  goals: [{ contentType: "SAINT", desiredTarget: 100, currentValidCount: 10, gapCount: 90 }],
};

describe("execution-aware liveness ratings", () => {
  const keys = [
    "admin_worker_last_pass",
    "admin_worker_last_task",
    "admin_worker_brain",
    "admin_worker_content_goals",
    "admin_worker_heartbeat",
  ];

  it("FAIL when the worker is ON but has not run for a week", async () => {
    for (const key of keys) {
      const r = await rating({ ...staleWorker, execution: "on" }, key);
      expect(r.status, key).toBe("fail");
    }
  });

  it("PASS with the 'intentionally inactive' summary when the master switch is OFF", async () => {
    for (const key of keys) {
      const r = await rating({ ...staleWorker, execution: "off" }, key);
      expect(r.status, key).toBe("pass");
      expect(r.summary, key).toMatch(/intentionally inactive/);
      expect(r.recommendedRepair, key).toBeUndefined();
    }
  });

  it("keeps the measured facts in the summary when OFF (age is true, not a fault)", async () => {
    const r = await rating({ ...staleWorker, execution: "off" }, "admin_worker_content_goals");
    expect(r.summary).toMatch(/90 still to build/);
    expect(r.summary).not.toMatch(/STALLED/);
  });

  it("degrades to WARN (never FAIL) when the execution state cannot be read", async () => {
    for (const key of keys) {
      const r = await rating({ ...staleWorker, execution: "unreadable" }, key);
      expect(r.status, key).toBe("warn");
      expect(r.summary, key).toMatch(/could not be read/);
    }
  });
});

describe("windowed post-publish / public-render / queue ratings", () => {
  it("post-publish PASSES with 0 recent failures despite historical FAIL rows", async () => {
    const r = await rating(
      { execution: "on", ppTotal: 500, ppRecent: 40, ppRecentFail: 0 },
      "admin_worker_post_publish",
    );
    expect(r.status).toBe("pass");
    expect(r.summary).toMatch(/40 verified in last 7d, 0 failed/);
  });

  it("post-publish WARNS on a minority of recent failures and FAILS on a majority of ≥3", async () => {
    const warn = await rating(
      { execution: "on", ppTotal: 50, ppRecent: 10, ppRecentFail: 2 },
      "admin_worker_post_publish",
    );
    expect(warn.status).toBe("warn");
    const fail = await rating(
      { execution: "on", ppTotal: 50, ppRecent: 4, ppRecentFail: 3 },
      "admin_worker_post_publish",
    );
    expect(fail.status).toBe("fail");
    // Two samples, both failed → not enough evidence to FAIL.
    const few = await rating(
      { execution: "on", ppTotal: 50, ppRecent: 2, ppRecentFail: 2 },
      "admin_worker_post_publish",
    );
    expect(few.status).toBe("warn");
  });

  it("public render gate is rated on the recent window too", async () => {
    const r = await rating(
      { execution: "on", ppTotal: 500, ppRecent: 40, ppRecentFail: 0 },
      "admin_worker_public_render",
    );
    expect(r.status).toBe("pass");
    const f = await rating(
      { execution: "on", ppTotal: 500, ppRecent: 6, ppRecentFail: 5 },
      "admin_worker_public_render",
    );
    expect(f.status).toBe("fail");
  });

  it("queue rating ignores lifetime failures when recent jobs succeed", async () => {
    const r = await rating(
      { execution: "on", jobsFailed: 80, jobsFailedRecent: 0, jobsSucceededRecent: 12 },
      "admin_worker_queue",
    );
    expect(r.status).toBe("pass");
    expect(r.summary).toMatch(/80 failed lifetime/);
    const f = await rating(
      { execution: "on", jobsFailed: 80, jobsFailedRecent: 9, jobsSucceededRecent: 1 },
      "admin_worker_queue",
    );
    expect(f.status).toBe("fail");
  });
});

describe("rollback rating surfaces expired restore-vs-delete reviews", () => {
  it("is PASS with nothing pending and no expired rollback reviews", async () => {
    const r = await rating({ execution: "on" }, "admin_worker_rollback");
    expect(r.status).toBe("pass");
  });

  it("WARNS and names the hidden content when rollback reviews expired undecided", async () => {
    const r = await rating({ execution: "on", expiredRollbackReviews: 3 }, "admin_worker_rollback");
    expect(r.status).toBe("warn");
    expect(r.summary).toMatch(/3 unpublished item\(s\)/);
    expect(r.recommendedRepair).toMatch(/restore vs delete/);
  });
});
