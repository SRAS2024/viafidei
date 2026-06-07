/**
 * Unpublish — the only safe admin publishing operation in the foundation.
 *
 * Public content is created ONLY by the Admin Worker artifact pipeline via
 * `runPublishOrchestrator()` (src/lib/admin-worker/). There is no foundation
 * `publish()` writer. `unpublish()` is retained here because it is a safe
 * admin operation: it only flips `isPublished=false`, never creates public
 * content.
 */

import type { PrismaClient } from "@prisma/client";

export interface PublishResult {
  published: boolean;
  reason: string;
  publishedContentId?: string;
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
