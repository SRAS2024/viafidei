/**
 * Source + publishing skill packs — prove the wrappers call the real pipeline
 * functions and map their results correctly: fetch success/failure, publish
 * published/review/blocked, and the unpublish rollback. Heavy modules are mocked
 * so this stays a fast unit test.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/fetcher", () => ({
  adminWorkerFetch: vi.fn(),
}));
vi.mock("@/lib/admin-worker/publish-orchestrator", () => ({
  runPublishOrchestrator: vi.fn(),
}));
vi.mock("@/lib/checklist/publishing", () => ({
  unpublish: vi.fn(async () => ({ published: false })),
}));

import { adminWorkerFetch } from "@/lib/admin-worker/fetcher";
import { runPublishOrchestrator } from "@/lib/admin-worker/publish-orchestrator";
import {
  executeCertifiedSkill,
  noopSkillDeps,
  getSkill,
  ensureSkillsRegistered,
  type SkillContext,
} from "@/lib/admin-worker/skills";

ensureSkillsRegistered();

function ctx(input: Record<string, unknown>, contentType = "PRAYER"): SkillContext {
  return {
    prisma: {} as never,
    input,
    brainActive: true,
    contentType,
    contentSubtype: null,
    targetEntityId: String(input.contentId ?? ""),
  };
}

describe("source pack: fetch_static_html", () => {
  it("succeeds on a stored 200 page and fails (stored) on a rejected fetch", async () => {
    const skill = getSkill("fetch_static_html")!;
    vi.mocked(adminWorkerFetch).mockResolvedValueOnce({
      succeeded: true,
      httpStatus: 200,
      body: "<html>St. Augustine</html>",
      fetchResultRowId: "fr-1",
    } as never);
    const ok = await executeCertifiedSkill(
      skill,
      ctx({ url: "https://www.vatican.va/x" }),
      noopSkillDeps(),
    );
    expect(ok.outcome).toBe("SUCCEEDED");
    expect(ok.execution.outputEntityId).toBe("fr-1");

    vi.mocked(adminWorkerFetch).mockResolvedValueOnce({
      succeeded: false,
      httpStatus: 404,
      body: "",
      rejectionReason: "not found",
      fetchResultRowId: "fr-2",
    } as never);
    const bad = await executeCertifiedSkill(
      skill,
      ctx({ url: "https://www.vatican.va/missing" }),
      noopSkillDeps(),
    );
    expect(bad.outcome).not.toBe("SUCCEEDED");
  });
});

describe("publishing pack: publish_content", () => {
  it("maps a published result to SUCCEEDED", async () => {
    const skill = getSkill("publish_content")!;
    vi.mocked(runPublishOrchestrator).mockResolvedValueOnce({
      kind: "published",
      publishedId: "pub-1",
    } as never);
    const out = await executeCertifiedSkill(
      skill,
      ctx({ contentId: "ci-1", slug: "hail-mary" }),
      noopSkillDeps(),
    );
    expect(out.outcome).toBe("SUCCEEDED");
    expect(out.execution.outputEntityId).toBe("pub-1");
  });

  it("routes a review result to human review (does not publish)", async () => {
    const skill = getSkill("publish_content")!;
    vi.mocked(runPublishOrchestrator).mockResolvedValueOnce({
      kind: "review",
      reason: "proof-based publishing: needs review",
    } as never);
    const out = await executeCertifiedSkill(
      skill,
      ctx({ contentId: "ci-2", slug: "fatima" }, "APPARITION"),
      noopSkillDeps(),
    );
    expect(out.outcome).toBe("HUMAN_REVIEW");
  });

  it("treats a blocked result as a failure routed for repair", async () => {
    const skill = getSkill("publish_content")!;
    vi.mocked(runPublishOrchestrator).mockResolvedValueOnce({
      kind: "blocked",
      blockedBy: "strict-qa",
      reason: "qa failed",
    } as never);
    const out = await executeCertifiedSkill(
      skill,
      ctx({ contentId: "ci-3", slug: "x" }),
      noopSkillDeps(),
    );
    expect(["REPAIR_FILED", "FAILED"]).toContain(out.outcome);
  });

  it("publish_content is high-risk and defines an unpublish rollback", () => {
    const skill = getSkill("publish_content")!;
    expect(skill.riskLevel).toBe("high");
    expect(typeof skill.rollback).toBe("function");
  });
});
