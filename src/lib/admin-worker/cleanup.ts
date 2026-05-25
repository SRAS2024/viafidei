/**
 * Cleanup custodian. Phase 1 wraps the existing janitor logic so
 * cleanup can be triggered as part of an Admin Worker pass without
 * the operator hitting the legacy /admin/checklist/janitor pages.
 */

import type { PrismaClient } from "@prisma/client";

import { writeAdminWorkerLog } from "./logs";

export interface CleanupOutcome {
  staleCandidatesRemoved: number;
  expiredReviewsClosed: number;
}

const CANDIDATE_STALE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const REVIEW_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

export async function runCleanupPass(prisma: PrismaClient): Promise<CleanupOutcome> {
  const candidateCutoff = new Date(Date.now() - CANDIDATE_STALE_MS);
  const staleCandidates = await prisma.candidateSourceUrl.deleteMany({
    where: { status: "REJECTED", updatedAt: { lt: candidateCutoff } },
  });

  const reviewCutoff = new Date(Date.now() - REVIEW_EXPIRY_MS);
  const expiredReviews = await prisma.humanReviewQueue.updateMany({
    where: { status: "PENDING", createdAt: { lt: reviewCutoff } },
    data: { status: "EXPIRED", reviewedAt: new Date() },
  });

  await writeAdminWorkerLog(prisma, {
    category: "CLEANUP",
    severity: "INFO",
    eventName: "cleanup_completed",
    message: `Cleanup pass: removed ${staleCandidates.count} stale rejected candidates, expired ${expiredReviews.count} review items.`,
  });

  return {
    staleCandidatesRemoved: staleCandidates.count,
    expiredReviewsClosed: expiredReviews.count,
  };
}
