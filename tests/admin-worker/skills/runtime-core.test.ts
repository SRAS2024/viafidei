/**
 * Certified Admin Skill Runtime — core lifecycle proof (no DB).
 * Proves preflight, execution, verification, retry, rollback, idempotency,
 * circuit breaker, failure routing, and ledger recording all work.
 */

import { describe, expect, it, vi } from "vitest";

import {
  executeCertifiedSkill,
  noopSkillDeps,
  type CertifiedSkill,
  type SkillContext,
  type SkillRuntimeDeps,
} from "@/lib/admin-worker/skills";

function ctx(over: Partial<SkillContext> = {}): SkillContext {
  return {
    prisma: {} as never,
    input: { url: "https://www.vatican.va/x" },
    brainActive: true,
    contentType: "PRAYER",
    contentSubtype: null,
    ...over,
  };
}

function skill(over: Partial<CertifiedSkill> = {}): CertifiedSkill {
  return {
    name: "test_skill",
    purpose: "test",
    category: "SOURCE",
    version: "1",
    contentTypes: ["*"],
    contentSubtypes: [],
    inputs: ["url"],
    outputs: ["ok"],
    preconditions: [],
    requiredPermissions: [],
    riskLevel: "low",
    idempotencyKey: (c) => `test:${String(c.input.url)}`,
    execute: async () => ({ status: "SUCCEEDED", output: { ok: true } }),
    verify: async () => ({ ok: true, decision: "PROCEED", checks: [] }),
    retryPolicy: { maxAttempts: 3, backoff: "none", retryableClasses: ["RETRYABLE"] },
    failureClassifier: () => "RETRYABLE",
    successMetrics: [],
    testsRequired: [],
    brainOps: [],
    safetyGates: [],
    humanReviewRequired: false,
    allowedInSafeDegradedMode: false,
    ...over,
  };
}

function deps(over: Partial<SkillRuntimeDeps> = {}): SkillRuntimeDeps {
  return { ...noopSkillDeps(), ...over };
}

describe("skill executor lifecycle", () => {
  it("runs preflight -> execute -> verify -> ledger on success", async () => {
    const recordExecution = vi.fn(async () => "led-1");
    const run = await executeCertifiedSkill(skill(), ctx(), deps({ recordExecution }));
    expect(run.outcome).toBe("SUCCEEDED");
    expect(run.execution.status).toBe("SUCCEEDED");
    expect(run.verification?.decision).toBe("PROCEED");
    expect(run.ledgerId).toBe("led-1");
    expect(recordExecution).toHaveBeenCalledTimes(1);
  });

  it("blocks a brain-required skill in safe degraded mode", async () => {
    const run = await executeCertifiedSkill(
      skill({ allowedInSafeDegradedMode: false }),
      ctx({ brainActive: false }),
      deps(),
    );
    expect(run.outcome).toBe("BLOCKED");
    expect(run.execution.status).toBe("BLOCKED");
  });

  it("skips when the idempotency key is already complete", async () => {
    const run = await executeCertifiedSkill(
      skill(),
      ctx(),
      deps({ isIdempotentDone: async () => true }),
    );
    expect(run.outcome).toBe("SKIPPED_IDEMPOTENT");
  });

  it("blocks when the circuit breaker is open", async () => {
    const run = await executeCertifiedSkill(
      skill(),
      ctx(),
      deps({ isCircuitOpen: async () => true }),
    );
    expect(run.outcome).toBe("CIRCUIT_OPEN");
  });

  it("retries a retryable failure then succeeds", async () => {
    let n = 0;
    const s = skill({
      execute: async () => {
        n += 1;
        if (n < 2) throw new Error("transient");
        return { status: "SUCCEEDED", output: { ok: true } };
      },
    });
    const run = await executeCertifiedSkill(s, ctx(), deps());
    expect(run.outcome).toBe("SUCCEEDED");
    expect(run.attempts).toBe(2);
  });

  it("rolls back when verification says ROLLBACK", async () => {
    const rollback = vi.fn(async () => ({ status: "ROLLED_BACK" as const }));
    const s = skill({
      riskLevel: "high",
      rollback,
      verify: async () => ({ ok: false, decision: "ROLLBACK", checks: [] }),
    });
    const run = await executeCertifiedSkill(s, ctx(), deps());
    expect(run.outcome).toBe("ROLLED_BACK");
    expect(rollback).toHaveBeenCalledTimes(1);
  });

  it("files a developer request after repeated NEEDS_DEVELOPER failures", async () => {
    const fileDeveloperRequest = vi.fn(async () => undefined);
    const s = skill({
      execute: async () => ({ status: "FAILED", failureReason: "no skill" }),
      failureClassifier: () => "NEEDS_DEVELOPER",
      retryPolicy: {
        maxAttempts: 1,
        backoff: "none",
        retryableClasses: [],
        developerRequestAfter: 1,
      },
    });
    const run = await executeCertifiedSkill(s, ctx(), deps({ fileDeveloperRequest }));
    expect(run.outcome).toBe("DEVELOPER_REQUEST");
    expect(fileDeveloperRequest).toHaveBeenCalledTimes(1);
  });

  it("files a repair plan after a NEEDS_REPAIR failure", async () => {
    const fileRepairPlan = vi.fn(async () => undefined);
    const s = skill({
      execute: async () => ({ status: "FAILED", failureReason: "broken" }),
      failureClassifier: () => "NEEDS_REPAIR",
      retryPolicy: { maxAttempts: 1, backoff: "none", retryableClasses: [], routeToRepairAfter: 1 },
    });
    const run = await executeCertifiedSkill(s, ctx(), deps({ fileRepairPlan }));
    expect(run.outcome).toBe("REPAIR_FILED");
    expect(fileRepairPlan).toHaveBeenCalledTimes(1);
  });

  it("blocks a medium+ risk skill with no rollback (declared not possible)", async () => {
    const run = await executeCertifiedSkill(
      skill({ riskLevel: "high", rollback: undefined }),
      ctx(),
      deps(),
    );
    expect(run.outcome).toBe("BLOCKED");
  });
});
