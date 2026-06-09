/**
 * Proof-based publishing — proves sensitive Catholic content cannot bypass the
 * proof gate, and non-sensitive content is unaffected. Brain is offline in
 * tests, so sensitive content must fail closed to human review.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/intelligence/store", () => ({
  recordBrainCall: vi.fn(async () => undefined),
}));

import type { PrismaClient } from "@prisma/client";

import { evaluateSensitivePublish, isProofRequired } from "@/lib/admin-worker/proof-publishing";

const prisma = {} as unknown as PrismaClient;

describe("proof-based publishing", () => {
  it("marks the sensitive Catholic categories as proof-required", () => {
    for (const t of ["DOCTRINE", "CHURCH_DOCUMENT", "APPARITION", "PAPAL_DOCUMENT", "LITURGICAL"]) {
      expect(isProofRequired(t)).toBe(true);
    }
    expect(isProofRequired("PRAYER")).toBe(false);
  });

  it("lets non-sensitive content through the normal gates", async () => {
    const d = await evaluateSensitivePublish(prisma, { contentType: "PRAYER" });
    expect(d.proofRequired).toBe(false);
    expect(d.allow).toBe(true);
  });

  it("NEVER auto-publishes sensitive content when the brain is offline (fail-closed)", async () => {
    // Tests run without the brain; a sensitive item must route to review.
    const d = await evaluateSensitivePublish(prisma, {
      contentType: "CHURCH_DOCUMENT",
      evidence: { sources: ["vatican.va"], authorities: ["VATICAN"], citations: ["c"] },
    });
    expect(d.proofRequired).toBe(true);
    expect(d.allow).toBe(false);
    expect(d.action).toBe("review");
    expect(d.humanReviewRequired).toBe(true);
  });
});
