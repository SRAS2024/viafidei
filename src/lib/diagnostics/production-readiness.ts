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
import { validateEnvironment } from "./env-validation";
import { countSourceDocumentsWaitingForBuild } from "./pipeline-broken-here";

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
    | "public_display";
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

async function workerCard(): Promise<ReadinessCard> {
  const lastUpdatedAt = new Date();
  try {
    const healthy = await hasHealthyWorker();
    return {
      id: "worker",
      label: "Worker heartbeat",
      severity: healthy ? "pass" : "fail",
      summary: healthy ? "At least one worker is healthy" : "No healthy worker heartbeat",
      lastUpdatedAt,
      dataSource: "WorkerHeartbeat",
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
    return {
      id: "source_configuration",
      label: "Source configuration",
      severity: notConfigured > 0 ? "warn" : "pass",
      summary:
        notConfigured > 0
          ? `${notConfigured} of ${total} active sources have no discovery feed (mark not_configured or set a sitemap/RSS feed)`
          : `All ${total} active sources are factory-native`,
      lastUpdatedAt,
      dataSource: "IngestionSource",
      details: { total, factoryNative, notConfigured },
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

export async function getProductionReadinessReport(): Promise<ReadinessReport> {
  const generatedAt = new Date();
  const cards = await Promise.all([
    envCard(),
    databaseCard(),
    workerCard(),
    queueCard(),
    contentFactoryCard(),
    emailCard(),
    securityCard(),
    sourceConfigurationCard(),
    publicDisplayCard(),
  ]).catch((e) => {
    logger.warn("production-readiness.aggregate_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return [] as ReadinessCard[];
  });
  const worst = worstOf(cards.map((c) => c.severity));
  return { generatedAt, cards, worst };
}
