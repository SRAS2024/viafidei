/**
 * Content goal target model. Only SACRAMENT is a closed content type with a
 * true hard maximum (canonicalMax = 7). Every other type is open: the target
 * is a growth milestone, not a cap, and the worker keeps growing past it.
 */

import { describe, expect, it } from "vitest";

import {
  DEFAULT_GOAL_SEEDS,
  deriveStatus,
  contentGoalStatusLabel,
} from "@/lib/admin-worker/content-goals";
import { ChecklistContentType } from "@prisma/client";

describe("Default content goal seeds", () => {
  it("covers every ChecklistContentType", () => {
    const seededTypes = new Set(DEFAULT_GOAL_SEEDS.map((s) => s.contentType));
    for (const ct of Object.values(ChecklistContentType)) {
      expect(seededTypes.has(ct)).toBe(true);
    }
  });

  it("every seed has a positive target goal", () => {
    for (const seed of DEFAULT_GOAL_SEEDS) {
      expect(seed.targetGoal).toBeGreaterThan(0);
    }
  });

  it("ONLY Sacrament has a hard maximum (canonicalMax) — every other type is open", () => {
    for (const seed of DEFAULT_GOAL_SEEDS) {
      if (seed.contentType === "SACRAMENT") {
        expect(seed.canonicalMax).toBe(7);
        expect(seed.targetGoal).toBe(7);
      } else {
        expect(seed.canonicalMax).toBeNull();
      }
    }
  });

  it("uses the spec's growth targets for key open types (no hard maximum)", () => {
    const seed = (t: string) => DEFAULT_GOAL_SEEDS.find((s) => s.contentType === t);
    expect(seed("PARISH")?.targetGoal).toBe(300000);
    expect(seed("PARISH")?.canonicalMax).toBeNull();
    expect(seed("PRAYER")?.targetGoal).toBeGreaterThanOrEqual(1000);
    expect(seed("PRAYER")?.canonicalMax).toBeNull();
    expect(seed("DOCTOR")?.canonicalMax).toBeNull();
    expect(seed("POPE")?.canonicalMax).toBeNull();
  });

  it("every priority is unique so the planner ties always break the same way", () => {
    const priorities = DEFAULT_GOAL_SEEDS.map((s) => s.priority);
    expect(new Set(priorities).size).toBe(priorities.length);
  });
});

describe("deriveStatus — target model", () => {
  it("NOT_STARTED for an empty bucket", () => {
    expect(deriveStatus(0, 1000, null)).toBe("NOT_STARTED");
  });

  it("open type: IN_PROGRESS below 75% of the target", () => {
    expect(deriveStatus(100, 1000, null)).toBe("IN_PROGRESS");
  });

  it("open type: NEAR_GOAL within the last quarter before the target", () => {
    expect(deriveStatus(800, 1000, null)).toBe("NEAR_GOAL");
  });

  it("open type: TARGET_REACHED at the target — and STAYS target-reached past it (continued growth)", () => {
    expect(deriveStatus(1000, 1000, null)).toBe("TARGET_REACHED");
    // Past the target it is still "target reached", never "complete".
    expect(deriveStatus(1500, 1000, null)).toBe("TARGET_REACHED");
  });

  it("closed type (Sacrament): CANONICAL_COMPLETE only at the hard maximum", () => {
    expect(deriveStatus(3, 7, 7)).toBe("IN_PROGRESS");
    expect(deriveStatus(6, 7, 7)).toBe("NEAR_GOAL");
    expect(deriveStatus(7, 7, 7)).toBe("CANONICAL_COMPLETE");
  });
});

describe("contentGoalStatusLabel — dashboard wording", () => {
  it("open type that hit its target shows 'Target reached', never 'complete'", () => {
    const label = contentGoalStatusLabel("TARGET_REACHED");
    expect(label).toBe("Target reached");
    expect(label.toLowerCase()).not.toContain("complete");
  });

  it("'Canonical complete' is reserved for closed types", () => {
    expect(contentGoalStatusLabel("CANONICAL_COMPLETE")).toBe("Canonical complete");
  });

  it("maps the special statuses to readable labels", () => {
    expect(contentGoalStatusLabel("NOT_STARTED")).toBe("Not started");
    expect(contentGoalStatusLabel("IN_PROGRESS")).toBe("In progress");
    expect(contentGoalStatusLabel("MAINTENANCE")).toBe("Maintenance");
    expect(contentGoalStatusLabel("NEEDS_VERIFICATION")).toBe("Needs verification");
    expect(contentGoalStatusLabel("SOURCE_BLOCKED")).toBe("Source blocked");
    expect(contentGoalStatusLabel("STALLED")).toBe("Stalled");
  });
});
