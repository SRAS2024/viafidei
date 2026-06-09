/**
 * Publishing skill pack. Real wrappers over the single publish path and the
 * post-publish verifiers. publish_content runs the Publish Orchestrator (full
 * safety + ten-dimension quality gate + proof-based publishing for sensitive
 * Catholic content) and is high-risk with a real unpublish rollback. The
 * verify_* skills confirm the public row, search index, sitemap, and cache.
 * A publish is not "successful" until its verification passes.
 */

import { runPublishOrchestrator, type PublishOrchestratorInput } from "../publish-orchestrator";
import { recordStrictQA, type StrictQAInputs } from "../strict-qa";
import {
  verifySearchIndex,
  verifySitemap,
  verifyCacheFreshness,
} from "../search-sitemap-cache-verifiers";
import { unpublish } from "@/lib/checklist/publishing";
import { check, decideFromChecks } from "./verification";
import type { CertifiedSkill, SkillContext } from "./types";

function inp(ctx: SkillContext): Record<string, unknown> {
  return ctx.input as Record<string, unknown>;
}

function verifyOpts(ctx: SkillContext) {
  return {
    contentType: String(ctx.contentType ?? inp(ctx).contentType ?? ""),
    slug: String(inp(ctx).slug ?? ""),
    title: String(inp(ctx).title ?? ""),
  };
}

export const publishingSkills: CertifiedSkill[] = [
  {
    name: "run_strict_qa",
    purpose: "Score a package through strict QA and record the durable result.",
    category: "PUBLISHING",
    version: "1",
    contentTypes: ["*"],
    contentSubtypes: [],
    inputs: ["package", "qa dimension scores"],
    outputs: ["strictQAArtifactId", "status"],
    preconditions: ["a complete content package"],
    requiredPermissions: ["write_qa"],
    riskLevel: "low",
    idempotencyKey: (ctx) => `run_strict_qa:${String(inp(ctx).artifactId ?? inp(ctx).slug ?? "")}`,
    brainOps: ["score_quality"],
    safetyGates: ["strict_qa"],
    humanReviewRequired: false,
    allowedInSafeDegradedMode: false,
    failureClassifier: () => "NEEDS_REPAIR",
    retryPolicy: { maxAttempts: 1, backoff: "none", retryableClasses: [], routeToRepairAfter: 1 },
    successMetrics: ["qa_passed"],
    testsRequired: ["publishing: run_strict_qa"],
    execute: async (ctx) => {
      const outcome = await recordStrictQA(ctx.prisma, inp(ctx) as unknown as StrictQAInputs);
      const passed = outcome.status === "PASSED";
      return {
        status: passed ? "SUCCEEDED" : "FAILED",
        output: outcome,
        outputEntityType: "AdminWorkerStrictQAResult",
        failureReason: passed ? null : `strict QA ${outcome.status}`,
      };
    },
    verify: async (_ctx, result) => {
      const o = result.output as { status?: string } | undefined;
      return decideFromChecks([check("qa_passed", o?.status === "PASSED", o?.status)], "REPAIR");
    },
  },
  {
    name: "publish_content",
    purpose:
      "Publish a content package through the single Publish Orchestrator path (safety + quality + proof gates). High-risk: reversible by unpublish.",
    category: "PUBLISHING",
    version: "1",
    contentTypes: ["*"],
    contentSubtypes: [],
    inputs: ["PublishOrchestratorInput"],
    outputs: ["publishedId", "kind"],
    preconditions: ["strict QA PASSED", "verifier sign-off for sensitive types"],
    requiredPermissions: ["publish_content"],
    riskLevel: "high",
    requiresProofPacket: true,
    idempotencyKey: (ctx) =>
      `publish_content:${String(ctx.contentType ?? inp(ctx).contentType ?? "")}:${String(inp(ctx).slug ?? "")}`,
    brainOps: ["build_proof_packet"],
    safetyGates: ["strict_qa", "full_quality_model", "proof_based_publishing"],
    humanReviewRequired: false,
    allowedInSafeDegradedMode: false,
    failureClassifier: (err) => {
      const m = err instanceof Error ? err.message : String(err);
      if (/duplicate/i.test(m)) return "NON_RETRYABLE";
      if (/review/i.test(m)) return "NEEDS_HUMAN_REVIEW";
      return "NEEDS_REPAIR";
    },
    // A hard "blocked" publish routes to repair (fix the package); the orchestrator's
    // own "review" result is routed to human review by verify() above. A classifier
    // result of NEEDS_HUMAN_REVIEW still routes to review.
    retryPolicy: { maxAttempts: 1, backoff: "none", retryableClasses: [], routeToRepairAfter: 1 },
    successMetrics: ["published_row", "public_route_loads"],
    testsRequired: ["publishing: publish_content", "e2e: source to public page"],
    execute: async (ctx) => {
      const result = await runPublishOrchestrator(
        ctx.prisma,
        inp(ctx) as unknown as PublishOrchestratorInput,
      );
      if (result.kind === "published") {
        const id =
          (result as unknown as { publishedId?: string; id?: string }).publishedId ??
          (result as unknown as { id?: string }).id ??
          null;
        return {
          status: "SUCCEEDED",
          output: result,
          outputEntityType: "PublishedContent",
          outputEntityId: id,
        };
      }
      // review → routed to human review (not a hard failure); else failure.
      if (result.kind === "review") {
        return { status: "SUCCEEDED", output: result };
      }
      return {
        status: "FAILED",
        output: result,
        failureReason: `${result.kind}: ${(result as { reason?: string }).reason ?? ""}`,
      };
    },
    verify: async (_ctx, result) => {
      const r = result.output as { kind?: string; reason?: string } | undefined;
      if (r?.kind === "review") {
        return {
          ok: false,
          decision: "HUMAN_REVIEW",
          checks: [check("publish_gate", false, r.reason)],
          reason: r.reason ?? "routed to human review",
        };
      }
      const published = r?.kind === "published";
      return {
        ok: published,
        decision: published ? "PROCEED" : "REPAIR",
        checks: [check("published_row", published, r?.kind)],
        reason: published ? undefined : `publish ${r?.kind}`,
      };
    },
    rollback: async (ctx) => {
      const cid = String(inp(ctx).contentId ?? ctx.targetEntityId ?? "");
      if (!cid) return { status: "NOT_POSSIBLE", detail: "no checklistItemId to unpublish" };
      const r = await unpublish(ctx.prisma, cid, "skill-runtime", "rollback publish");
      return r.published === false
        ? { status: "ROLLED_BACK", detail: "content unpublished" }
        : { status: "NOT_NEEDED", detail: r.reason ?? "nothing published" };
    },
  },
  makeVerifyPublishSkill(
    "verify_public_route",
    "Confirm the published public row exists and is live.",
    async (ctx) => {
      const row = await ctx.prisma.publishedContent
        .findFirst({
          where: {
            contentType: String(ctx.contentType ?? inp(ctx).contentType ?? "") as never,
            slug: String(inp(ctx).slug ?? ""),
            isPublished: true,
          },
          select: { id: true },
        })
        .catch(() => null);
      return { ok: row != null, reason: row ? undefined : "no published row" };
    },
  ),
  makeVerifyPublishSkill(
    "verify_search_index",
    "Confirm the item is findable in search.",
    async (ctx) => {
      const r = await verifySearchIndex(ctx.prisma, verifyOpts(ctx));
      return { ok: r.ok, reason: r.reason };
    },
  ),
  makeVerifyPublishSkill(
    "verify_sitemap",
    "Confirm the public URL is in the sitemap.",
    async (ctx) => {
      const r = await verifySitemap(ctx.prisma, {
        contentType: verifyOpts(ctx).contentType,
        slug: verifyOpts(ctx).slug,
      });
      return { ok: r.ok, reason: r.reason };
    },
  ),
  makeVerifyPublishSkill(
    "verify_cache",
    "Confirm the public route serves the latest content.",
    async (ctx) => {
      const r = await verifyCacheFreshness(ctx.prisma, {
        contentType: verifyOpts(ctx).contentType,
        slug: verifyOpts(ctx).slug,
      });
      return { ok: r.ok, reason: r.reason };
    },
  ),
  {
    name: "rollback_publish",
    purpose:
      "Take content off the public site (the fail-safe direction) when a publish must be undone.",
    category: "PUBLISHING",
    version: "1",
    contentTypes: ["*"],
    contentSubtypes: [],
    inputs: ["contentId"],
    outputs: ["unpublished"],
    preconditions: ["a published row to unpublish"],
    requiredPermissions: ["unpublish_content"],
    // Unpublishing is the fail-safe direction (removing public content), so it is
    // low-risk corrective action.
    riskLevel: "low",
    idempotencyKey: (ctx) =>
      `rollback_publish:${String(inp(ctx).contentId ?? ctx.targetEntityId ?? "")}`,
    brainOps: [],
    safetyGates: ["fail_safe_unpublish"],
    humanReviewRequired: false,
    allowedInSafeDegradedMode: true,
    failureClassifier: () => "NEEDS_HUMAN_REVIEW",
    retryPolicy: {
      maxAttempts: 2,
      backoff: "none",
      retryableClasses: ["RETRYABLE"],
      routeToHumanReviewAfter: 2,
    },
    successMetrics: ["unpublished"],
    testsRequired: ["publishing: rollback_publish"],
    execute: async (ctx) => {
      const cid = String(inp(ctx).contentId ?? ctx.targetEntityId ?? "");
      if (!cid) return { status: "FAILED", failureReason: "no checklistItemId" };
      const r = await unpublish(ctx.prisma, cid, "skill-runtime", "rollback_publish skill");
      return {
        status: "SUCCEEDED",
        output: r,
        outputEntityType: "PublishedContent",
        outputEntityId: cid,
      };
    },
    verify: async (_ctx, result) => {
      const r = result.output as { published?: boolean } | undefined;
      return decideFromChecks([check("unpublished", r?.published === false)], "RETRY");
    },
  },
];

/** A low-risk, read-only post-publish verifier skill wrapping a real verifier. */
function makeVerifyPublishSkill(
  name: string,
  purpose: string,
  run: (ctx: SkillContext) => Promise<{ ok: boolean; reason?: string }>,
): CertifiedSkill {
  return {
    name,
    purpose,
    category: "PUBLISHING",
    version: "1",
    contentTypes: ["*"],
    contentSubtypes: [],
    inputs: ["contentType", "slug", "title"],
    outputs: ["ok", "reason"],
    preconditions: ["the content has been published"],
    requiredPermissions: ["read_public"],
    riskLevel: "low",
    idempotencyKey: (ctx) => `${name}:${String((ctx.input as Record<string, unknown>).slug ?? "")}`,
    brainOps: [],
    safetyGates: [name],
    humanReviewRequired: false,
    allowedInSafeDegradedMode: false,
    failureClassifier: () => "NEEDS_REPAIR",
    retryPolicy: {
      maxAttempts: 2,
      backoff: "linear",
      retryableClasses: ["RETRYABLE"],
      routeToRepairAfter: 2,
    },
    successMetrics: ["verified"],
    testsRequired: [`publishing: ${name}`],
    execute: async (ctx) => {
      const r = await run(ctx);
      return {
        status: r.ok ? "SUCCEEDED" : "FAILED",
        output: r,
        failureReason: r.ok ? null : (r.reason ?? `${name} failed`),
      };
    },
    verify: async (_ctx, result) => {
      const r = result.output as { ok?: boolean; reason?: string } | undefined;
      return decideFromChecks([check(name, r?.ok === true, r?.reason)], "REPAIR");
    },
  };
}
