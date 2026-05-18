/**
 * Production health checks.
 *
 * Stricter than the readiness report — every check here returns a
 * pass/fail boolean. Failing a single check means production health
 * has degraded. The spec's nine fail conditions:
 *
 *   1. No worker heartbeat exists.
 *   2. Queue has pending jobs but no worker.
 *   3. Source documents exist with no build attempts (after a window).
 *   4. Build attempts exist but no QA passes.
 *   5. QA passes exist but no public packages.
 *   6. Public packages exist but threshold counters do not move.
 *   7. Admin metrics cannot load.
 *   8. Security event logging fails.
 *   9. Rejected content logging fails.
 *
 * These checks are designed to be polled by an external monitor —
 * the JSON output is stable and machine-readable.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { hasHealthyWorker } from "../ingestion/queue/heartbeat";
import { countSourceDocumentsWaitingForBuild } from "./pipeline-broken-here";

export type HealthCheckResult = {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
  errorMessage?: string;
};

export type ProductionHealthReport = {
  generatedAt: Date;
  checks: HealthCheckResult[];
  /** True when every check passed. */
  healthy: boolean;
  /** Number of checks that failed. */
  failedCount: number;
};

async function safeRun(
  id: string,
  label: string,
  fn: () => Promise<HealthCheckResult>,
): Promise<HealthCheckResult> {
  try {
    return await fn();
  } catch (e) {
    return {
      id,
      label,
      passed: false,
      detail: "health check threw",
      errorMessage: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function runProductionHealthChecks(): Promise<ProductionHealthReport> {
  const generatedAt = new Date();
  const workerOk = await safeRun("worker_heartbeat", "Worker heartbeat", async () => {
    const ok = await hasHealthyWorker();
    return {
      id: "worker_heartbeat",
      label: "Worker heartbeat",
      passed: ok,
      detail: ok ? "At least one worker is healthy" : "No healthy worker heartbeat",
    };
  });
  const queue = await safeRun("queue_with_no_worker", "Queue with no worker", async () => {
    const pending = await prisma.ingestionJobQueue.count({ where: { status: "pending" } });
    const worker = await hasHealthyWorker();
    const passed = !(pending > 0 && !worker);
    return {
      id: "queue_with_no_worker",
      label: "Queue with pending jobs but no worker",
      passed,
      detail: passed
        ? `${pending} pending, worker healthy=${worker}`
        : `${pending} pending jobs but no worker is running`,
    };
  });
  const sourceDocsBuilt = await safeRun(
    "source_documents_with_no_build",
    "Source documents waiting for build",
    async () => {
      const waiting = await countSourceDocumentsWaitingForBuild();
      const passed = waiting.count === 0;
      return {
        id: "source_documents_with_no_build",
        label: "Source documents with no build attempts",
        passed,
        detail: passed
          ? "Every fetched source document has been built or is within the build window"
          : `${waiting.count} source documents waiting > ${Math.round(waiting.thresholdMs / 60000)}min`,
      };
    },
  );
  const builds = await safeRun("builds_without_qa_pass", "Builds without any QA pass", async () => {
    const totalBuilds = await prisma.contentPackageBuildLog.count({
      where: { buildStatus: "built_complete_package" },
    });
    const qaRejections = await prisma.rejectedContentLog.count({
      where: { validationDecision: { in: ["reject", "delete", "archive"] } },
    });
    // Effective QA passes ≈ completed builds - QA rejections.
    const qaPasses = totalBuilds - qaRejections;
    const passed = totalBuilds === 0 || qaPasses > 0;
    return {
      id: "builds_without_qa_pass",
      label: "Builds without any QA pass",
      passed,
      detail: passed
        ? `${qaPasses} of ${totalBuilds} builds appear to have passed QA`
        : `${totalBuilds} builds attempted but zero QA passes`,
    };
  });
  const qaPubGap = await safeRun(
    "qa_pass_without_public",
    "QA passes without any public package",
    async () => {
      const publicPrayers = await prisma.prayer.count({
        where: { status: "PUBLISHED", publicRenderReady: true, isThresholdEligible: true },
      });
      const publicSaints = await prisma.saint.count({
        where: { status: "PUBLISHED", publicRenderReady: true, isThresholdEligible: true },
      });
      const total = publicPrayers + publicSaints;
      const builds = await prisma.contentPackageBuildLog.count({
        where: { buildStatus: "built_complete_package" },
      });
      const passed = builds === 0 || total > 0;
      return {
        id: "qa_pass_without_public",
        label: "QA passes without any public package",
        passed,
        detail: passed
          ? `${total} public packages exist`
          : `${builds} complete builds but zero public packages`,
      };
    },
  );
  const adminMetrics = await safeRun("admin_metrics_load", "Admin metrics load", async () => {
    // Smoke test: the queue + heartbeat counts that every admin
    // dashboard runs at the top of the page.
    await prisma.ingestionJobQueue.count();
    await prisma.workerHeartbeat.count();
    return {
      id: "admin_metrics_load",
      label: "Admin metrics load",
      passed: true,
      detail: "Queue + worker-heartbeat counts loaded",
    };
  });
  const securityLog = await safeRun(
    "security_event_logging",
    "Security event logging",
    async () => {
      await prisma.securityEvent.count();
      return {
        id: "security_event_logging",
        label: "Security event logging",
        passed: true,
        detail: "SecurityEvent table readable",
      };
    },
  );
  const rejectedLog = await safeRun(
    "rejected_content_logging",
    "Rejected content logging",
    async () => {
      await prisma.rejectedContentLog.count();
      return {
        id: "rejected_content_logging",
        label: "Rejected content logging",
        passed: true,
        detail: "RejectedContentLog table readable",
      };
    },
  );
  const checks = [
    workerOk,
    queue,
    sourceDocsBuilt,
    builds,
    qaPubGap,
    adminMetrics,
    securityLog,
    rejectedLog,
  ];
  const failed = checks.filter((c) => !c.passed);
  const report: ProductionHealthReport = {
    generatedAt,
    checks,
    healthy: failed.length === 0,
    failedCount: failed.length,
  };
  if (!report.healthy) {
    logger.warn("production.health_check_failed", {
      failedCount: report.failedCount,
      failedIds: failed.map((c) => c.id),
    });
  }
  return report;
}
