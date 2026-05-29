/**
 * Spec §13: each subsystem rating must carry an automaticRepairStatus
 * — "in_progress" when an open repair plan maps to it, "available"
 * when it is auto-repairable but no plan is open, "manual" otherwise.
 */

import { describe, expect, it, vi } from "vitest";

import { runAdminWorkerDiagnostics } from "@/lib/admin-worker/diagnostics";

function makePrisma(openKinds: string[]) {
  // Every count/findFirst returns 0/null so ratings compute without
  // error; groupBy returns the open repair-plan kinds we want to test.
  const zero = vi.fn(async () => 0);
  const nul = vi.fn(async () => null);
  const empty = vi.fn(async () => []);
  const model = {
    count: zero,
    findFirst: nul,
    findMany: empty,
    groupBy: vi.fn(async () => openKinds.map((k) => ({ kind: k, _count: { _all: 1 } }))),
  };
  return new Proxy(
    {
      adminWorkerState: { findUnique: nul },
      adminWorkerRepairPlan: {
        ...model,
        groupBy: vi.fn(async () => openKinds.map((k) => ({ kind: k, _count: { _all: 1 } }))),
      },
    },
    {
      get(target: Record<string, unknown>, prop: string) {
        if (prop in target) return target[prop as keyof typeof target];
        // Any other model gets the zero-returning default shape.
        return { count: zero, findFirst: nul, findMany: empty, groupBy: empty };
      },
    },
  ) as unknown as Parameters<typeof runAdminWorkerDiagnostics>[0];
}

describe("runAdminWorkerDiagnostics automatic-repair status (spec §13)", () => {
  it("marks a subsystem in_progress when a mapped repair plan is open", async () => {
    const ratings = await runAdminWorkerDiagnostics(makePrisma(["CACHE_FAILED"]));
    const cache = ratings.find((r) => r.key === "admin_worker_cache");
    expect(cache?.automaticRepairStatus).toBe("in_progress");
  });

  it("marks an auto-repairable subsystem available when no plan is open", async () => {
    const ratings = await runAdminWorkerDiagnostics(makePrisma([]));
    const fetcher = ratings.find((r) => r.key === "admin_worker_fetcher");
    expect(fetcher?.automaticRepairStatus).toBe("available");
  });

  it("marks a non-auto-repairable subsystem manual", async () => {
    const ratings = await runAdminWorkerDiagnostics(makePrisma([]));
    const security = ratings.find((r) => r.key === "admin_worker_security");
    expect(security?.automaticRepairStatus).toBe("manual");
  });

  it("every rating carries an automaticRepairStatus", async () => {
    const ratings = await runAdminWorkerDiagnostics(makePrisma([]));
    expect(ratings.length).toBeGreaterThan(20);
    expect(ratings.every((r) => r.automaticRepairStatus !== undefined)).toBe(true);
  });
});
