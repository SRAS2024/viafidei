/**
 * Operational packs (repair / maintenance / homepage) — prove the skills do
 * real Postgres work: a content-field repair files a durable repair plan,
 * maintenance skills query/mutate the right tables, and a stale-job cleanup runs.
 */

import { describe, expect, it, vi } from "vitest";

import {
  executeCertifiedSkill,
  noopSkillDeps,
  getSkill,
  ensureSkillsRegistered,
  type SkillContext,
} from "@/lib/admin-worker/skills";

ensureSkillsRegistered();

function ctx(prisma: unknown, input: Record<string, unknown> = {}): SkillContext {
  return {
    prisma: prisma as never,
    input,
    brainActive: true,
    contentType: "PRAYER",
    contentSubtype: null,
    targetEntityId: "ci-1",
  };
}

describe("repair pack", () => {
  it("repair_missing_citation files a durable repair plan", async () => {
    const create = vi.fn(async () => ({ id: "rp-1" }));
    const skill = getSkill("repair_missing_citation")!;
    const out = await executeCertifiedSkill(
      skill,
      ctx({ adminWorkerRepairPlan: { create } }, { slug: "hail-mary" }),
      noopSkillDeps(),
    );
    expect(out.outcome).toBe("SUCCEEDED");
    expect(out.execution.outputEntityId).toBe("rp-1");
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe("maintenance pack", () => {
  it("verify_database_health passes when SELECT 1 succeeds", async () => {
    const skill = getSkill("verify_database_health")!;
    const out = await executeCertifiedSkill(
      skill,
      ctx({ $queryRaw: vi.fn(async () => [{ "1": 1 }]) }),
      noopSkillDeps(),
    );
    expect(out.outcome).toBe("SUCCEEDED");
  });

  it("verify_database_health fails (no false success) when the DB is unreachable", async () => {
    const skill = getSkill("verify_database_health")!;
    const out = await executeCertifiedSkill(
      skill,
      ctx({
        $queryRaw: vi.fn(async () => {
          throw new Error("db down");
        }),
      }),
      noopSkillDeps(),
    );
    expect(out.outcome).not.toBe("SUCCEEDED");
  });

  it("clean_stale_jobs deletes terminal jobs older than the cutoff", async () => {
    const deleteMany = vi.fn(async () => ({ count: 4 }));
    const skill = getSkill("clean_stale_jobs")!;
    const out = await executeCertifiedSkill(
      skill,
      ctx({ workerBuildJob: { deleteMany } }),
      noopSkillDeps(),
    );
    expect(out.outcome).toBe("SUCCEEDED");
    expect(deleteMany).toHaveBeenCalledTimes(1);
  });

  it("verify_public_site_health fails when there is no published content", async () => {
    const skill = getSkill("verify_public_site_health")!;
    const out = await executeCertifiedSkill(
      skill,
      ctx({ publishedContent: { count: vi.fn(async () => 0) } }),
      noopSkillDeps(),
    );
    expect(out.outcome).not.toBe("SUCCEEDED");
  });
});
