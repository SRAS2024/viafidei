/**
 * No-placeholder enforcement (spec): the Admin Worker must not claim it can
 * perform a task unless a real certified skill backs it — with preflight,
 * execution, verification, a retry policy, declared tests, and a place in the
 * coverage matrix. Anything else must be reported MISSING, not faked.
 */

import { describe, expect, it } from "vitest";

import {
  listSkills,
  getSkill,
  buildCapabilityRows,
  ensureSkillsRegistered,
} from "@/lib/admin-worker/skills";

ensureSkillsRegistered();

const PLACEHOLDER = /\b(todo|stub|not implemented|placeholder|coming soon|fixme|tbd)\b/i;

describe("no-placeholder enforcement", () => {
  it("every certified skill has real preflight, execution, verification, retry, and tests", () => {
    for (const s of listSkills()) {
      expect(typeof s.execute, `${s.name}.execute`).toBe("function");
      expect(typeof s.verify, `${s.name}.verify`).toBe("function");
      expect(typeof s.idempotencyKey, `${s.name}.idempotencyKey`).toBe("function");
      expect(typeof s.failureClassifier, `${s.name}.failureClassifier`).toBe("function");
      expect(s.retryPolicy.maxAttempts, `${s.name}.retryPolicy`).toBeGreaterThan(0);
      // A skill must declare the tests it requires — never zero.
      expect(s.testsRequired.length, `${s.name}.testsRequired`).toBeGreaterThan(0);
      // No placeholder language in the purpose.
      expect(PLACEHOLDER.test(s.purpose), `${s.name}.purpose is a placeholder`).toBe(false);
    }
  });

  it("every medium+ risk skill declares a rollback (reversibility is not faked)", () => {
    for (const s of listSkills()) {
      if (s.riskLevel !== "low") {
        expect(typeof s.rollback, `${s.name} (${s.riskLevel}) rollback`).toBe("function");
      }
    }
  });

  it("the capability matrix never marks something CERTIFIED without a resolvable skill", () => {
    for (const row of buildCapabilityRows()) {
      if (row.coverageStatus === "CERTIFIED" || row.coverageStatus === "REQUIRES_HUMAN_REVIEW") {
        // A claimed (non-missing) capability must name a real, registered skill.
        if (row.certifiedSkillName) {
          expect(getSkill(row.certifiedSkillName), `${row.capability} skill`).not.toBeNull();
        }
      }
      // MISSING rows must NOT claim a certified skill.
      if (row.coverageStatus === "MISSING") {
        expect(row.certifiedSkillName, `${row.capability} should not name a skill`).toBeNull();
      }
    }
  });

  it("does not claim a certified skill for a content type with no extractor (honest MISSING)", () => {
    const rows = buildCapabilityRows();
    for (const t of ["CREED", "DIOCESE", "RELIGIOUS_ORDER", "HOMEPAGE_BLOCK"]) {
      const row = rows.find((r) => r.capability === `build:${t}`);
      expect(row?.coverageStatus, t).toBe("MISSING");
      expect(getSkill(`extract_${t.toLowerCase()}`), `extract_${t.toLowerCase()}`).toBeNull();
    }
  });
});
