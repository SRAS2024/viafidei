/**
 * Modes + priority ladder. The Admin Worker uses a deterministic
 * priority ladder; given the same candidate set, `highestPriority`
 * must always pick the same winner.
 */

import { describe, expect, it } from "vitest";

import { ADMIN_WORKER_MODES, describeMode } from "@/lib/admin-worker/modes";
import {
  PRIORITY_ORDER,
  comparePriority,
  highestPriority,
  priorityRank,
} from "@/lib/admin-worker/priorities";

describe("Admin Worker modes", () => {
  it("ships all 9 modes from the spec", () => {
    expect(ADMIN_WORKER_MODES).toHaveLength(9);
  });

  it("describes every mode", () => {
    for (const mode of ADMIN_WORKER_MODES) {
      expect(describeMode(mode.mode)).toEqual(mode);
    }
  });
});

describe("Admin Worker priority ladder", () => {
  it("puts security threat first and maintenance last", () => {
    expect(PRIORITY_ORDER[0]).toBe("SECURITY_THREAT");
    expect(PRIORITY_ORDER[PRIORITY_ORDER.length - 1]).toBe("MAINTENANCE");
  });

  it("ranks priorities deterministically", () => {
    expect(priorityRank("SECURITY_THREAT")).toBe(0);
    expect(priorityRank("WORKER_HEALTH")).toBe(1);
    expect(priorityRank("CONTENT_BUILD")).toBeLessThan(priorityRank("CLEANUP"));
  });

  it("picks the highest priority from a candidate set", () => {
    expect(highestPriority(["MAINTENANCE", "CONTENT_BUILD", "SECURITY_THREAT"])).toBe(
      "SECURITY_THREAT",
    );
    expect(highestPriority(["CLEANUP", "DIAGNOSTICS"])).toBe("DIAGNOSTICS");
    expect(highestPriority([])).toBeNull();
  });

  it("comparePriority is consistent with sort order", () => {
    const shuffled: typeof PRIORITY_ORDER = ["CLEANUP", "SECURITY_THREAT", "CONTENT_BUILD"];
    const sorted = [...shuffled].sort(comparePriority);
    expect(sorted[0]).toBe("SECURITY_THREAT");
  });
});
