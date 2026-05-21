/**
 * Production readiness summary.
 *
 * The admin "production readiness" page shows the spec-listed nine
 * categories at a glance:
 *
 *   1. Required environment variables.
 *   2. Database status.
 *   3. Worker status.
 *   4. Queue status.
 *   5. Content factory status.
 *   6. Email status.
 *   7. Security status.
 *   8. Source configuration status.
 *   9. Public display status.
 *
 * Each card carries severity (pass / warn / fail / error), a
 * one-line summary, last-updated timestamp, the underlying data
 * source, and small structured details for drill-in.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { hasHealthyWorker } from "../ingestion/queue/heartbeat";
import { validateEnvironment, getEnvSubsystemDiagnostics } from "./env-validation";
import { countSourceDocumentsWaitingForBuild } from "./pipeline-broken-here";
import { getWorkerHealthDiagnostics, type WorkerHealthDiagnostics } from "./worker-health";
import { getPipelineStatus, type PipelineStatus } from "./pipeline-status";
import { getSchedulerHealth } from "./scheduler-health";
import { getSourceJobCoverage } from "../ingestion/queue/source-job-repair";

export type ReadinessSeverity = "pass" | "warn" | "fail" | "error";

export type ReadinessCard = {
  id:
    | "environment_variables"
    | "database"
    | "worker"
    | "queue"
    | "content_factory"
    | "email"
    | "security"
    | "source_configuration"
    | "public_display"
    | "content_type_readiness"
    | "canary"
    | "search_sitemap"
    | "source_plan"
    | "pipeline_status"
    | "scheduler";
  label: string;
  severity: ReadinessSeverity;
  summary: string;
  lastUpdatedAt: Date;
  dataSource: string;
  errorMessage?: string;
  details?: Record<string, unknown>;
};

export type ReadinessReport = {
  generatedAt: Date;
  cards: ReadinessCard[];
  worst: ReadinessSeverity;
};

const worstOf = (severities: ReadinessSeverity[]): ReadinessSeverity => {
  if (severities.includes("error")) return "error";
  if (severities.includes("fail")) return "fail";
  if (severities.includes("warn")) return "warn";
  return "pass";
};

async function envCard(): Promise<ReadinessCard> {
  const result = validateEnvironment();
  const subsystems = getEnvSubsystemDiagnostics();
  return {
    id: "environment_variables",
    label: "Environment variables",
    severity: result.severity,
    summary:
      result.severity === "pass"
        ? "All required variables are set"
        : `${result.missingRequired} required + ${result.missingRecommended} recommended missing`,
    lastUpdatedAt: new Date(),
    dataSource: "process.env",
    details: {
      missingRequired: result.missingRequired,
      missingRecommended: result.missingRecommended,
      subsystems: subsystems.rows,
    },
  };
}

async function databaseCard(): Promise<ReadinessCard> {
  const lastUpdatedAt = new Date();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      id: "database",
      label: "Database",
      severity: "pass",
      summary: "Reachable",
      lastUpdatedAt,
      dataSource: "prisma.$queryRaw",
    };
  } catch (e) {
    return {
      id: "database",
      label: "Database",
      severity: "fail",
      summary: "Database unreachable",
      lastUpdatedAt,
      dataSource: "prisma.$queryRaw",
      errorMessage: e instanceof Error ? e.message : String(e),
    };
  }
}

function workerHealthDetails(d: WorkerHealthDiagnostics): Record<string, unknown> {
  return {
    workerAlive: d.workerAlive,
    lastHeartbeatAt: d.lastHeartbeatAt ? d.lastHeartbeatAt.toISOString() : null,
    heartbeatAgeMs: d.heartbeatAgeMs,
    processType: d.processType,
    workerId: d.workerId,
    hostname: d.hostname,
    processedCount: d.processedCount,
    failedCount: d.failedCount,
    retryCount: d.retryCount,
    currentJobId: d.currentJobId,
    workerStatus: d.workerStatus,
    pendingJobs: d.pendingJobs,
    runningJobs: d.runningJobs,
    failedJobs: d.failedJobs,
    oldestPendingAgeMs: d.oldestPendingAgeMs,
    likelyCauses: d.likelyCauses,
    topFailureReasons: d.topFailureReasons,
    message: d.message,
  };
}

async function workerCard(): Promise<ReadinessCard> {
  const lastUpdatedAt = new Date();
  try {
    const d = await getWorkerHealthDiagnostics();
    let severity: ReadinessSeverity;
    let summary: string;
    if (!d.workerAlive) {
      // Spec: production readiness fails when the worker heartbeat is
      // missing — a queue with nobody draining it is a hard blocker.
      severity = "fail";
      summary = "Worker health: FAIL — no healthy worker heartbeat";
    } else if (d.processType !== "worker") {
      // A heartbeat exists but it does not identify itself as the
      // worker process — the deploy is likely wired up wrong.
      severity = "fail";
      summary = 'Worker health: FAIL — heartbeat present but process type is not "worker"';
    } else if (d.message === "Worker is alive but queue is not draining." || d.failedJobs > 0) {
      severity = "warn";
      summary = `Worker health: OK — ${d.message}`;
    } else {
      severity = "pass";
      summary = "Worker health: OK — healthy worker heartbeat detected (process type: worker)";
    }
    return {
      id: "worker",
      label: "Worker heartbeat",
      severity,
      summary,
      lastUpdatedAt,
      dataSource: "WorkerHeartbeat + IngestionJobQueue",
      details: workerHealthDetails(d),
    };
  } catch (e) {
    return {
      id: "worker",
      label: "Worker heartbeat",
      severity: "error",
      summary: "Worker health query failed",
      lastUpdatedAt,
      dataSource: "WorkerHeartbeat",
      errorMessage: e instanceof Error ? e.message : String(e),
    };
  }
}

function pipelineStatusDetails(s: PipelineStatus): Record<string, unknown> {
  return {
    queuePending: s.queuePending,
    queueRunning: s.queueRunning,
    workerHeartbeat: s.workerHealthy,
    sourceDocuments: s.sourceDocuments,
    buildLogs: s.buildLogs,
    completePackages: s.completePackages,
    qaPasses: s.qaPasses,
    persistedPackages: s.persistedPackages,
    strictPublicRows: s.strictPublicRows,
    blocker: s.blocker,
    blockerMessage: s.blockerMessage,
  };
}

async function pipelineStatusCard(): Promise<ReadinessCard> {
  const lastUpdatedAt = new Date();
  try {
    const s = await getPipelineStatus();
    let severity: ReadinessSeverity = "pass";
    let summary = "Pipeline is flowing — no blocker detected";
    if (s.blocker === "worker_not_processing_queue") {
      severity = "fail";
      summary = "Current blocker: worker not processing queue.";
    } else if (s.blocker) {
      severity = "fail";
      summary = `Current blocker: ${s.blocker} — ${s.blockerMessage}`;
    } else if (s.strictPublicRows === 0) {
      // No named upstream blocker, but the catalog is still empty —
      // the pipeline is idle and producing nothing.
      severity = "fail";
      summary = "Current blocker: catalog is empty and the pipeline is idle.";
    }
    return {
      id: "pipeline_status",
      label: "Pipeline status",
      severity,
      summary,
      lastUpdatedAt,
      dataSource: "IngestionJobQueue + SourceDocument + ContentPackageBuildLog + QueueAuditLog",
      details: pipelineStatusDetails(s),
    };
  } catch (e) {
    return {
      id: "pipeline_status",
      label: "Pipeline status",
      severity: "error",
      summary: "Pipeline status query failed",
      lastUpdatedAt,
      dataSource: "IngestionJobQueue + SourceDocument + ContentPackageBuildLog",
      errorMessage: e instanceof Error ? e.message : String(e),
    };
  }
}

async function queueCard(): Promise<ReadinessCard> {
  const lastUpdatedAt = new Date();
  try {
    const pending = await prisma.ingestionJobQueue.count({ where: { status: "pending" } });
    const running = await prisma.ingestionJobQueue.count({ where: { status: "running" } });
    const failed = await prisma.ingestionJobQueue.count({ where: { status: "failed" } });
    const workerOk = await hasHealthyWorker();
    const stuck = pending > 0 && !workerOk;
    return {
      id: "queue",
      label: "Queue",
      severity: stuck ? "fail" : "pass",
      summary: stuck
        ? `${pending} pending jobs but no worker is running`
        : `${pending} pending / ${running} running / ${failed} failed`,
      lastUpdatedAt,
      dataSource: "IngestionJobQueue",
      details: { pending, running, failed, workerHealthy: workerOk },
    };
  } catch (e) {
    return {
      id: "queue",
      label: "Queue",
      severity: "error",
      summary: "Queue query failed",
      lastUpdatedAt,
      dataSource: "IngestionJobQueue",
      errorMessage: e instanceof Error ? e.message : String(e),
    };
  }
}

async function schedulerCard(): Promise<ReadinessCard> {
  const lastUpdatedAt = new Date();
  try {
    const h = await getSchedulerHealth();
    let severity: ReadinessSeverity = "pass";
    let summary = `Scheduler healthy — last tick enqueued ${h.jobsEnqueuedLastTick ?? 0} job(s)`;
    if (!h.ticked24h) {
      severity = "fail";
      summary =
        "No scheduler tick recorded in the last 24 hours — check the cron token and scheduler configuration.";
    } else if (h.lastTickOk === false) {
      severity = "fail";
      summary = `Last scheduler tick failed: ${h.lastFailureReason ?? "unknown reason"}`;
    }
    return {
      id: "scheduler",
      label: "Scheduler",
      severity,
      summary,
      lastUpdatedAt,
      dataSource: "QueueAuditLog (scheduler.tick_*)",
      details: {
        lastTickAt: h.lastTickAt ? h.lastTickAt.toISOString() : null,
        lastSuccessfulTickAt: h.lastSuccessfulTickAt ? h.lastSuccessfulTickAt.toISOString() : null,
        lastFailedTickAt: h.lastFailedTickAt ? h.lastFailedTickAt.toISOString() : null,
        lastFailureReason: h.lastFailureReason,
        jobsEnqueuedLastTick: h.jobsEnqueuedLastTick,
        jobsScannedLastTick: h.jobsScannedLastTick,
        currentMode: h.currentMode,
        ticked24h: h.ticked24h,
      },
    };
  } catch (e) {
    return {
      id: "scheduler",
      label: "Scheduler",
      severity: "error",
      summary: "Scheduler health query failed",
      lastUpdatedAt,
      dataSource: "QueueAuditLog (scheduler.tick_*)",
      errorMessage: e instanceof Error ? e.message : String(e),
    };
  }
}

async function contentFactoryCard(): Promise<ReadinessCard> {
  const lastUpdatedAt = new Date();
  try {
    const waiting = await countSourceDocumentsWaitingForBuild();
    const builds = await prisma.contentPackageBuildLog.count();
    const successfulBuilds = await prisma.contentPackageBuildLog.count({
      where: { buildStatus: "built_complete_package" },
    });
    const severity: ReadinessSeverity =
      waiting.count > 50 ? "fail" : waiting.count > 0 ? "warn" : "pass";
    return {
      id: "content_factory",
      label: "Content factory",
      severity,
      summary:
        waiting.count > 0
          ? `${waiting.count} source documents waiting for build`
          : `${successfulBuilds} of ${builds} builds successful`,
      lastUpdatedAt,
      dataSource: "ContentPackageBuildLog + SourceDocument",
      details: { waitingForBuild: waiting.count, successfulBuilds, totalBuilds: builds },
    };
  } catch (e) {
    return {
      id: "content_factory",
      label: "Content factory",
      severity: "error",
      summary: "Content factory query failed",
      lastUpdatedAt,
      dataSource: "ContentPackageBuildLog",
      errorMessage: e instanceof Error ? e.message : String(e),
    };
  }
}

async function emailCard(): Promise<ReadinessCard> {
  const lastUpdatedAt = new Date();
  try {
    const { readResendApiKey } = await import("../email/resend");
    const key = readResendApiKey();
    return {
      id: "email",
      label: "Email pipeline",
      severity: key === null ? "warn" : "pass",
      summary:
        key === null
          ? "Resend API key not configured — transactional email disabled"
          : "Resend API key configured",
      lastUpdatedAt,
      dataSource: "process.env (RESEND_API_KEY / RESEND)",
    };
  } catch (e) {
    return {
      id: "email",
      label: "Email pipeline",
      severity: "error",
      summary: "Email status query failed",
      lastUpdatedAt,
      dataSource: "process.env",
      errorMessage: e instanceof Error ? e.message : String(e),
    };
  }
}

async function securityCard(): Promise<ReadinessCard> {
  const lastUpdatedAt = new Date();
  try {
    const recent = await prisma.securityEvent.findFirst({ orderBy: { createdAt: "desc" } });
    return {
      id: "security",
      label: "Security event logging",
      severity: "pass",
      summary: recent
        ? `Last security event ${recent.createdAt.toISOString()}`
        : "No security events recorded yet",
      lastUpdatedAt,
      dataSource: "SecurityEvent",
    };
  } catch (e) {
    return {
      id: "security",
      label: "Security event logging",
      severity: "error",
      summary: "Security event query failed",
      lastUpdatedAt,
      dataSource: "SecurityEvent",
      errorMessage: e instanceof Error ? e.message : String(e),
    };
  }
}

async function sourceConfigurationCard(): Promise<ReadinessCard> {
  const lastUpdatedAt = new Date();
  try {
    const total = await prisma.ingestionSource.count({ where: { isActive: true } });
    const factoryNative = await prisma.ingestionSource.count({
      where: { isActive: true, discoveryFeedUrl: { not: null } },
    });
    const notConfigured = total - factoryNative;
    const coverage = await getSourceJobCoverage();
    // Spec §11: warn when more than 25% of factory-ready sources have
    // zero queue jobs — the queue is starving and needs Repair source
    // jobs.
    const lowJobCoverage = coverage.factoryReadySources > 0 && coverage.zeroJobRatio > 0.25;
    const severity: ReadinessSeverity = notConfigured > 0 || lowJobCoverage ? "warn" : "pass";
    const summary = lowJobCoverage
      ? `${coverage.sourcesWithZeroJobs} of ${coverage.factoryReadySources} factory-ready sources have zero jobs — run Repair source jobs`
      : notConfigured > 0
        ? `${notConfigured} of ${total} active sources have no discovery feed (mark not_configured or set a sitemap/RSS feed)`
        : `All ${total} active sources are factory-native`;
    return {
      id: "source_configuration",
      label: "Source configuration",
      severity,
      summary,
      lastUpdatedAt,
      dataSource: "IngestionSource + IngestionJobQueue",
      details: {
        total,
        factoryNative,
        notConfigured,
        factoryReadySources: coverage.factoryReadySources,
        sourcesWithZeroJobs: coverage.sourcesWithZeroJobs,
        zeroJobRatio: coverage.zeroJobRatio,
      },
    };
  } catch (e) {
    return {
      id: "source_configuration",
      label: "Source configuration",
      severity: "error",
      summary: "Source configuration query failed",
      lastUpdatedAt,
      dataSource: "IngestionSource",
      errorMessage: e instanceof Error ? e.message : String(e),
    };
  }
}

async function publicDisplayCard(): Promise<ReadinessCard> {
  const lastUpdatedAt = new Date();
  try {
    const persisted = await prisma.prayer.count({ where: { status: "PUBLISHED" } });
    const visible = await prisma.prayer.count({
      where: { status: "PUBLISHED", publicRenderReady: true, isThresholdEligible: true },
    });
    const blocked = persisted - visible;
    return {
      id: "public_display",
      label: "Public display gate",
      severity: blocked > 0 ? "warn" : "pass",
      summary:
        blocked > 0
          ? `${blocked} prayer rows are PUBLISHED but blocked by the strict public gate`
          : `${visible} prayer rows pass the strict public gate`,
      lastUpdatedAt,
      dataSource: "prisma.prayer",
      details: { persisted, visible, blocked },
    };
  } catch (e) {
    return {
      id: "public_display",
      label: "Public display gate",
      severity: "error",
      summary: "Public display query failed",
      lastUpdatedAt,
      dataSource: "prisma.prayer",
      errorMessage: e instanceof Error ? e.message : String(e),
    };
  }
}

async function contentTypeReadinessCard(): Promise<ReadinessCard> {
  const lastUpdatedAt = new Date();
  try {
    const { getContentTypeReadinessReport } = await import("./content-type-readiness");
    const report = await getContentTypeReadinessReport();
    const ready = report.rows.filter((r) => r.severity === "pass").length;
    const summary =
      report.tabsCannotLoad > 0
        ? `${report.tabsCannotLoad} public tab(s) cannot load their strict valid packages`
        : report.typesWithNoSource > 0
          ? `${report.typesWithNoSource} content type(s) have no factory-ready source`
          : report.typesWithNoCanary > 0
            ? `${report.typesWithNoCanary} content type(s) have no successful canary build`
            : `${ready} of ${report.rows.length} content types are fully production-ready`;
    return {
      id: "content_type_readiness",
      label: "Content type readiness (all tabs)",
      severity: report.worst,
      summary,
      lastUpdatedAt,
      dataSource: "diagnostics/content-type-readiness",
      details: {
        rows: report.rows,
        tabsCannotLoad: report.tabsCannotLoad,
        typesWithNoSource: report.typesWithNoSource,
        typesWithNoCanary: report.typesWithNoCanary,
        typesWithNoContent: report.typesWithNoContent,
      },
    };
  } catch (e) {
    return {
      id: "content_type_readiness",
      label: "Content type readiness (all tabs)",
      severity: "error",
      summary: "Per-content-type readiness aggregation failed",
      lastUpdatedAt,
      dataSource: "diagnostics/content-type-readiness",
      errorMessage: e instanceof Error ? e.message : String(e),
    };
  }
}

async function canaryCard(): Promise<ReadinessCard> {
  const lastUpdatedAt = new Date();
  try {
    const { runCanaryBuilds } = await import("../content-factory/canary-fixtures");
    const report = runCanaryBuilds();
    const failing = report.results.filter((r) => !r.passed);
    return {
      id: "canary",
      label: "Canary builds",
      severity: failing.length === 0 ? "pass" : "fail",
      summary:
        failing.length === 0
          ? `${report.results.length} canary fixture(s) build cleanly`
          : `${failing.length} canary fixture(s) FAILED: ${failing.map((f) => `${f.contentType}/${f.fixtureName}`).join(", ")}`,
      lastUpdatedAt,
      dataSource: "content-factory.canary-fixtures",
      details: {
        results: report.results,
        factoryHealthy: report.factoryHealthy,
      },
    };
  } catch (e) {
    return {
      id: "canary",
      label: "Canary builds",
      severity: "error",
      summary: "Canary runner failed to execute",
      lastUpdatedAt,
      dataSource: "content-factory.canary-fixtures",
      errorMessage: e instanceof Error ? e.message : String(e),
    };
  }
}

async function searchSitemapCard(): Promise<ReadinessCard> {
  const lastUpdatedAt = new Date();
  try {
    // A minimum-floor sanity check: at least one public Prayer row
    // must be visible in both the strict-public query (drives search)
    // and the catalog the sitemap reads. We do not run verifyIndexing
    // per-row here (too expensive on a readiness check); we confirm
    // the strict-public Prayer count > 0 as a proxy. The cron-side
    // indexing-repair handles per-row reconciliation.
    const publicPrayerCount = await prisma.prayer.count({
      where: { status: "PUBLISHED", publicRenderReady: true, isThresholdEligible: true },
    });
    return {
      id: "search_sitemap",
      label: "Search + sitemap surfaces",
      severity: publicPrayerCount > 0 ? "pass" : "warn",
      summary:
        publicPrayerCount > 0
          ? `${publicPrayerCount} strict-public Prayer rows visible to search + sitemap`
          : "No strict-public Prayer rows exist yet — search + sitemap will be empty",
      lastUpdatedAt,
      dataSource: "prisma.prayer (strict-public)",
      details: { publicPrayerCount },
    };
  } catch (e) {
    return {
      id: "search_sitemap",
      label: "Search + sitemap surfaces",
      severity: "error",
      summary: "Search + sitemap readiness query failed",
      lastUpdatedAt,
      dataSource: "prisma.prayer (strict-public)",
      errorMessage: e instanceof Error ? e.message : String(e),
    };
  }
}

async function sourcePlanCard(): Promise<ReadinessCard> {
  const lastUpdatedAt = new Date();
  try {
    const { buildSourcePlanReport } = await import("../ingestion/sources/source-plan");
    const report = await buildSourcePlanReport();
    // Spec: production readiness FAILS when any major content type
    // has zero factory-ready sources; WARNS when any major content
    // type is below the configured minimum.
    const severity: ReadinessSeverity =
      report.zeroFactoryReady > 0 ? "fail" : report.underMinimum > 0 ? "warn" : "pass";
    const summary =
      severity === "fail"
        ? `${report.zeroFactoryReady} content type(s) have zero factory-ready sources`
        : severity === "warn"
          ? `${report.underMinimum} content type(s) below the configured minimum source count`
          : "Every content type meets the configured factory-ready source minimum";
    return {
      id: "source_plan",
      label: "Production source plan",
      severity,
      summary,
      lastUpdatedAt,
      dataSource: "ingestion/sources/source-plan",
      details: { rows: report.rows },
    };
  } catch (e) {
    return {
      id: "source_plan",
      label: "Production source plan",
      severity: "error",
      summary: "Source plan aggregation failed",
      lastUpdatedAt,
      dataSource: "ingestion/sources/source-plan",
      errorMessage: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function getProductionReadinessReport(): Promise<ReadinessReport> {
  const generatedAt = new Date();
  const cards = await Promise.all([
    envCard(),
    databaseCard(),
    workerCard(),
    queueCard(),
    pipelineStatusCard(),
    schedulerCard(),
    contentFactoryCard(),
    emailCard(),
    securityCard(),
    sourceConfigurationCard(),
    publicDisplayCard(),
    contentTypeReadinessCard(),
    canaryCard(),
    searchSitemapCard(),
    sourcePlanCard(),
  ]).catch((e) => {
    logger.warn("production-readiness.aggregate_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return [] as ReadinessCard[];
  });
  const worst = worstOf(cards.map((c) => c.severity));
  return { generatedAt, cards, worst };
}
