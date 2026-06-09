/**
 * Verification skill pack — proves the gates do real work: required fields,
 * citations, and the sensitive-content proof packet actually pass/fail on the
 * package data and route failures correctly (repair vs human review).
 */

import { describe, expect, it } from "vitest";

import {
  executeCertifiedSkill,
  noopSkillDeps,
  getSkill,
  ensureSkillsRegistered,
  type SkillContext,
} from "@/lib/admin-worker/skills";

ensureSkillsRegistered();

function ctx(input: Record<string, unknown>, contentType = "PRAYER"): SkillContext {
  return { prisma: {} as never, input, brainActive: true, contentType, contentSubtype: null };
}

describe("verification skill pack", () => {
  it("verify_required_fields passes when nothing is missing, repairs when fields are missing", async () => {
    const skill = getSkill("verify_required_fields")!;
    const ok = await executeCertifiedSkill(skill, ctx({ missingFields: [] }), noopSkillDeps());
    expect(ok.outcome).toBe("SUCCEEDED");

    const bad = await executeCertifiedSkill(
      skill,
      ctx({ missingFields: ["title", "body"] }),
      noopSkillDeps(),
    );
    expect(bad.outcome).toBe("REPAIR_FILED");
    expect(bad.verification?.decision).toBe("REPAIR");
  });

  it("verify_citations repairs when there are no citations", async () => {
    const skill = getSkill("verify_citations")!;
    const bad = await executeCertifiedSkill(skill, ctx({ citations: [] }), noopSkillDeps());
    expect(bad.outcome).toBe("REPAIR_FILED");
  });

  it("verify_sensitive_content_proof_packet blocks sensitive content without proof (human review)", async () => {
    const skill = getSkill("verify_sensitive_content_proof_packet")!;
    // CHURCH_DOCUMENT is proof-required; no passing proof → human review.
    const blocked = await executeCertifiedSkill(
      skill,
      ctx({ proofPassed: false }, "CHURCH_DOCUMENT"),
      noopSkillDeps(),
    );
    expect(blocked.outcome).toBe("HUMAN_REVIEW");

    // With a passing proof packet it proceeds.
    const proven = await executeCertifiedSkill(
      skill,
      ctx({ proofPassed: true }, "CHURCH_DOCUMENT"),
      noopSkillDeps(),
    );
    expect(proven.outcome).toBe("SUCCEEDED");

    // A non-sensitive type does not require a proof packet.
    const prayer = await executeCertifiedSkill(skill, ctx({}, "PRAYER"), noopSkillDeps());
    expect(prayer.outcome).toBe("SUCCEEDED");
  });

  it("verify_public_route_support confirms the content type maps to a real route", async () => {
    const skill = getSkill("verify_public_route_support")!;
    const out = await executeCertifiedSkill(skill, ctx({ slug: "hail-mary" }), noopSkillDeps());
    expect(out.outcome).toBe("SUCCEEDED");
  });
});
