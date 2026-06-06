import { describe, expect, it } from "vitest";

import { evaluateAutonomy } from "@/lib/admin-worker/policy";

describe("autonomy + policy engine", () => {
  it("blocks duplicates outright", () => {
    const d = evaluateAutonomy({
      action: "publish",
      confidence: 0.99,
      riskLevel: "low",
      safeToAutoExecute: true,
      duplicate: true,
      currentLevel: "FULL",
    });
    expect(d.decision).toBe("block");
  });

  it("escalates on communion risk", () => {
    const d = evaluateAutonomy({
      action: "publish",
      confidence: 0.99,
      riskLevel: "low",
      communionRisk: 0.7,
      currentLevel: "FULL",
    });
    expect(d.decision).toBe("escalate");
    expect(d.reason).toContain("communion");
  });

  it("escalates an action above the current autonomy level", () => {
    const d = evaluateAutonomy({
      action: "publish",
      confidence: 0.99,
      riskLevel: "low",
      safeToAutoExecute: true,
      currentLevel: "DRAFT_ONLY",
    });
    expect(d.decision).toBe("escalate");
  });

  it("escalates high risk and low confidence", () => {
    expect(
      evaluateAutonomy({
        action: "store",
        confidence: 0.99,
        riskLevel: "high",
        currentLevel: "FULL",
      }).decision,
    ).toBe("escalate");
    expect(
      evaluateAutonomy({ action: "store", confidence: 0.4, riskLevel: "low", currentLevel: "FULL" })
        .decision,
    ).toBe("escalate");
  });

  it("auto-executes a safe, confident, permitted action", () => {
    const d = evaluateAutonomy({
      action: "publish",
      confidence: 0.9,
      riskLevel: "low",
      safeToAutoExecute: true,
      currentLevel: "PUBLISH_SAFE",
    });
    expect(d.decision).toBe("auto");
  });

  it("drafts when permitted but not safe-to-auto", () => {
    const d = evaluateAutonomy({
      action: "store",
      confidence: 0.8,
      riskLevel: "low",
      safeToAutoExecute: false,
      currentLevel: "STORE_SAFE",
    });
    expect(d.decision).toBe("draft");
  });

  it("code patches + schema changes require FULL autonomy", () => {
    const d = evaluateAutonomy({
      action: "schema_change",
      confidence: 0.99,
      riskLevel: "low",
      safeToAutoExecute: true,
      currentLevel: "PUBLISH_SAFE",
    });
    expect(d.decision).toBe("escalate");
  });
});
