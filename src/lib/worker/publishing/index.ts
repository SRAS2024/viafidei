/**
 * Publishing gate.
 *
 * LEGACY — HARD-DISABLED (Admin Worker spec §1). This pre-Admin-Worker
 * publish writer is no longer an active content path: the only way
 * content becomes public is the Admin Worker artifact pipeline via
 * `runPublishOrchestrator()`. `publish()` throws unless the
 * `ALLOW_LEGACY_PUBLISH=1` escape hatch is set (reserved for a
 * one-off data migration under direct operator control). Nothing in
 * the running worker, loop, or dispatcher calls it.
 */

import type { ChecklistContentType, PrismaClient, SourceAuthorityLevel } from "@prisma/client";

import type { BuiltContentPackage } from "../types";
import type { QAReport } from "../qa";

/**
 * Spec §1: the legacy publish path is hard-disabled. Any call throws
 * unless the explicit migration escape hatch is set. This is the
 * single chokepoint that used to write public rows outside the Admin
 * Worker artifact pipeline.
 */
export const LEGACY_PUBLISH_DISABLED_MESSAGE =
  "Legacy publish path is disabled (Admin Worker spec §1). " +
  "Public content is created only by the Admin Worker artifact pipeline " +
  "via runPublishOrchestrator(). Set ALLOW_LEGACY_PUBLISH=1 for a " +
  "supervised one-off migration only.";

export function isLegacyPublishAllowed(): boolean {
  return process.env.ALLOW_LEGACY_PUBLISH === "1";
}

export interface PublishInput {
  checklistItemId: string;
  pkg: BuiltContentPackage;
  qa: QAReport;
  actorUsername?: string;
  buildJobId?: string;
  changeSummary?: string;
  forceReviewBypass?: boolean;
}

export interface PublishResult {
  published: boolean;
  reason: string;
  publishedContentId?: string;
}

/**
 * Attempt to publish a QA-passed package.
 *
 * LEGACY — HARD-DISABLED. Throws unless ALLOW_LEGACY_PUBLISH=1.
 *
 * Refuses if:
 *   - QA report's `passed` is false
 *   - QA recommends "reject"
 *   - Package needs human review and no review has been recorded
 *
 * On success:
 *   - Writes/updates the PublishedContent row
 *   - Marks the ChecklistItem APPROVED → PUBLISHED
 *   - Writes a ChecklistVersion snapshot
 */
export async function publish(prisma: PrismaClient, input: PublishInput): Promise<PublishResult> {
  if (!isLegacyPublishAllowed()) {
    throw new Error(LEGACY_PUBLISH_DISABLED_MESSAGE);
  }
  const { checklistItemId, pkg, qa } = input;

  if (qa.recommendation === "reject") {
    return {
      published: false,
      reason: `QA recommended reject (overall score ${qa.overallScore.toFixed(2)}).`,
    };
  }
  if (qa.needsHumanReview && !input.forceReviewBypass) {
    return {
      published: false,
      reason: "Package requires human review before publishing. Approve via admin UI to bypass.",
    };
  }
  if (!qa.passed && !input.forceReviewBypass) {
    return {
      published: false,
      reason: `QA did not pass. Issues: ${qa.issues.slice(0, 3).join("; ")}`,
    };
  }

  const item = await prisma.checklistItem.findUnique({
    where: { id: checklistItemId },
    select: { id: true, contentType: true, canonicalSlug: true },
  });
  if (!item) {
    return { published: false, reason: `ChecklistItem ${checklistItemId} not found.` };
  }

  const now = new Date();
  const existing = await prisma.publishedContent.findUnique({
    where: { checklistItemId },
  });
  const version = existing ? existing.version + 1 : 1;

  const published = await prisma.publishedContent.upsert({
    where: { checklistItemId },
    update: {
      contentType: pkg.contentType as ChecklistContentType,
      slug: pkg.canonicalSlug,
      title: pkg.title,
      payload: pkg.payload as never,
      authorityLevel: pkg.authorityLevel as SourceAuthorityLevel,
      isPublished: true,
      publishedAt: now,
      unpublishedAt: null,
      version,
    },
    create: {
      checklistItemId,
      contentType: pkg.contentType as ChecklistContentType,
      slug: pkg.canonicalSlug,
      title: pkg.title,
      payload: pkg.payload as never,
      authorityLevel: pkg.authorityLevel as SourceAuthorityLevel,
      isPublished: true,
      publishedAt: now,
      version,
    },
  });

  await prisma.checklistItem.update({
    where: { id: checklistItemId },
    data: {
      approvalStatus: "PUBLISHED",
      publishedAt: now,
      publishedContentRef: published.id,
      publishedByUsername: input.actorUsername,
    },
  });

  await prisma.checklistVersion.create({
    data: {
      checklistItemId,
      version,
      payload: pkg.payload as never,
      buildJobId: input.buildJobId ?? null,
      authorUsername: input.actorUsername,
      changeSummary: input.changeSummary ?? "Published by worker.",
    },
  });

  // Post-publish verification + automatic rollback. The verifier
  // triggers cache revalidation, probes the public page, and on FAIL
  // unpublishes + routes per the rollback plan. We don't fail the
  // publish() call itself on verification failure — the row is on
  // disk and we'd rather record the verification + the rollback than
  // surprise the caller with an exception. Verification errors are
  // logged to AdminWorkerLog by the verifier.
  try {
    // Dynamic import keeps this module independent of the Admin
    // Worker code path for unit tests that don't want the verifier
    // wired in.
    const { verifyPublished } = await import("@/lib/admin-worker/post-publish-probe");
    await verifyPublished(prisma, {
      contentType: pkg.contentType as ChecklistContentType,
      contentId: published.id,
      slug: pkg.canonicalSlug,
      expectedTitle: pkg.title,
      // Skip the live HTTP probe in non-production environments so
      // tests + dev don't make outbound requests.
      skipNetwork: process.env.NODE_ENV !== "production",
    });
  } catch {
    // verifier failures are non-fatal for publish()
  }

  return {
    published: true,
    reason: `Published version ${version}.`,
    publishedContentId: published.id,
  };
}

/**
 * Unpublish — keeps the row, sets isPublished=false, records the change.
 */
export async function unpublish(
  prisma: PrismaClient,
  checklistItemId: string,
  actorUsername?: string,
  reason?: string,
): Promise<PublishResult> {
  const existing = await prisma.publishedContent.findUnique({
    where: { checklistItemId },
  });
  if (!existing) {
    return { published: false, reason: "No published content for this checklist item." };
  }
  await prisma.publishedContent.update({
    where: { checklistItemId },
    data: {
      isPublished: false,
      unpublishedAt: new Date(),
    },
  });
  await prisma.checklistItem.update({
    where: { id: checklistItemId },
    data: {
      approvalStatus: "APPROVED",
      rejectedReason: reason ?? `Unpublished by ${actorUsername ?? "system"}.`,
    },
  });
  return { published: false, reason: reason ?? "Unpublished." };
}
