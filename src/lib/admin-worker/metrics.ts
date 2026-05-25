/**
 * Command Center metrics. Computes the spec section 17 numbers
 * (publish rate, QA pass rate, deletion rate, review queue count,
 * monthly report status) so the Command Center page can render them
 * in one query batch.
 */

import type { PrismaClient } from "@prisma/client";

export interface CommandCenterMetrics {
  /** Public publish rate over the last 30 days. */
  publishRate30d: number;
  /** QA pass rate over the last 30 days. */
  qaPassRate30d: number;
  /** Deletion rate (deletions / publishes) over the last 30 days. */
  deletionRate30d: number;
  /** Pending review items right now. */
  reviewQueueCount: number;
  /** Active security actions in the last 24 hours. */
  recentSecurityActions24h: number;
  /** When the last monthly report was generated; null if never. */
  monthlyReportLastAt: Date | null;
  /** True when the most recent monthly report is within 32 days. */
  monthlyReportFresh: boolean;
  /** Public content rows currently live. */
  publishedContentLive: number;
  /** Content currently in the build queue (pending + running). */
  queueInFlight: number;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function loadCommandCenterMetrics(
  prisma: PrismaClient,
): Promise<CommandCenterMetrics> {
  const since30d = new Date(Date.now() - 30 * ONE_DAY_MS);
  const since24h = new Date(Date.now() - ONE_DAY_MS);
  const monthlyReportThreshold = 32 * ONE_DAY_MS;

  const [
    qaTotal,
    qaPassed,
    publishesAttempted,
    publishesSucceeded,
    deletionLogs,
    reviewQueueCount,
    recentSecurityActions24h,
    lastReport,
    publishedContentLive,
    queueInFlight,
  ] = await Promise.all([
    prisma.checklistQAReport.count({ where: { createdAt: { gte: since30d } } }),
    prisma.checklistQAReport.count({
      where: { createdAt: { gte: since30d }, passed: true },
    }),
    prisma.adminWorkerLog.count({
      where: {
        category: "PUBLISHING",
        createdAt: { gte: since30d },
        eventName: { in: ["publish_gate_publish", "publish_gate_reject", "publish_gate_review"] },
      },
    }),
    prisma.adminWorkerLog.count({
      where: {
        category: "PUBLISHING",
        createdAt: { gte: since30d },
        eventName: "publish_gate_publish",
      },
    }),
    prisma.adminWorkerLog.count({
      where: {
        category: "PUBLISHING",
        createdAt: { gte: since30d },
        eventName: "content_deleted",
      },
    }),
    prisma.humanReviewQueue.count({ where: { status: "PENDING" } }),
    prisma.adminWorkerSecurityAction.count({ where: { createdAt: { gte: since24h } } }),
    prisma.adminDeveloperReportLog.findFirst({
      where: { reportPeriod: "LAST_30_DAYS", status: "GENERATED" },
      orderBy: { generatedAt: "desc" },
    }),
    prisma.publishedContent.count({ where: { isPublished: true } }),
    prisma.workerBuildJob.count({ where: { status: { in: ["pending", "running"] } } }),
  ]);

  const publishRate30d = publishesAttempted > 0 ? publishesSucceeded / publishesAttempted : 0;
  const qaPassRate30d = qaTotal > 0 ? qaPassed / qaTotal : 0;
  const deletionRate30d = publishesSucceeded > 0 ? deletionLogs / publishesSucceeded : 0;
  const monthlyReportLastAt = lastReport?.generatedAt ?? null;
  const monthlyReportFresh = monthlyReportLastAt
    ? Date.now() - monthlyReportLastAt.getTime() < monthlyReportThreshold
    : false;

  return {
    publishRate30d,
    qaPassRate30d,
    deletionRate30d,
    reviewQueueCount,
    recentSecurityActions24h,
    monthlyReportLastAt,
    monthlyReportFresh,
    publishedContentLive,
    queueInFlight,
  };
}
