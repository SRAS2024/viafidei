/**
 * Governance decision layer — pins the mapping from a self-assessment to one
 * of continue / retry / skip / pause / escalate / changeStrategy, and that
 * SERIOUS conditions escalate (page the admin) while ordinary ones do not.
 */
import { describe, expect, it } from "vitest";

import { decideGovernance } from "@/lib/admin-worker/governance";
import type {
  SelfAssessment,
  WorkerWarning,
  WarningKind,
} from "@/lib/admin-worker/self-assessment";

function assessment(overrides: Partial<SelfAssessment> = {}): SelfAssessment {
  return {
    generatedAt: new Date(0),
    currentTask: null,
    currentMode: "CONSTANT_FILL",
    currentBlocker: null,
    contentType: "PRAYER",
    windowHours: 6,
    idleMs: 0,
    heartbeatAgeMs: 1000,
    workerLive: true,
    paused: false,
    publishedDelta: 0,
    extractionsInWindow: 0,
    publishesInWindow: 0,
    duplicateWork: 0,
    unpublishedBacklog: 0,
    qualityFailRate: 0,
    retryPatterns: [],
    productive: false,
    warnings: [],
    ...overrides,
  };
}

function warn(kind: WarningKind, severity: "WARN" | "ERROR" = "WARN"): WorkerWarning {
  return {
    kind,
    severity,
    detail: `${kind} detail`,
    signals: [`k=${kind}`],
    contentType: "PRAYER",
  };
}

describe("decideGovernance", () => {
  it("continues when the worker is paused (nothing to govern)", () => {
    const d = decideGovernance(assessment({ paused: true, warnings: [warn("NO_VALUE")] }));
    expect(d.kind).toBe("continue");
    expect(d.escalate).toBe(false);
  });

  it("continues when the worker is offline (liveness handled elsewhere)", () => {
    const d = decideGovernance(
      assessment({ workerLive: false, warnings: [warn("LOOPING", "ERROR")] }),
    );
    expect(d.kind).toBe("continue");
    expect(d.escalate).toBe(false);
  });

  it("continues (no escalation) when there are no warnings", () => {
    const d = decideGovernance(assessment({ publishedDelta: 5, productive: true }));
    expect(d.kind).toBe("continue");
    expect(d.escalate).toBe(false);
  });

  it("escalates on any ERROR-severity warning", () => {
    const d = decideGovernance(assessment({ warnings: [warn("PUBLISHING_LOW_QUALITY", "ERROR")] }));
    expect(d.kind).toBe("escalate");
    expect(d.escalate).toBe(true);
    expect(d.escalation?.kind).toBe("PUBLISHING_LOW_QUALITY");
    // low-quality at ERROR also recommends a pause.
    expect(d.recommendPause).toBe(true);
  });

  it("escalates on serious WARN kinds (extract-without-publish, no-value, storage burn)", () => {
    for (const kind of [
      "EXTRACTING_WITHOUT_PUBLISHING",
      "NO_VALUE",
      "BURNING_STORAGE",
    ] as WarningKind[]) {
      const d = decideGovernance(assessment({ warnings: [warn(kind)] }));
      expect(d.kind, kind).toBe("escalate");
      expect(d.escalate, kind).toBe(true);
    }
  });

  it("maps a LOOPING WARN to changeStrategy without escalating", () => {
    const d = decideGovernance(assessment({ warnings: [warn("LOOPING")] }));
    expect(d.kind).toBe("changeStrategy");
    expect(d.escalate).toBe(false);
  });

  it("maps a REPEATED_TYPE_FAILURE WARN to skip without escalating", () => {
    const d = decideGovernance(assessment({ warnings: [warn("REPEATED_TYPE_FAILURE")] }));
    expect(d.kind).toBe("skip");
    expect(d.escalate).toBe(false);
  });

  it("maps a PUBLISHING_LOW_QUALITY WARN to retry without escalating", () => {
    const d = decideGovernance(assessment({ warnings: [warn("PUBLISHING_LOW_QUALITY")] }));
    expect(d.kind).toBe("retry");
    expect(d.escalate).toBe(false);
    expect(d.recommendPause).toBe(false);
  });

  it("prioritizes the most-serious warning when several are present", () => {
    const d = decideGovernance(
      assessment({
        warnings: [warn("LOOPING"), warn("NO_VALUE"), warn("REPEATED_TYPE_FAILURE")],
      }),
    );
    // NO_VALUE is a serious escalating kind and highest priority.
    expect(d.kind).toBe("escalate");
    expect(d.escalation?.kind).toBe("NO_VALUE");
  });
});
