/**
 * Operator-forced single-stage passes. The operator buttons must dispatch the
 * EXACT requested stage (deterministic), not route through the brain's scoring
 * where a different stage could win. These pin the stage mapping and the
 * liveness-safe pass lifecycle, with the dispatcher mocked so no DB/network is
 * touched.
 */
import { describe, expect, it, vi } from "vitest";

const { executeMissionStage } = vi.hoisted(() => ({
  executeMissionStage: vi.fn(async () => ({
    stage: "REPORTING" as const,
    kind: "advanced" as const,
    summary: "forced stage ran",
    built: 0,
    published: 0,
  })),
}));

vi.mock("@/lib/admin-worker/dispatcher", () => ({ executeMissionStage }));

import { runOperatorPass, FORCED_OPERATOR_PASSES } from "@/lib/admin-worker/operator-passes";

function makePrisma() {
  const passUpdate = vi.fn(async () => ({}));
  return {
    __passUpdate: passUpdate,
    adminWorkerPass: {
      create: vi.fn(async () => ({ id: "op1", startedAt: new Date() })),
      update: passUpdate,
      findUnique: vi.fn(async () => ({ startedAt: new Date() })),
    },
    adminWorkerLog: { create: vi.fn(async () => ({ id: "l1" })) },
  } as unknown as Parameters<typeof runOperatorPass>[0];
}

describe("FORCED_OPERATOR_PASSES", () => {
  it("covers the five single-stage buttons and excludes cleanup + content_goal", () => {
    expect(new Set(FORCED_OPERATOR_PASSES)).toEqual(
      new Set(["diagnostics", "report", "security", "source_repair", "source_discovery"]),
    );
    expect(FORCED_OPERATOR_PASSES).not.toContain("cleanup");
    expect(FORCED_OPERATOR_PASSES).not.toContain("content_goal");
  });
});

describe("runOperatorPass — forces the requested stage", () => {
  const cases: Array<[Parameters<typeof runOperatorPass>[1], string]> = [
    ["diagnostics", "REPORTING"],
    ["report", "REPORTING"],
    ["security", "SECURITY_DEFENSE"],
    ["source_repair", "REPAIR"],
    ["source_discovery", "DISCOVERY"],
  ];

  for (const [passType, expectedStage] of cases) {
    it(`${passType} → forces ${expectedStage} (not a brain-scored stage)`, async () => {
      executeMissionStage.mockClear();
      const prisma = makePrisma();
      const result = await runOperatorPass(prisma, passType, { source: "operator" });
      expect(executeMissionStage).toHaveBeenCalledTimes(1);
      const arg = executeMissionStage.mock.calls[0][0] as {
        decision: { missionStage: string; finalBrain?: string };
      };
      expect(arg.decision.missionStage).toBe(expectedStage);
      // Operator/scheduler forcing is NOT a Python-brain decision.
      expect(arg.decision.finalBrain).toBe("candidate");
      expect(result.stage).toBe(expectedStage);
      expect(result.ok).toBe(true);
    });
  }

  it("always closes the pass with a terminal status (liveness-safe)", async () => {
    const prisma = makePrisma();
    await runOperatorPass(prisma, "diagnostics");
    const passUpdate = (prisma as unknown as { __passUpdate: ReturnType<typeof vi.fn> })
      .__passUpdate;
    const statuses = passUpdate.mock.calls.map(
      (c) => (c[0] as { data: { status?: string } }).data.status,
    );
    expect(statuses.every((s) => s !== "RUNNING")).toBe(true);
    expect(statuses.some((s) => s === "SUCCEEDED" || s === "FAILED")).toBe(true);
  });

  it("refuses the removed homepage pass before it opens a pass row", async () => {
    // The local host answers an old command centre's "homepage" with a 400, and
    // any other caller that still names it is turned away here: no RUNNING row
    // is left behind and the dispatcher is never reached.
    executeMissionStage.mockClear();
    const prisma = makePrisma();
    const result = await runOperatorPass(prisma, "homepage" as never);
    expect(result).toMatchObject({ ok: false, outcome: null, error: "no forced stage" });
    expect(prisma.adminWorkerPass.create).not.toHaveBeenCalled();
    expect(executeMissionStage).not.toHaveBeenCalled();
  });

  it("marks the pass FAILED when the dispatcher throws, never leaving it RUNNING", async () => {
    executeMissionStage.mockRejectedValueOnce(new Error("dispatch blew up"));
    const prisma = makePrisma();
    const result = await runOperatorPass(prisma, "security");
    expect(result.ok).toBe(false);
    const passUpdate = (prisma as unknown as { __passUpdate: ReturnType<typeof vi.fn> })
      .__passUpdate;
    const statuses = passUpdate.mock.calls.map(
      (c) => (c[0] as { data: { status?: string } }).data.status,
    );
    expect(statuses.some((s) => s === "FAILED")).toBe(true);
    expect(statuses.every((s) => s !== "RUNNING")).toBe(true);
  });
});
