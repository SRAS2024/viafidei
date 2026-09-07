/**
 * Operational self-awareness — next-best-action derivation (Phase A/F capstone).
 *
 * Pins the mission-aware priority order: paused > open escalations > errored
 * lanes > drain the built backlog (naming the dominant gate) > liveness >
 * continue/generate. Optimises for meaningful progress, not raw activity.
 */
import { describe, expect, it } from "vitest";

import { deriveNextBestAction } from "@/lib/admin-worker/operational-summary";

const base = {
  paused: false,
  working: true,
  buildReadyGates: [] as Array<{ gate: string; count: number }>,
  buildReadyBacklog: 0,
  openEscalations: 0,
  erroredLaneCount: 0,
  currentAction: "DISCOVERY" as string | null,
};

describe("deriveNextBestAction", () => {
  it("paused beats everything", () => {
    expect(deriveNextBestAction({ ...base, paused: true, openEscalations: 3 })).toMatch(/paused/i);
  });

  it("open escalations beat backlog", () => {
    const r = deriveNextBestAction({
      ...base,
      openEscalations: 2,
      buildReadyBacklog: 10,
      buildReadyGates: [{ gate: "AWAITING_QA", count: 10 }],
    });
    expect(r).toMatch(/escalation/i);
  });

  it("errored lanes beat backlog", () => {
    const r = deriveNextBestAction({
      ...base,
      erroredLaneCount: 1,
      buildReadyBacklog: 5,
      buildReadyGates: [{ gate: "AWAITING_QA", count: 5 }],
    });
    expect(r).toMatch(/error-backoff/i);
  });

  it("names the dominant BUILD_READY gate with a concrete hint", () => {
    const r = deriveNextBestAction({
      ...base,
      buildReadyBacklog: 12,
      buildReadyGates: [
        { gate: "AWAITING_VERIFICATION", count: 9 },
        { gate: "AWAITING_QA", count: 3 },
      ],
    });
    expect(r).toMatch(/BUILD_READY backlog \(12/);
    expect(r).toMatch(/AWAITING_VERIFICATION/);
    expect(r).toMatch(/cross-source verification/);
  });

  it("flags a stale heartbeat when nothing else is pending", () => {
    expect(deriveNextBestAction({ ...base, working: false })).toMatch(/heartbeat/i);
  });

  it("otherwise continues the current mission stage", () => {
    expect(deriveNextBestAction({ ...base, currentAction: "EXTRACTION" })).toMatch(/EXTRACTION/);
  });

  it("suggests generating work when idle with no current action", () => {
    expect(deriveNextBestAction({ ...base, currentAction: null })).toMatch(/generate new work/i);
  });

  it("puts undecided unpublished content ahead of pipeline work (below escalations)", () => {
    const r = deriveNextBestAction({
      ...base,
      unpublishedAwaitingDecision: 2,
      buildReadyBacklog: 10,
      buildReadyGates: [{ gate: "AWAITING_QA", count: 10 }],
    });
    expect(r).toMatch(/restore-vs-delete for 2 unpublished/);
    expect(
      deriveNextBestAction({ ...base, unpublishedAwaitingDecision: 2, openEscalations: 1 }),
    ).toMatch(/escalation/i);
  });
});
