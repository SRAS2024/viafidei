/**
 * Cleanup custodian. Runs during MAINTENANCE passes: prunes stale
 * candidate URLs, closes expired human-review rows, and writes log
 * entries for any cleanup action taken.
 */

import type { PrismaClient } from "@prisma/client";

import { isNonContentHost } from "@/lib/checklist/sources/authority-registry";

import { OPERATOR_FILE_HOST } from "./file-ingest";
import { writeAdminWorkerLog } from "./logs";

export interface CleanupOutcome {
  staleCandidatesRemoved: number;
  expiredReviewsClosed: number;
  junkHostRowsPurged: number;
}

/**
 * Purge already-ingested pollution from non-content hosts (social / commerce /
 * free personal-site builders like the gabiula.pl.tl runaway). Deletes their
 * candidate URLs and neutralizes their source-reads (nulling detectedContentType
 * so they can never re-seed the internal-link crawler). Self-healing: runs every
 * maintenance pass, so once the host block ships the existing junk drains without
 * operator action. Fail-open.
 */
async function purgeNonContentHostRows(prisma: PrismaClient): Promise<number> {
  try {
    const hosts = await prisma.candidateSourceUrl
      .findMany({ distinct: ["sourceHost"], select: { sourceHost: true }, take: 2000 })
      .catch(() => [] as Array<{ sourceHost: string }>);
    // `operator-file.local` is a SYNTHETIC provenance host for files the operator
    // handed the worker directly — not a network host. It matches the
    // non-content `/\.local$/` pattern (correctly: the worker must never try to
    // fetch it), but purging it here would delete the operator's own material
    // and null the classification off every ingested document, silently undoing
    // an ingestion hours after it succeeded. Exclude it explicitly.
    const blocked = hosts
      .map((h) => h.sourceHost)
      .filter((h) => h !== OPERATOR_FILE_HOST && isNonContentHost(h));
    if (blocked.length === 0) return 0;
    const delCandidates = await prisma.candidateSourceUrl
      .deleteMany({ where: { sourceHost: { in: blocked } } })
      .catch(() => ({ count: 0 }));
    // Neutralize reads so they drop out of the internal-link seed query.
    await prisma.adminWorkerSourceRead
      .updateMany({
        where: {
          sourceHost: { in: blocked, not: OPERATOR_FILE_HOST },
          detectedContentType: { not: null },
        },
        data: { detectedContentType: null },
      })
      .catch(() => undefined);
    return delCandidates.count;
  } catch {
    return 0;
  }
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

  const junkHostRowsPurged = await purgeNonContentHostRows(prisma);

  await writeAdminWorkerLog(prisma, {
    category: "CLEANUP",
    severity: junkHostRowsPurged > 0 ? "WARN" : "INFO",
    eventName: "cleanup_completed",
    message: `Cleanup pass: removed ${staleCandidates.count} stale rejected candidates, expired ${expiredReviews.count} review items, purged ${junkHostRowsPurged} non-content-host candidate(s).`,
  });

  return {
    staleCandidatesRemoved: staleCandidates.count,
    expiredReviewsClosed: expiredReviews.count,
    junkHostRowsPurged,
  };
}
