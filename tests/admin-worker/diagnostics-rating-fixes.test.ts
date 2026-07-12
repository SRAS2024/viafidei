/**
 * Developer-audit "Recommended Repairs" fixes: three ratings previously
 * reported FAIL/WARN for reasons that were NOT genuine ill-health —
 *
 *   - Fetcher: counted benign policy rejections (unapproved host, login wall,
 *     JS-only shell, binary/PDF) as transport failures.
 *   - Checklist + citation bridge: used a lifetime `bridged / ALL artifacts`
 *     ratio, so historical REJECTED junk pinned it red forever.
 *   - Strict QA: counted artifacts QA correctly rejected as junk against its
 *     own pass rate.
 *
 * These drive the PUBLIC runAdminWorkerDiagnostics with a where-aware mock so
 * each fix is proven against the exact inputs that used to misreport.
 */
import { describe, expect, it, vi } from "vitest";

import { runAdminWorkerDiagnostics } from "@/lib/admin-worker/diagnostics";

interface Scenario {
  checklistReadyUnbridged?: number;
  bridgedTotal?: number;
  fetchTotal?: number;
  fetchSucceeded?: number;
  fetchPolicyRejected?: number;
  qaRows?: Array<{ packageArtifactId: string; status: string }>;
  rejectedArtifactIds?: string[];
}

type Where = Record<string, unknown>;

function makePrisma(s: Scenario) {
  const zero = vi.fn(async () => 0);
  const nul = vi.fn(async () => null);
  const empty = vi.fn(async () => []);

  const artifactCount = vi.fn(async (arg?: { where?: Where }) => {
    const w = arg?.where ?? {};
    if (w.status === "CHECKLIST_READY" && w.checklistItemId === null) {
      return s.checklistReadyUnbridged ?? 0;
    }
    const cid = w.checklistItemId as { not?: unknown } | undefined;
    if (cid && "not" in cid) return s.bridgedTotal ?? 0; // (recent uses updatedAt; same value here)
    return 0;
  });
  const artifactFindMany = vi.fn(async (arg?: { where?: Where }) => {
    const w = arg?.where ?? {};
    if (w.status === "REJECTED") {
      const ids = ((w.id as { in?: string[] } | undefined)?.in ?? []) as string[];
      return (s.rejectedArtifactIds ?? []).filter((id) => ids.includes(id)).map((id) => ({ id }));
    }
    return [];
  });

  const fetchCount = vi.fn(async (arg?: { where?: Where }) => {
    const w = arg?.where ?? {};
    if (w.succeeded === true) return s.fetchSucceeded ?? 0;
    if (w.succeeded === false && w.errorClass) return s.fetchPolicyRejected ?? 0;
    return s.fetchTotal ?? 0;
  });

  const target: Record<string, unknown> = {
    adminWorkerState: { findUnique: nul },
    adminWorkerPackageArtifact: {
      count: artifactCount,
      findMany: artifactFindMany,
      findFirst: nul,
    },
    adminWorkerFetchResult: { count: fetchCount, findFirst: nul, findMany: empty },
    adminWorkerStrictQAResult: {
      count: zero,
      findMany: vi.fn(async () => s.qaRows ?? []),
      findFirst: vi.fn(async () =>
        s.qaRows?.length ? { createdAt: new Date(), finalScore: 0.9 } : null,
      ),
    },
    adminWorkerRepairPlan: { count: zero, findFirst: nul, findMany: empty, groupBy: empty },
  };
  return new Proxy(target, {
    get(t, prop: string) {
      if (prop in t) return t[prop];
      return { count: zero, findFirst: nul, findMany: empty, groupBy: empty };
    },
  }) as unknown as Parameters<typeof runAdminWorkerDiagnostics>[0];
}

async function rating(s: Scenario, key: string) {
  const ratings = await runAdminWorkerDiagnostics(makePrisma(s));
  const r = ratings.find((x) => x.key === key);
  if (!r) throw new Error(`rating ${key} not found`);
  return r;
}

describe("Fetcher rating excludes benign policy rejections", () => {
  it("is PASS when every non-success is an off-policy/unusable candidate", async () => {
    // 20 attempts: 5 real successes, 15 policy rejections (unapproved host, JS
    // shells, etc.). Old rate = 5/20 = 25% → FAIL. New transport rate = 5/5 = pass.
    const r = await rating(
      { fetchTotal: 20, fetchSucceeded: 5, fetchPolicyRejected: 15 },
      "admin_worker_fetcher",
    );
    expect(r.status).toBe("pass");
  });

  it("still FAILS when genuine transport failures dominate", async () => {
    // 20 attempts, 4 succeeded, 0 policy rejections → 16 real transport failures.
    const r = await rating(
      { fetchTotal: 20, fetchSucceeded: 4, fetchPolicyRejected: 0 },
      "admin_worker_fetcher",
    );
    expect(r.status).toBe("fail");
  });
});

describe("Checklist + citation bridge rating is backlog-based, not lifetime yield", () => {
  it("is PASS with no unbridged CHECKLIST_READY backlog (despite many historical rejects)", async () => {
    // Old logic: bridged 50 / ALL-ever (incl. rejects) → low % → FAIL forever.
    // New logic: nothing awaiting the bridge → caught up → PASS.
    const r = await rating(
      { checklistReadyUnbridged: 0, bridgedTotal: 50 },
      "admin_worker_checklist_bridge",
    );
    expect(r.status).toBe("pass");
  });

  it("is FAIL when a real unbridged backlog piles up", async () => {
    const r = await rating(
      { checklistReadyUnbridged: 40, bridgedTotal: 50 },
      "admin_worker_checklist_bridge",
    );
    expect(r.status).toBe("fail");
  });
});

describe("Strict QA rating excludes artifacts it correctly rejected as junk", () => {
  it("is PASS when the only non-passing results are on artifacts since REJECTED", async () => {
    // 6 PASSED + 4 non-passing, but those 4 artifacts are terminally REJECTED
    // (QA correctly caught junk). Old rate = 6/10 = 60% → WARN. New = 6/6 = PASS.
    const qaRows = [
      ...Array.from({ length: 6 }, (_, i) => ({ packageArtifactId: `ok${i}`, status: "PASSED" })),
      ...Array.from({ length: 4 }, (_, i) => ({
        packageArtifactId: `junk${i}`,
        status: "FAILED",
      })),
    ];
    const r = await rating(
      { qaRows, rejectedArtifactIds: ["junk0", "junk1", "junk2", "junk3"] },
      "admin_worker_strict_qa",
    );
    expect(r.status).toBe("pass");
  });

  it("still WARNs when viable artifacts are genuinely failing (not yet resolved)", async () => {
    const qaRows = [
      ...Array.from({ length: 6 }, (_, i) => ({ packageArtifactId: `ok${i}`, status: "PASSED" })),
      ...Array.from({ length: 4 }, (_, i) => ({
        packageArtifactId: `wait${i}`,
        status: "NEEDS_REPAIR",
      })),
    ];
    const r = await rating({ qaRows, rejectedArtifactIds: [] }, "admin_worker_strict_qa");
    expect(r.status).toBe("warn"); // 6/10 viable = 60% → warn, honestly awaiting repair
  });
});
