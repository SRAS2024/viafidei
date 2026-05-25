/**
 * Post-publish verification. After publishing a piece of content the
 * Admin Worker verifies the public page actually shipped: the public
 * route loads, the tab placement is correct, search/sitemap see it,
 * and the cache was revalidated.
 *
 * Phase 1 ships the verification record + the rollback shape. The
 * actual HTTP checks (public page load, search hit) land in Phase 2
 * — for now the verifier accepts pre-computed results from the caller
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
 * Rollback decision. After a FAIL verification:
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
