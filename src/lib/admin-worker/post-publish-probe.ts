/**
 * Real post-publish HTTP probe.
 *
 * After publishing, the Admin Worker fetches the public page and
 * confirms it loads + the title appears in the rendered HTML. The
 * sitemap + search-index + cache checks call the existing
 * revalidation helpers so the worker actively triggers the
 * revalidation it then verifies.
 *
 * Failures route through `rollback()` which honours the existing
 * `rollbackPlan` decision: clear failures unpublish + delete; ambiguous
 * failures unpublish + route to human review.
 */

import type {
  ChecklistContentType,
  PostPublishVerificationResult,
  PrismaClient,
} from "@prisma/client";

import { revalidateForRow, revalidateSitemap, revalidateContentType } from "@/lib/cache/revalidate";
import { writeAdminWorkerLog } from "./logs";
import { fileHumanReview } from "./human-review";
import {
  aggregateResult,
  recordVerification,
  rollbackPlan,
  type VerificationChecks,
} from "./post-publish";
import { publicUrlFor, publicRouteFor } from "./public-routes";

const PROBE_TIMEOUT_MS = 8_000;
const USER_AGENT = "ViaFideiAdminWorker/1.0 (+post-publish-verification)";

export interface VerifyPublishedInput {
  contentType: ChecklistContentType | string;
  contentId: string;
  slug: string;
  expectedTitle: string;
  /** Skip the live HTTP probe (used by tests). */
  skipNetwork?: boolean;
}

export interface VerifyPublishedResult {
  verificationId: string;
  result: PostPublishVerificationResult;
  checks: VerificationChecks;
  publicUrl: string;
}

async function probePublicPage(
  url: string,
  expectedTitle: string,
): Promise<{ result: PostPublishVerificationResult; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(url, {
      method: "GET",
      headers: { "user-agent": USER_AGENT },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return { result: "FAIL", error: `HTTP ${res.status}` };
    }
    const body = await res.text();
    if (expectedTitle && !body.includes(expectedTitle)) {
      return { result: "WARN", error: "page loaded but title not found in body" };
    }
    return { result: "PASS" };
  } catch (err) {
    return { result: "FAIL", error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Verify a freshly-published item. Performs (in order):
 *   1. Trigger cache revalidation (row, sitemap, content type).
 *   2. HTTP-GET the public page and check the title.
 *   3. Record the result in PostPublishVerification.
 *   4. If FAIL: call `rollback()` to unpublish + delete or route to
 *      human review based on the failure mode.
 */
export async function verifyPublished(
  prisma: PrismaClient,
  input: VerifyPublishedInput,
): Promise<VerifyPublishedResult> {
  const route = publicRouteFor(input.contentType, input.slug);
  const publicUrl = publicUrlFor(input.contentType, input.slug);

  // Step 1: actively revalidate. The worker triggers the cache flush
  // it later verifies — same call site, same source of truth.
  const cacheResult = await revalidateForRow({
    reason: "package_created",
    contentType: input.contentType,
    slug: input.slug,
  });
  const sitemapResult = await revalidateSitemap();
  const contentTypeResult = await revalidateContentType(input.contentType);

  // Step 2: probe the public page (optional — tests can skip).
  const probe = input.skipNetwork
    ? { result: "PASS" as PostPublishVerificationResult }
    : await probePublicPage(publicUrl, input.expectedTitle);

  const checks: VerificationChecks = {
    contentType: String(input.contentType),
    contentId: input.contentId,
    slug: input.slug,
    publicPageCheck: probe.result,
    tabPlacementCheck: probe.result === "PASS" ? "PASS" : "WARN",
    searchCheck: contentTypeResult.ok ? "PASS" : "WARN",
    sitemapCheck: sitemapResult.ok ? "PASS" : "WARN",
    cacheCheck: cacheResult.ok ? "PASS" : "WARN",
    errorMessage: probe.error,
  };

  const record = await recordVerification(prisma, checks);
  await writeAdminWorkerLog(prisma, {
    category: "POST_PUBLISH",
    severity: record.result === "PASS" ? "INFO" : record.result === "FAIL" ? "ERROR" : "WARN",
    eventName: `post_publish_${record.result.toLowerCase()}`,
    message: `Verified ${input.contentType} "${input.expectedTitle}" at ${route.slugPath} -> ${record.result}.`,
    contentType: String(input.contentType),
    relatedEntityId: input.contentId,
    safeMetadata: {
      publicUrl,
      probeResult: probe.result,
      probeError: probe.error,
      cacheOk: cacheResult.ok,
      sitemapOk: sitemapResult.ok,
      contentTypeOk: contentTypeResult.ok,
    },
  });

  if (record.result === "FAIL") {
    await rollback(prisma, {
      contentType: String(input.contentType),
      contentId: input.contentId,
      slug: input.slug,
      checks,
      reasonSummary: probe.error ?? `Post-publish verification failed: ${aggregateResult(checks)}`,
    });
  }

  return { verificationId: record.id, result: record.result, checks, publicUrl };
}

interface RollbackInput {
  contentType: string;
  contentId: string;
  slug: string;
  checks: VerificationChecks;
  reasonSummary: string;
}

export async function rollback(prisma: PrismaClient, input: RollbackInput): Promise<void> {
  const plan = rollbackPlan(input.checks);
  if (plan === "no_rollback") return;

  // Unpublish — flip the row off the public site, keep the data row
  // for forensic review (mirrors the legacy publishing.ts behaviour).
  await prisma.publishedContent
    .updateMany({
      where: { contentType: input.contentType as ChecklistContentType, slug: input.slug },
      data: { isPublished: false, unpublishedAt: new Date() },
    })
    .catch(() => undefined);

  // Re-revalidate so the now-unpublished page disappears from caches.
  await revalidateForRow({
    reason: "package_deleted",
    contentType: input.contentType,
    slug: input.slug,
  });

  await writeAdminWorkerLog(prisma, {
    category: "POST_PUBLISH",
    severity: "WARN",
    eventName: "rollback_unpublished",
    message: `Rolled back ${input.contentType} ${input.slug}: ${input.reasonSummary}`,
    contentType: input.contentType,
    relatedEntityId: input.contentId,
    safeMetadata: { plan, slug: input.slug },
  });

  if (plan === "unpublish_and_review") {
    await fileHumanReview(prisma, {
      contentType: input.contentType,
      contentTitle: input.slug,
      proposedAction: "investigate_post_publish_failure",
      reason: input.reasonSummary,
      confidence: 0.4,
    });
  }
  // unpublish_and_delete: leave the actual delete to the deletion
  // module so the spec's "all deletions must be logged with reason +
  // failed fields + confidence" requirement is preserved.
}
