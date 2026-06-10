/**
 * Repair skill pack. Infrastructure repairs flag a real cache / sitemap /
 * search refresh; content-field repairs file a durable, targeted repair plan
 * that re-builds the blocked field (the repair-orchestrator executes it). Each
 * repair verifies the corrective action was taken; repeated failure routes to a
 * developer request (via the executor's retry policy) rather than looping.
 */

import { flagCacheRefresh, flagSitemapRefresh, flagSearchRefresh } from "../repair";
import { publicRouteFor } from "../public-routes";
import { makeOpSkill } from "./skill-helpers";
import type { CertifiedSkill, SkillContext } from "./types";

function slug(ctx: SkillContext): string {
  return String((ctx.input as Record<string, unknown>).slug ?? ctx.targetEntityId ?? "");
}

/** A content-field repair: file a durable, targeted repair plan to re-build it. */
function makeFieldRepair(name: string, kind: string, blocker: string): CertifiedSkill {
  return makeOpSkill({
    name,
    purpose: `Repair ${blocker} by filing a targeted re-build the repair-orchestrator executes.`,
    category: "REPAIR",
    run: async (ctx) => {
      const plan = await ctx.prisma.adminWorkerRepairPlan
        .create({
          data: {
            kind: kind as never,
            failedEntity: ctx.targetEntityId ?? slug(ctx),
            repairAction:
              `Repair ${blocker} for ${ctx.contentType ?? "content"} (${slug(ctx)})`.slice(0, 400),
            status: "PENDING",
            metadata: { blocker, contentType: ctx.contentType ?? null, slug: slug(ctx) },
          },
          select: { id: true },
        })
        .catch(() => null);
      return {
        ok: plan != null,
        detail: plan ? `repair plan ${plan.id} filed` : "could not file repair plan",
        outputEntityType: "AdminWorkerRepairPlan",
        outputEntityId: plan?.id ?? null,
      };
    },
  });
}

export const repairSkills: CertifiedSkill[] = [
  // ── Infrastructure repairs: flag a real refresh ──────────────────────────
  makeOpSkill({
    name: "repair_failed_public_route",
    purpose: "Repair a failed public route by flagging a sitemap + cache refresh.",
    category: "REPAIR",
    allowedInSafeDegradedMode: true,
    run: async (ctx) => {
      const tags = publicRouteFor(ctx.contentType ?? "PRAYER", slug(ctx)).cacheTags;
      await flagSitemapRefresh(ctx.prisma);
      const r = await flagCacheRefresh(ctx.prisma, tags[0] ?? "all");
      return { ok: r.succeeded, detail: r.reason };
    },
  }),
  makeOpSkill({
    name: "repair_missing_sitemap_url",
    purpose: "Repair a missing sitemap URL by flagging a sitemap refresh.",
    category: "REPAIR",
    allowedInSafeDegradedMode: true,
    run: async (ctx) => {
      const r = await flagSitemapRefresh(ctx.prisma);
      return { ok: r.succeeded, detail: r.reason };
    },
  }),
  makeOpSkill({
    name: "repair_stale_cache",
    purpose: "Repair stale cache by flagging the content's cache tags for refresh.",
    category: "REPAIR",
    allowedInSafeDegradedMode: true,
    run: async (ctx) => {
      const tag =
        String((ctx.input as Record<string, unknown>).cacheTag ?? "") ||
        (publicRouteFor(ctx.contentType ?? "PRAYER", slug(ctx)).cacheTags[0] ?? "all");
      const r = await flagCacheRefresh(ctx.prisma, tag);
      return { ok: r.succeeded, detail: r.reason };
    },
  }),
  makeOpSkill({
    name: "repair_failed_search_index",
    purpose: "Repair a failed search index by flagging a search refresh.",
    category: "REPAIR",
    allowedInSafeDegradedMode: true,
    run: async (ctx) => {
      const r = await flagSearchRefresh(ctx.prisma);
      return { ok: r.succeeded, detail: r.reason };
    },
  }),
  // ── Content-field repairs: file a targeted repair plan ───────────────────
  makeFieldRepair("repair_missing_title", "QA_MISSING_FIELDS", "missing title"),
  makeFieldRepair("repair_missing_subtitle", "QA_MISSING_FIELDS", "missing subtitle"),
  makeFieldRepair("repair_missing_summary", "QA_MISSING_FIELDS", "missing summary"),
  makeFieldRepair("repair_missing_body", "QA_MISSING_FIELDS", "missing body"),
  makeFieldRepair("repair_missing_section", "QA_MISSING_FIELDS", "missing section"),
  makeFieldRepair("repair_missing_citation", "VALIDATION_EVIDENCE_MISSING", "missing citation"),
  makeFieldRepair("repair_low_authority_source", "VALIDATION_FAILED", "low-authority source"),
  makeFieldRepair("repair_conflicting_claim", "VALIDATION_FAILED", "conflicting claim"),
  makeFieldRepair(
    "repair_uncertain_epistemic_status",
    "VALIDATION_FAILED",
    "uncertain epistemic status",
  ),
  makeFieldRepair("repair_duplicate_candidate", "BUILD_REPEATED_FAILURE", "duplicate candidate"),
  makeFieldRepair(
    "repair_failed_liturgical_context",
    "BUILD_REPEATED_FAILURE",
    "failed liturgical context",
  ),
  makeFieldRepair("repair_failed_ontology_link", "BUILD_REPEATED_FAILURE", "failed ontology link"),
];
