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

  it("every seed has a positive maximum cap", () => {
    for (const seed of DEFAULT_GOAL_SEEDS) {
      expect(seed.maximumTarget).toBeGreaterThan(0);
    }
  });

  it("pins fixed-by-the-faith caps exactly (7 sacraments, 37 doctors, 266 popes)", () => {
    const cap = (t: string) => DEFAULT_GOAL_SEEDS.find((s) => s.contentType === t)?.maximumTarget;
    expect(cap("SACRAMENT")).toBe(7);
    expect(cap("DOCTOR")).toBe(37);
    expect(cap("POPE")).toBe(266);
  });

  it("every priority is unique so the planner ties always break the same way", () => {
    const priorities = DEFAULT_GOAL_SEEDS.map((s) => s.priority);
    expect(new Set(priorities).size).toBe(priorities.length);
  });
});

describe("deriveStatus (max-only: cap, no minimum)", () => {
  it("returns NOT_STARTED for an empty bucket", () => {
    expect(deriveStatus(0, 20)).toBe("NOT_STARTED");
  });
  it("returns IN_PROGRESS below 75% of the cap", () => {
    expect(deriveStatus(3, 20)).toBe("IN_PROGRESS");
  });
  it("returns NEAR_GOAL within the last quarter before the cap", () => {
    expect(deriveStatus(15, 20)).toBe("NEAR_GOAL");
  });
  it("returns MAINTENANCE at or above the cap", () => {
    expect(deriveStatus(20, 20)).toBe("MAINTENANCE");
    expect(deriveStatus(25, 20)).toBe("MAINTENANCE");
  });
});
