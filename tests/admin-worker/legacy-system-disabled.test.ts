/**
 * Spec §1: the Admin Worker artifact pipeline is the ONLY active
 * content path. Proves no legacy system can build, publish, or mutate
 * public content:
 *   - the legacy publish() writer throws when disabled
 *   - the dispatcher's PACKAGE_BUILD stage never runs a legacy build
 *   - production readiness FAILS when ALLOW_LEGACY_PUBLISH is set
 *   - the legacy build/publish admin API routes return 410 Gone
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/discovery-orchestrator", () => ({
  runDiscoveryOrchestrator: vi.fn(),
  CONTENT_TYPE_STRATEGIES: {},
}));

// If the dispatcher ever tried to import the legacy engine, this mock
// would make the call explode — proving it is not on the active path.
vi.mock("@/lib/worker", () => ({
  runOneBuildCycle: vi.fn(async () => {
    throw new Error("LEGACY runOneBuildCycle must never be invoked by the dispatcher (spec §1).");
  }),
  isApprovedAuthorityHost: vi.fn(() => true),
}));

import { executeMissionStage } from "@/lib/admin-worker/dispatcher";
import { runOneBuildCycle } from "@/lib/worker";
import type { BrainDecision } from "@/lib/admin-worker/brain";
import { publish, isLegacyPublishAllowed } from "@/lib/worker/publishing";

function decision(stage: string): BrainDecision {
  return {
    chosenMode: "CONSTANT_FILL",
    chosenPriority: "CONTENT_GOAL",
    chosenTaskType: "BUILD_CONTENT",
    passType: "CONTENT_GOAL",
    contentType: null,
    sourceTarget: null,
    expectedResult: "build",
    confidenceScore: 0.9,
    riskScore: 0.1,
    reason: "test",
    fallbackAction: null,
    repairAction: null,
    rulesEvaluated: {},
    memoryUsed: {},
    sourceReputationUsed: [],
    chosenAction: { missionStage: stage },
    rankedAlternatives: [],
    missionStage: stage,
    brainExplanation: "test",
    brainFailure: null,
  } as unknown as BrainDecision;
}

describe("legacy publish writer is hard-disabled (spec §1)", () => {
  it("publish() throws when ALLOW_LEGACY_PUBLISH is not set", async () => {
    const prev = process.env.ALLOW_LEGACY_PUBLISH;
    delete process.env.ALLOW_LEGACY_PUBLISH;
    expect(isLegacyPublishAllowed()).toBe(false);
    await expect(
      publish({} as never, {
        checklistItemId: "ci-1",
        pkg: {} as never,
        qa: {} as never,
      }),
    ).rejects.toThrow(/disabled/i);
    if (prev) process.env.ALLOW_LEGACY_PUBLISH = prev;
  });

  it("the legacy runOneBuildCycle build engine throws when disabled", async () => {
    const prev = process.env.ALLOW_LEGACY_PUBLISH;
    delete process.env.ALLOW_LEGACY_PUBLISH;
    // Import the real module (not the @/lib/worker mock above) to hit
    // the guard at the legacy build-engine entry point.
    const real = await vi.importActual<typeof import("@/lib/worker/index")>("@/lib/worker/index");
    await expect(real.runOneBuildCycle({} as never, "w1")).rejects.toThrow(/disabled/i);
    if (prev) process.env.ALLOW_LEGACY_PUBLISH = prev;
  });
});

describe("dispatcher PACKAGE_BUILD never runs a legacy build (spec §1)", () => {
  it("returns idle (not a legacy build cycle) when no artifact is BUILD_READY", async () => {
    vi.mocked(runOneBuildCycle).mockClear();
    const prisma = {
      adminWorkerPackageArtifact: { findFirst: vi.fn(async () => null) },
    } as unknown as Parameters<typeof executeMissionStage>[0]["prisma"];
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision("PACKAGE_BUILD"),
    });
    expect(out.kind).toBe("idle");
    expect(vi.mocked(runOneBuildCycle)).not.toHaveBeenCalled();
  });
});

describe("production readiness fails when the legacy publish path is enabled (spec §1)", () => {
  function makePrisma() {
    return new Proxy(
      {},
      {
        get() {
          return {
            count: vi.fn(async () => 0),
            findFirst: vi.fn(async () => null),
            findUnique: vi.fn(async () => null),
            findMany: vi.fn(async () => []),
            aggregate: vi.fn(async () => ({})),
            groupBy: vi.fn(async () => []),
          };
        },
      },
    ) as never;
  }

  it("the legacy_publish_disabled check passes when the flag is unset", async () => {
    const prev = process.env.ALLOW_LEGACY_PUBLISH;
    delete process.env.ALLOW_LEGACY_PUBLISH;
    const { runReadiness } = await import("@/lib/admin-worker/readiness");
    const report = await runReadiness(makePrisma());
    const check = report.checks.find((c) => c.key === "legacy_publish_disabled");
    expect(check?.status).toBe("pass");
    if (prev) process.env.ALLOW_LEGACY_PUBLISH = prev;
  });

  it("the legacy_publish_disabled check FAILS when ALLOW_LEGACY_PUBLISH=1", async () => {
    const prev = process.env.ALLOW_LEGACY_PUBLISH;
    process.env.ALLOW_LEGACY_PUBLISH = "1";
    const { runReadiness } = await import("@/lib/admin-worker/readiness");
    const report = await runReadiness(makePrisma());
    const check = report.checks.find((c) => c.key === "legacy_publish_disabled");
    expect(check?.status).toBe("fail");
    if (prev) process.env.ALLOW_LEGACY_PUBLISH = prev;
    else delete process.env.ALLOW_LEGACY_PUBLISH;
  });
});

describe("legacy build/publish admin routes return 410 Gone (spec §1)", () => {
  it("legacyDisabledResponse() is a 410", async () => {
    const { legacyDisabledResponse } = await import("@/lib/worker/legacy-disabled");
    const res = legacyDisabledResponse();
    expect(res.status).toBe(410);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("legacy_path_disabled");
  });
});
