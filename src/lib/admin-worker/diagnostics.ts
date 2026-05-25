/**
 * Admin Worker diagnostics. Produces the 24 health ratings the spec
 * requires on the admin diagnostics card.
 *
 * Each rating returns one of: pass | warn | fail | unknown. The
 * diagnostics page reads these alongside the legacy diagnostics so
 * the operator gets one unified view.
 *
 * Most ratings are derived from rows the worker is already writing —
 * heartbeat, pass durations, source reputation, content goals,
 * security actions, post-publish verifications.
 */

import type { PrismaClient } from "@prisma/client";

export type HealthStatus = "pass" | "warn" | "fail" | "unknown";

export interface HealthRating {
  key: string;
  label: string;
  status: HealthStatus;
  score: number;
  lastCheckedAt: Date;
  dataSource: string;
  latestSuccess?: Date | null;
  latestFailure?: Date | null;
  currentBlocker?: string;
  recommendedRepair?: string;
  summary: string;
}

/** Each rating returns a HealthRating shape so the UI is uniform. */
type RatingFn = (prisma: PrismaClient) => Promise<HealthRating>;

async function ratingOverall(prisma: PrismaClient): Promise<HealthRating> {
  const state = await prisma.adminWorkerState
    .findUnique({ where: { id: "singleton" } })
    .catch(() => null);
  if (!state) {
    return {
      key: "admin_worker_overall",
      label: "Admin Worker overall",
      status: "unknown",
      score: 0,
      lastCheckedAt: new Date(),
      dataSource: "AdminWorkerState",
      summary: "No AdminWorkerState row found.",
      recommendedRepair: "Run the 0024_admin_worker migration.",
    };
  }
  const status: HealthStatus = state.paused ? "warn" : state.currentBlocker ? "fail" : "pass";
  return {
    key: "admin_worker_overall",
    label: "Admin Worker overall",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0,
    lastCheckedAt: new Date(),
    dataSource: "AdminWorkerState",
    latestSuccess: state.lastSuccessfulAt,
    latestFailure: state.lastFailedAt,
    currentBlocker: state.currentBlocker ?? undefined,
    recommendedRepair: state.recoveryAction ?? undefined,
    summary: state.paused
      ? `Paused${state.pausedReason ? ` (${state.pausedReason})` : ""}.`
      : state.currentBlocker
        ? `Blocked: ${state.currentBlocker}`
        : `Mode: ${state.currentMode}, priority: ${state.currentPriority}.`,
  };
}

async function ratingHeartbeat(prisma: PrismaClient): Promise<HealthRating> {
  const state = await prisma.adminWorkerState
    .findUnique({ where: { id: "singleton" } })
    .catch(() => null);
  const last = state?.lastHeartbeatAt ?? null;
  const now = new Date();
  const ageMs = last ? now.getTime() - last.getTime() : Infinity;
  let status: HealthStatus = "fail";
  if (ageMs < 60_000) status = "pass";
  else if (ageMs < 5 * 60_000) status = "warn";
  return {
    key: "admin_worker_heartbeat",
    label: "Heartbeat",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0,
    lastCheckedAt: now,
    dataSource: "AdminWorkerState.lastHeartbeatAt",
    latestSuccess: last,
    summary: last ? `Last heartbeat ${Math.round(ageMs / 1000)}s ago.` : "No heartbeat recorded.",
    recommendedRepair: status === "fail" ? "Restart the Admin Worker process." : undefined,
  };
}

async function ratingQueue(prisma: PrismaClient): Promise<HealthRating> {
  const [pending, failed, lastSuccess, lastFailure] = await Promise.all([
    prisma.workerBuildJob.count({ where: { status: "pending" } }),
    prisma.workerBuildJob.count({ where: { status: "failed" } }),
    prisma.workerBuildJob.findFirst({
      where: { status: "succeeded" },
      orderBy: { finishedAt: "desc" },
      select: { finishedAt: true, errorMessage: true },
    }),
    prisma.workerBuildJob.findFirst({
      where: { status: "failed" },
      orderBy: { finishedAt: "desc" },
      select: { finishedAt: true, errorMessage: true },
    }),
  ]);
  const status: HealthStatus =
    failed > pending && failed > 5 ? "fail" : failed > 0 ? "warn" : "pass";
  return {
    key: "admin_worker_queue",
    label: "Queue processing",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.6 : 0.2,
    lastCheckedAt: new Date(),
    dataSource: "WorkerBuildJob",
    summary: `${pending} pending, ${failed} failed.`,
    latestSuccess: lastSuccess?.finishedAt ?? null,
    latestFailure: lastFailure?.finishedAt ?? null,
    currentBlocker: lastFailure?.errorMessage ?? undefined,
    recommendedRepair: failed > 0 ? "Inspect failed jobs at /admin/checklist/failed." : undefined,
  };
}

async function ratingTaskPlanning(prisma: PrismaClient): Promise<HealthRating> {
  const recent = await prisma.adminWorkerTask.count({
    where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  const status: HealthStatus = recent > 0 ? "pass" : "warn";
  return {
    key: "admin_worker_task_planning",
    label: "Task planning",
    status,
    score: status === "pass" ? 1 : 0.5,
    lastCheckedAt: new Date(),
    dataSource: "AdminWorkerTask",
    summary: `${recent} tasks created in last 24h.`,
  };
}

async function ratingSourceDiscovery(prisma: PrismaClient): Promise<HealthRating> {
  const total = await prisma.candidateSourceUrl.count();
  const recent = await prisma.candidateSourceUrl.count({
    where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  const status: HealthStatus = total > 0 || recent > 0 ? "pass" : "warn";
  return {
    key: "admin_worker_source_discovery",
    label: "Source discovery",
    status,
    score: status === "pass" ? 1 : 0.5,
    lastCheckedAt: new Date(),
    dataSource: "CandidateSourceUrl",
    summary: `${total} candidate URLs (${recent} new in last 24h).`,
  };
}

async function ratingSourceReading(prisma: PrismaClient): Promise<HealthRating> {
  const fetched = await prisma.candidateSourceUrl.count({ where: { status: "FETCHED" } });
  const built = await prisma.candidateSourceUrl.count({ where: { status: "BUILT" } });
  const status: HealthStatus = fetched + built > 0 ? "pass" : "warn";
  return {
    key: "admin_worker_source_reading",
    label: "Source reading",
    status,
    score: status === "pass" ? 1 : 0.5,
    lastCheckedAt: new Date(),
    dataSource: "CandidateSourceUrl.status",
    summary: `${fetched} fetched, ${built} built.`,
  };
}

async function ratingSourceReputation(prisma: PrismaClient): Promise<HealthRating> {
  const total = await prisma.adminWorkerSourceReputation.count();
  const paused = await prisma.adminWorkerSourceReputation.count({ where: { paused: true } });
  const status: HealthStatus = total > 0 ? (paused > total / 2 ? "warn" : "pass") : "warn";
  return {
    key: "admin_worker_source_reputation",
    label: "Source reputation",
    status,
    score: total > 0 ? 1 - paused / total : 0.5,
    lastCheckedAt: new Date(),
    dataSource: "AdminWorkerSourceReputation",
    summary: `${total - paused} active, ${paused} paused (of ${total}).`,
  };
}

async function ratingPublishing(prisma: PrismaClient): Promise<HealthRating> {
  const [total, lastPublish, lastFailure] = await Promise.all([
    prisma.publishedContent.count({ where: { isPublished: true } }),
    prisma.publishedContent.findFirst({
      where: { isPublished: true },
      orderBy: { publishedAt: "desc" },
      select: { publishedAt: true },
    }),
    prisma.adminWorkerLog.findFirst({
      where: { category: "PUBLISHING", severity: { in: ["ERROR", "CRITICAL"] } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, message: true },
    }),
  ]);
  const status: HealthStatus = total > 0 ? "pass" : "warn";
  return {
    key: "admin_worker_publishing",
    label: "Publishing",
    status,
    score: status === "pass" ? 1 : 0.4,
    lastCheckedAt: new Date(),
    dataSource: "PublishedContent",
    summary: `${total} items currently published.`,
    latestSuccess: lastPublish?.publishedAt ?? null,
    latestFailure: lastFailure?.createdAt ?? null,
    currentBlocker: lastFailure?.message ?? undefined,
  };
}

async function ratingPostPublish(prisma: PrismaClient): Promise<HealthRating> {
  const total = await prisma.postPublishVerification.count();
  const failed = await prisma.postPublishVerification.count({ where: { result: "FAIL" } });
  const status: HealthStatus = total === 0 ? "warn" : failed > 0 ? "fail" : "pass";
  return {
    key: "admin_worker_post_publish",
    label: "Post-publish verification",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0.2,
    lastCheckedAt: new Date(),
    dataSource: "PostPublishVerification",
    summary: `${total} verified, ${failed} failed.`,
  };
}

async function ratingHumanReview(prisma: PrismaClient): Promise<HealthRating> {
  const pending = await prisma.humanReviewQueue.count({ where: { status: "PENDING" } });
  const status: HealthStatus = pending === 0 ? "pass" : pending > 25 ? "fail" : "warn";
  return {
    key: "admin_worker_human_review",
    label: "Human review queue",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.6 : 0.2,
    lastCheckedAt: new Date(),
    dataSource: "HumanReviewQueue",
    summary: `${pending} items awaiting review.`,
  };
}

async function ratingSecurity(prisma: PrismaClient): Promise<HealthRating> {
  const recentBreaches = await prisma.securityEvent.count({
    where: {
      classification: "Breach",
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  const status: HealthStatus = recentBreaches === 0 ? "pass" : recentBreaches > 3 ? "fail" : "warn";
  return {
    key: "admin_worker_security",
    label: "Security defense",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.6 : 0.2,
    lastCheckedAt: new Date(),
    dataSource: "SecurityEvent",
    summary: `${recentBreaches} confirmed breaches in last 24h.`,
  };
}

async function ratingMonthlyReport(prisma: PrismaClient): Promise<HealthRating> {
  const last = await prisma.adminDeveloperReportLog.findFirst({
    where: { reportPeriod: "LAST_30_DAYS" },
    orderBy: { generatedAt: "desc" },
  });
  const status: HealthStatus = last
    ? Date.now() - last.generatedAt.getTime() < 32 * 24 * 60 * 60 * 1000
      ? "pass"
      : "warn"
    : "warn";
  return {
    key: "admin_worker_monthly_report",
    label: "Monthly report generation",
    status,
    score: status === "pass" ? 1 : 0.5,
    lastCheckedAt: new Date(),
    dataSource: "AdminDeveloperReportLog",
    summary: last
      ? `Last 30-day report generated ${last.generatedAt.toISOString().slice(0, 10)}.`
      : "No monthly report has been generated yet.",
  };
}

async function ratingHomepage(prisma: PrismaClient): Promise<HealthRating> {
  const recent = await prisma.homepageQualityScore.findFirst({
    orderBy: { createdAt: "desc" },
  });
  const score = recent?.finalScore ?? 0;
  const status: HealthStatus = !recent
    ? "warn"
    : score >= 0.8
      ? "pass"
      : score >= 0.6
        ? "warn"
        : "fail";
  return {
    key: "admin_worker_homepage",
    label: "Homepage redesign",
    status,
    score,
    lastCheckedAt: new Date(),
    dataSource: "HomepageQualityScore",
    summary: recent ? `Homepage score ${score.toFixed(2)}.` : "Homepage has not been scored yet.",
  };
}

async function ratingContentGoals(prisma: PrismaClient): Promise<HealthRating> {
  const goals = await prisma.contentGoal.findMany();
  if (goals.length === 0) {
    return {
      key: "admin_worker_content_goals",
      label: "Content goals",
      status: "warn",
      score: 0.5,
      lastCheckedAt: new Date(),
      dataSource: "ContentGoal",
      summary: "No content goals seeded yet.",
      recommendedRepair: "Call `seedContentGoals(prisma)`.",
    };
  }
  const totalMin = goals.reduce((sum, g) => sum + g.minimumTarget, 0);
  const totalCurrent = goals.reduce((sum, g) => sum + g.currentValidCount, 0);
  const pct = totalMin === 0 ? 1 : Math.min(1, totalCurrent / totalMin);
  const status: HealthStatus = pct >= 0.95 ? "pass" : pct >= 0.5 ? "warn" : "fail";
  return {
    key: "admin_worker_content_goals",
    label: "Content goals",
    status,
    score: pct,
    lastCheckedAt: new Date(),
    dataSource: "ContentGoal",
    summary: `${totalCurrent} / ${totalMin} minimum target (${Math.round(pct * 100)}%).`,
  };
}

async function ratingCleanupCustodian(prisma: PrismaClient): Promise<HealthRating> {
  const recent = await prisma.adminWorkerPass.count({
    where: {
      passType: "CLEANUP",
      startedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  });
  const status: HealthStatus = recent > 0 ? "pass" : "warn";
  return {
    key: "admin_worker_cleanup",
    label: "Cleanup custodian",
    status,
    score: status === "pass" ? 1 : 0.5,
    lastCheckedAt: new Date(),
    dataSource: "AdminWorkerPass",
    summary: `${recent} cleanup pass(es) in last 7 days.`,
  };
}

async function ratingDatabaseHealth(prisma: PrismaClient): Promise<HealthRating> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      key: "admin_worker_db",
      label: "Database health",
      status: "pass",
      score: 1,
      lastCheckedAt: new Date(),
      dataSource: "Postgres",
      summary: "Postgres reachable.",
    };
  } catch (err) {
    return {
      key: "admin_worker_db",
      label: "Database health",
      status: "fail",
      score: 0,
      lastCheckedAt: new Date(),
      dataSource: "Postgres",
      summary: `Database error: ${err instanceof Error ? err.message : String(err)}`,
      recommendedRepair: "Check DATABASE_URL and the Postgres service.",
    };
  }
}

async function ratingEnvironmentHealth(): Promise<HealthRating> {
  const required = ["DATABASE_URL", "ADMIN_USERNAME", "ADMIN_PASSWORD", "SESSION_SECRET"];
  const missing = required.filter((k) => !process.env[k]);
  const status: HealthStatus = missing.length === 0 ? "pass" : "fail";
  return {
    key: "admin_worker_env",
    label: "Environment health",
    status,
    score: status === "pass" ? 1 : 0,
    lastCheckedAt: new Date(),
    dataSource: "process.env",
    summary:
      status === "pass" ? "All required env vars present." : `Missing: ${missing.join(", ")}.`,
    recommendedRepair: status === "pass" ? undefined : "Set the missing env vars in Railway.",
  };
}

async function ratingEmailHealth(): Promise<HealthRating> {
  const configured = Boolean(process.env.RESEND_API_KEY);
  const hasAdmin = Boolean(process.env.ADMIN_EMAIL);
  const status: HealthStatus = configured && hasAdmin ? "pass" : "warn";
  return {
    key: "admin_worker_email",
    label: "Email reports",
    status,
    score: status === "pass" ? 1 : 0.5,
    lastCheckedAt: new Date(),
    dataSource: "RESEND_API_KEY,ADMIN_EMAIL",
    summary:
      status === "pass" ? "RESEND_API_KEY + ADMIN_EMAIL set." : "Email is not fully configured.",
    recommendedRepair: status === "pass" ? undefined : "Set RESEND_API_KEY and ADMIN_EMAIL.",
  };
}

async function ratingClassification(prisma: PrismaClient): Promise<HealthRating> {
  const count = await prisma.adminWorkerTask.count({ where: { taskType: "CLASSIFY_CONTENT" } });
  return {
    key: "admin_worker_classification",
    label: "Content classification",
    status: count > 0 ? "pass" : "warn",
    score: count > 0 ? 1 : 0.5,
    lastCheckedAt: new Date(),
    dataSource: "AdminWorkerTask",
    summary: `${count} classification tasks recorded.`,
  };
}

async function ratingBuilding(prisma: PrismaClient): Promise<HealthRating> {
  const succeeded = await prisma.workerBuildJob.count({ where: { status: "succeeded" } });
  return {
    key: "admin_worker_building",
    label: "Content building",
    status: succeeded > 0 ? "pass" : "warn",
    score: succeeded > 0 ? 1 : 0.5,
    lastCheckedAt: new Date(),
    dataSource: "WorkerBuildJob",
    summary: `${succeeded} successful builds.`,
  };
}

async function ratingFormatting(prisma: PrismaClient): Promise<HealthRating> {
  const recent = await prisma.contentQualityScore.findFirst({
    orderBy: { createdAt: "desc" },
  });
  const score = recent?.formattingScore ?? 0;
  return {
    key: "admin_worker_formatting",
    label: "Content formatting",
    status: score >= 0.8 ? "pass" : score >= 0.5 ? "warn" : "fail",
    score,
    lastCheckedAt: new Date(),
    dataSource: "ContentQualityScore",
    summary: recent ? `Latest formatting score ${score.toFixed(2)}.` : "No formatting scores yet.",
  };
}

async function ratingCrossSource(prisma: PrismaClient): Promise<HealthRating> {
  const recent = await prisma.contentValidationEvidence.count({
    where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
  });
  return {
    key: "admin_worker_cross_source",
    label: "Cross-source validation",
    status: recent > 0 ? "pass" : "warn",
    score: recent > 0 ? 1 : 0.5,
    lastCheckedAt: new Date(),
    dataSource: "ContentValidationEvidence",
    summary: `${recent} validation evidence rows in last 7 days.`,
  };
}

async function ratingStrictQa(prisma: PrismaClient): Promise<HealthRating> {
  const recent = await prisma.checklistQAReport.findFirst({ orderBy: { createdAt: "desc" } });
  const score = recent?.overallScore ?? 0;
  return {
    key: "admin_worker_strict_qa",
    label: "Strict QA",
    status: score >= 0.8 ? "pass" : score >= 0.5 ? "warn" : "fail",
    score,
    lastCheckedAt: new Date(),
    dataSource: "ChecklistQAReport",
    summary: recent ? `Latest QA score ${score.toFixed(2)}.` : "No QA reports yet.",
  };
}

async function ratingPublicRender(prisma: PrismaClient): Promise<HealthRating> {
  const fails = await prisma.postPublishVerification.count({ where: { publicPageCheck: "FAIL" } });
  return {
    key: "admin_worker_public_render",
    label: "Public render gate",
    status: fails === 0 ? "pass" : "fail",
    score: fails === 0 ? 1 : 0.2,
    lastCheckedAt: new Date(),
    dataSource: "PostPublishVerification",
    summary: `${fails} public render failures.`,
  };
}

async function ratingSearchVisibility(prisma: PrismaClient): Promise<HealthRating> {
  const fails = await prisma.postPublishVerification.count({ where: { searchCheck: "FAIL" } });
  return {
    key: "admin_worker_search",
    label: "Search visibility",
    status: fails === 0 ? "pass" : "warn",
    score: fails === 0 ? 1 : 0.5,
    lastCheckedAt: new Date(),
    dataSource: "PostPublishVerification",
    summary: `${fails} search visibility failures.`,
  };
}

async function ratingSitemapVisibility(prisma: PrismaClient): Promise<HealthRating> {
  const fails = await prisma.postPublishVerification.count({ where: { sitemapCheck: "FAIL" } });
  return {
    key: "admin_worker_sitemap",
    label: "Sitemap visibility",
    status: fails === 0 ? "pass" : "warn",
    score: fails === 0 ? 1 : 0.5,
    lastCheckedAt: new Date(),
    dataSource: "PostPublishVerification",
    summary: `${fails} sitemap visibility failures.`,
  };
}

async function ratingCacheFreshness(prisma: PrismaClient): Promise<HealthRating> {
  const fails = await prisma.postPublishVerification.count({ where: { cacheCheck: "FAIL" } });
  return {
    key: "admin_worker_cache",
    label: "Cache freshness",
    status: fails === 0 ? "pass" : "warn",
    score: fails === 0 ? 1 : 0.5,
    lastCheckedAt: new Date(),
    dataSource: "PostPublishVerification",
    summary: `${fails} cache freshness failures.`,
  };
}

const RATINGS: ReadonlyArray<RatingFn> = [
  ratingOverall,
  ratingHeartbeat,
  ratingQueue,
  ratingTaskPlanning,
  ratingSourceDiscovery,
  ratingSourceReading,
  ratingSourceReputation,
  ratingClassification,
  ratingBuilding,
  ratingFormatting,
  ratingCrossSource,
  ratingStrictQa,
  ratingPublishing,
  ratingPublicRender,
  ratingSearchVisibility,
  ratingSitemapVisibility,
  ratingCacheFreshness,
  ratingHomepage,
  ratingCleanupCustodian,
  ratingHumanReview,
  ratingSecurity,
  ratingEmailHealth,
  ratingMonthlyReport,
  ratingDatabaseHealth,
  ratingEnvironmentHealth,
  ratingContentGoals,
  ratingPostPublish,
];

export async function runAdminWorkerDiagnostics(prisma: PrismaClient): Promise<HealthRating[]> {
  const results = await Promise.all(
    RATINGS.map((r) =>
      r(prisma).catch(
        (err) =>
          ({
            key: "admin_worker_rating_error",
            label: "Rating error",
            status: "fail" as HealthStatus,
            score: 0,
            lastCheckedAt: new Date(),
            dataSource: "?",
            summary: err instanceof Error ? err.message : String(err),
          }) satisfies HealthRating,
      ),
    ),
  );
  return results;
}

export function summarizeRatings(ratings: ReadonlyArray<HealthRating>): {
  pass: number;
  warn: number;
  fail: number;
  unknown: number;
} {
  const out = { pass: 0, warn: 0, fail: 0, unknown: 0 };
  for (const r of ratings) out[r.status]++;
  return out;
}
