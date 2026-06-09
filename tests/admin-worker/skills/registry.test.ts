/**
 * Certified skill registry self-test: every registered skill is well-formed
 * (has all required attributes), every medium+ risk skill defines rollback, and
 * the extraction pack covers every content type backed by a real extractor.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { listSkills, getSkill, requiresRollback } from "@/lib/admin-worker/skills";
import { ensureSkillsRegistered, resetSkillsForTest } from "@/lib/admin-worker/skills/bootstrap";
import { CONTENT_TYPE_CATALOG } from "@/lib/admin-worker/skills/catalog";

beforeEach(() => {
  resetSkillsForTest();
  ensureSkillsRegistered();
});
afterEach(() => resetSkillsForTest());

describe("certified skill registry", () => {
  it("registers a non-empty catalogue", () => {
    expect(listSkills().length).toBeGreaterThan(0);
  });

  it("every skill defines all required certified attributes", () => {
    for (const s of listSkills()) {
      expect(s.name, "name").toBeTruthy();
      expect(s.purpose, `${s.name}.purpose`).toBeTruthy();
      expect(s.category, `${s.name}.category`).toBeTruthy();
      expect(typeof s.execute, `${s.name}.execute`).toBe("function");
      expect(typeof s.verify, `${s.name}.verify`).toBe("function");
      expect(typeof s.idempotencyKey, `${s.name}.idempotencyKey`).toBe("function");
      expect(typeof s.failureClassifier, `${s.name}.failureClassifier`).toBe("function");
      expect(s.retryPolicy.maxAttempts, `${s.name}.retryPolicy`).toBeGreaterThan(0);
      expect(Array.isArray(s.contentTypes), `${s.name}.contentTypes`).toBe(true);
      expect(Array.isArray(s.brainOps), `${s.name}.brainOps`).toBe(true);
      expect(Array.isArray(s.safetyGates), `${s.name}.safetyGates`).toBe(true);
      expect(typeof s.humanReviewRequired, `${s.name}.humanReviewRequired`).toBe("boolean");
    }
  });

  it("every medium+ risk skill defines a rollback (declared reversibility)", () => {
    for (const s of listSkills()) {
      if (requiresRollback(s)) {
        expect(typeof s.rollback, `${s.name} (${s.riskLevel}) must define rollback`).toBe(
          "function",
        );
      }
    }
  });

  it("extraction is certified for every content type backed by a real extractor", () => {
    for (const c of CONTENT_TYPE_CATALOG) {
      if (c.extractable == null) continue;
      const skill = getSkill(`extract_${c.type.toLowerCase()}`);
      expect(skill, `extract_${c.type.toLowerCase()} should be certified`).not.toBeNull();
      expect(skill!.contentTypes).toContain(c.type);
    }
  });
});
