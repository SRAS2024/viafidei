/**
 * Capability matrix + Prisma-backed runtime deps: proves the worker reports
 * coverage honestly (certified vs missing), files developer requests for
 * missing capabilities, and that the ledger/idempotency/circuit-breaker deps
 * query the durable store correctly.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildCapabilityRows,
  refreshCapabilityMatrix,
  makeSkillRuntimeDeps,
  ensureSkillsRegistered,
  resetSkillsForTest,
} from "@/lib/admin-worker/skills";

beforeEach(() => {
  resetSkillsForTest();
  ensureSkillsRegistered();
});
afterEach(() => resetSkillsForTest());

describe("capability matrix (honest coverage)", () => {
  it("marks extractor-backed types CERTIFIED/REVIEW and unbacked types MISSING", () => {
    const rows = buildCapabilityRows();
    const prayer = rows.find((r) => r.capability === "build:PRAYER");
    const creed = rows.find((r) => r.capability === "build:CREED");
    const diocese = rows.find((r) => r.capability === "build:DIOCESE");
    expect(prayer?.coverageStatus).toBe("CERTIFIED");
    expect(prayer?.certifiedSkillName).toBe("extract_prayer");
    // CREED + DIOCESE have no certified extractor → honestly MISSING.
    expect(creed?.coverageStatus).toBe("MISSING");
    expect(diocese?.coverageStatus).toBe("MISSING");
  });

  it("sensitive types require human review (proof-gated publishing)", () => {
    const rows = buildCapabilityRows();
    const apparition = rows.find((r) => r.capability === "build:APPARITION");
    expect(apparition?.coverageStatus).toBe("REQUIRES_HUMAN_REVIEW");
    expect(apparition?.humanReviewRequired).toBe(true);
  });

  it("refreshCapabilityMatrix upserts rows and files dev requests for MISSING", async () => {
    const capUpserts: unknown[] = [];
    const reqUpserts: unknown[] = [];
    const prisma = {
      adminWorkerSkillCapability: {
        upsert: vi.fn(async (a: unknown) => {
          capUpserts.push(a);
          return {};
        }),
      },
      adminWorkerDeveloperRequest: {
        upsert: vi.fn(async (a: unknown) => {
          reqUpserts.push(a);
          return {};
        }),
      },
    } as never;
    const out = await refreshCapabilityMatrix(prisma);
    expect(out.total).toBeGreaterThan(0);
    expect(out.certified).toBeGreaterThan(0);
    expect(out.missing).toBeGreaterThan(0);
    // at least one missing capability filed a developer request
    expect(reqUpserts.length).toBeGreaterThan(0);
  });
});

describe("prisma-backed runtime deps", () => {
  it("records an execution, detects idempotency, and opens the circuit", async () => {
    const create = vi.fn(async () => ({ id: "exec-1" }));
    const findFirst = vi.fn(async () => ({ id: "prev" }));
    const count = vi.fn(async () => 9);
    const prisma = {
      adminWorkerSkillExecution: { create, findFirst, count },
      adminWorkerSkillCapability: {
        findUnique: vi.fn(async () => null),
        upsert: vi.fn(async () => ({})),
      },
    } as never;
    const deps = makeSkillRuntimeDeps(prisma);

    const id = await deps.recordExecution({
      skillName: "extract_prayer",
      skillVersion: "1",
      inputHash: "h",
      idempotencyKey: "k",
      preflightStatus: "PROCEED",
      executionStatus: "SUCCEEDED",
      verificationStatus: "PROCEED",
      rollbackStatus: "NOT_RUN",
      riskLevel: "low",
      safeToAutoExecute: true,
      humanReviewRequired: false,
      attemptCount: 1,
      durationMs: 5,
    });
    expect(id).toBe("exec-1");
    expect(await deps.isIdempotentDone("extract_prayer", "k")).toBe(true);
    expect(await deps.isCircuitOpen("extract_prayer")).toBe(true); // 9 >= threshold
  });
});
