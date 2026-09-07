/**
 * Post-publish verification. After publishing a piece of content the
 * Admin Worker verifies the public page actually shipped: the public
 * route loads, the tab placement is correct, search/sitemap see it,
 * and the cache was revalidated.
 *
 * The verification record + rollback shape live here. The actual HTTP
 * checks (public page load, search hit) live in post-publish-probe.ts;
 * this module accepts pre-computed results from the caller
 * so the publishing pipeline can record what it confirmed.
 */

import type { PostPublishVerificationResult, PrismaClient } from "@prisma/client";

export interface VerificationChecks {
  contentType: string;
  contentId: string;
  slug: string;
  publicPageCheck: PostPublishVerificationResult;
  tabPlacementCheck: PostPublishVerificationResult;
  searchCheck: PostPublishVerificationResult;
  sitemapCheck: PostPublishVerificationResult;
  cacheCheck: PostPublishVerificationResult;
  errorMessage?: string;
}

/**
 * Aggregate sub-check results into one final result. PASS only when
 * every sub-check passed. FAIL when any sub-check failed. WARN
 * otherwise (eg. some PENDING / WARN).
 */
export function aggregateResult(
  checks: Omit<VerificationChecks, "contentType" | "contentId" | "slug" | "errorMessage">,
): PostPublishVerificationResult {
  const all = [
    checks.publicPageCheck,
    checks.tabPlacementCheck,
    checks.searchCheck,
    checks.sitemapCheck,
    checks.cacheCheck,
  ];
  if (all.includes("FAIL")) return "FAIL";
  if (all.includes("WARN")) return "WARN";
  if (all.includes("PENDING")) return "WARN";
  return "PASS";
}

export async function recordVerification(
  prisma: PrismaClient,
  checks: VerificationChecks,
): Promise<{ id: string; result: PostPublishVerificationResult }> {
  const result = aggregateResult(checks);
  const row = await prisma.postPublishVerification.create({
    data: {
      contentType: checks.contentType,
      contentId: checks.contentId,
      slug: checks.slug,
      publicPageCheck: checks.publicPageCheck,
      tabPlacementCheck: checks.tabPlacementCheck,
      searchCheck: checks.searchCheck,
      sitemapCheck: checks.sitemapCheck,
      cacheCheck: checks.cacheCheck,
      result,
      errorMessage: checks.errorMessage,
    },
    select: { id: true, result: true },
  });
  return row;
}

/**
 * Minimum spacing between two FAIL observations before a failure counts as
 * confirmed. A single probe is not evidence: a Railway redeploy answers 502 for
 * a couple of minutes, an edge rate-limit answers 429, and a mis-pointed origin
 * answers 404 for everything. Ten minutes is longer than any of those windows
 * and always spans separate worker passes, so a confirmed FAIL means the public
 * page was independently missing twice.
 */
export const FAIL_CONFIRMATION_GAP_MS = 10 * 60 * 1000;

/**
 * The most recent verification for this item when it is an as-yet-unconfirmed
 * FAIL — i.e. the first strike. Returns null when the latest row is anything
 * else (PASS / WARN reset the strike count) or when the lookup is impossible.
 * Fail-open: a DB error here must never manufacture a confirmation.
 */
export async function findPriorFailure(
  prisma: PrismaClient,
  opts: { contentType: string; contentId: string },
): Promise<{ id: string; createdAt: Date } | null> {
  let latest: { id: string; result: PostPublishVerificationResult; createdAt: Date } | null;
  try {
    latest = await prisma.postPublishVerification.findFirst({
      where: { contentType: opts.contentType, contentId: opts.contentId },
      orderBy: { createdAt: "desc" },
      select: { id: true, result: true, createdAt: true },
    });
  } catch {
    latest = null;
  }
  if (!latest || latest.result !== "FAIL") return null;
  return { id: latest.id, createdAt: latest.createdAt };
}

/**
 * Rollback decision. After a CONFIRMED FAIL verification (see
 * `findPriorFailure` — the dispatcher's decision tree owns the actual
 * unpublish):
 *   - If the failure mode is clear (page didn't load, 404, schema
 *     mismatch): unpublish + delete the published row.
 *   - If the failure mode is ambiguous (search miss, cache miss):
 *     unpublish + file a human review row.
 */
export function rollbackPlan(
  checks: VerificationChecks,
): "unpublish_and_delete" | "unpublish_and_review" | "no_rollback" {
  if (aggregateResult(checks) === "PASS") return "no_rollback";
  if (checks.publicPageCheck === "FAIL" || checks.tabPlacementCheck === "FAIL") {
    return "unpublish_and_delete";
  }
  return "unpublish_and_review";
}
