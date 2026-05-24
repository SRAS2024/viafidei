/**
 * Content goal derivation + default seeds. The seeds must cover every
 * checklist content type the existing master checklists support so
 * the worker never finds a content type with no goal.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_GOAL_SEEDS, deriveStatus } from "@/lib/admin-worker/content-goals";
import { ChecklistContentType } from "@prisma/client";

describe("Default content goal seeds", () => {
  it("covers every ChecklistContentType", () => {
    const seededTypes = new Set(DEFAULT_GOAL_SEEDS.map((s) => s.contentType));
    for (const ct of Object.values(ChecklistContentType)) {
      expect(seededTypes.has(ct)).toBe(true);
    }
  });

  it("every seed has positive minimum and desired targets", () => {
    for (const seed of DEFAULT_GOAL_SEEDS) {
      expect(seed.minimumTarget).toBeGreaterThan(0);
      expect(seed.desiredTarget).toBeGreaterThanOrEqual(seed.minimumTarget);
    }
  });

  it("every priority is unique so the planner ties always break the same way", () => {
    const priorities = DEFAULT_GOAL_SEEDS.map((s) => s.priority);
    expect(new Set(priorities).size).toBe(priorities.length);
  });
});

describe("deriveStatus", () => {
  it("returns NOT_STARTED for an empty bucket", () => {
    expect(deriveStatus(0, 10, 20)).toBe("NOT_STARTED");
  });
  it("returns IN_PROGRESS below 75% of minimum", () => {
    expect(deriveStatus(3, 10, 20)).toBe("IN_PROGRESS");
  });
  it("returns NEAR_GOAL between 75% and minimum", () => {
    expect(deriveStatus(8, 10, 20)).toBe("NEAR_GOAL");
  });
  it("returns GOAL_MET at or above minimum but below desired", () => {
    expect(deriveStatus(10, 10, 20)).toBe("GOAL_MET");
    expect(deriveStatus(15, 10, 20)).toBe("GOAL_MET");
  });
  it("returns MAINTENANCE at or above desired", () => {
    expect(deriveStatus(20, 10, 20)).toBe("MAINTENANCE");
    expect(deriveStatus(25, 10, 20)).toBe("MAINTENANCE");
  });
});
