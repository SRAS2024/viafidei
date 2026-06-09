/**
 * Skill Planner: proves the worker only plans through certified skills. A
 * content build plan that references not-yet-certified pipeline skills is
 * honestly flagged non-executable with the missing skills named (so a developer
 * request is filed); a plan over a certified skill is executable; sensitive
 * types require a proof packet step.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  planForDecision,
  ensureSkillsRegistered,
  resetSkillsForTest,
} from "@/lib/admin-worker/skills";

beforeEach(() => {
  resetSkillsForTest();
  ensureSkillsRegistered();
});
afterEach(() => resetSkillsForTest());

describe("skill planner", () => {
  it("includes the certified extractor and names the not-yet-certified steps", () => {
    const plan = planForDecision({ missionStage: "EXTRACTION", contentType: "PRAYER" });
    const extract = plan.steps.find((s) => s.skillName === "extract_prayer");
    expect(extract?.certified).toBe(true);
    // Pipeline skills not yet certified → plan is honestly non-executable.
    expect(plan.executable).toBe(false);
    expect(plan.missingSkills).toContain("fetch_static_html");
    expect(plan.missingSkills).toContain("publish_content");
    expect(plan.rejectedReason).toMatch(/missing certified skills/);
  });

  it("is executable when planning over a single certified skill", () => {
    const plan = planForDecision({
      missionStage: "EXTRACTION",
      contentType: "PRAYER",
      intendedSkill: "extract_prayer",
    });
    expect(plan.steps).toHaveLength(1);
    expect(plan.executable).toBe(true);
    expect(plan.rejectedReason).toBeNull();
  });

  it("requires a proof packet step for sensitive Catholic content", () => {
    const plan = planForDecision({
      missionStage: "PUBLIC_PUBLISH",
      contentType: "CHURCH_DOCUMENT",
    });
    expect(plan.requiresProofPacket).toBe(true);
    expect(plan.steps.map((s) => s.skillName)).toContain("verify_sensitive_content_proof_packet");
  });

  it("rejects a mission stage it has no plan for", () => {
    const plan = planForDecision({ missionStage: "TOTALLY_UNKNOWN_STAGE" });
    expect(plan.executable).toBe(false);
    expect(plan.rejectedReason).toMatch(/no certified skill plan/);
  });
});
