/**
 * Publishing gate.
 *
 * Only QA-approved content reaches the public site. The publishing gate
 * here is the single chokepoint:
 *   - rejects packages whose QA report failed
 *   - rejects packages needing human review until reviewed
 *   - writes to PublishedContent and stamps publishedAt
 *   - on unpublish, sets isPublished=false but keeps the row + version
 */

import type { ChecklistContentType, PrismaClient, SourceAuthorityLevel } from "@prisma/client";

import type { BuiltContentPackage } from "../types";
import type { QAReport } from "../qa";

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
