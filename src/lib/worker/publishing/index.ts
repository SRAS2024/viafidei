/**
 * Publishing gate.
 *
 * LEGACY — PERMANENTLY REMOVED. The pre-Admin-Worker publish writer is
 * deleted: the ONLY way content becomes public is the Admin Worker
 * artifact pipeline via `runPublishOrchestrator()`. `publish()` now
 * always throws — there is no `ALLOW_LEGACY_PUBLISH` escape hatch and no
 * backwards compatibility. `unpublish()` is retained because it is a safe
 * admin operation (it only flips `isPublished=false`, never creates
 * public content).
 */

import type { PrismaClient } from "@prisma/client";

import type { BuiltContentPackage } from "../types";
import type { QAReport } from "../qa";

/** The legacy publish path is permanently disabled (no escape hatch). */
export const LEGACY_PUBLISH_DISABLED_MESSAGE =
  "Legacy publish path is permanently removed. Public content is created " +
  "ONLY by the Admin Worker artifact pipeline via runPublishOrchestrator(). " +
  "There is no ALLOW_LEGACY_PUBLISH escape hatch.";

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
 * LEGACY — PERMANENTLY REMOVED. Always throws. The Admin Worker artifact
 * pipeline (`runPublishOrchestrator`) is the only publish path.
 */
export async function publish(_prisma: PrismaClient, _input: PublishInput): Promise<PublishResult> {
  // LEGACY publish path is permanently removed — no escape hatch, no
  // backwards compatibility. Public content is created only by the
  // Admin Worker artifact pipeline via runPublishOrchestrator().
  throw new Error(LEGACY_PUBLISH_DISABLED_MESSAGE);
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
