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
  // Cross-source validation activity is observed via the
  // VALIDATION-category log emitted by the build engine + post-publish
  // verifier. ContentValidationEvidence was removed with the legacy
  // ingestion tables in migration 0025_drop_legacy_system.
  const recent = await prisma.adminWorkerLog.count({
    where: {
      category: "VALIDATION",
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  });
  return {
    key: "admin_worker_cross_source",
    label: "Cross-source validation",
    status: recent > 0 ? "pass" : "warn",
    score: recent > 0 ? 1 : 0.5,
    lastCheckedAt: new Date(),
    dataSource: "AdminWorkerLog (category=VALIDATION)",
    summary: `${recent} validation log entries in last 7 days.`,
  };
}

async function ratingStrictQa(prisma: PrismaClient): Promise<HealthRating> {
  // Spec §3: Prefer the artifact-level AdminWorkerStrictQAResult
  // (the new durable strict-QA stage). Fall back to ChecklistQAReport
  // when no artifact-level results exist (transitional).
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
  const [total, passed, latest] = await Promise.all([
    prisma.adminWorkerStrictQAResult.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
    prisma.adminWorkerStrictQAResult
      .count({ where: { createdAt: { gte: since }, status: "PASSED" } })
      .catch(() => 0),
    prisma.adminWorkerStrictQAResult
      .findFirst({ orderBy: { createdAt: "desc" } })
      .catch(() => null),
  ]);

  if (total === 0 && !latest) {
    // No artifact-level QA yet — fall back to legacy ChecklistQAReport
    // so existing installations still see a value.
    const recent = await prisma.checklistQAReport.findFirst({ orderBy: { createdAt: "desc" } });
    const score = recent?.overallScore ?? 0;
    return {
      key: "admin_worker_strict_qa",
      label: "Strict QA",
      status: score >= 0.8 ? "pass" : score >= 0.5 ? "warn" : "fail",
      score,
      lastCheckedAt: now,
      dataSource: "ChecklistQAReport (transitional)",
      summary: recent
        ? `Legacy QA score ${score.toFixed(2)}; no artifact-level results yet.`
        : "No QA reports yet.",
      recommendedRepair: "Run a content-goal pass; STRICT_QA stage will create artifact results.",
    };
  }

  const passRate = total === 0 ? 0 : passed / total;
  const status: HealthStatus =
    total === 0 ? "warn" : passRate >= 0.7 ? "pass" : passRate >= 0.4 ? "warn" : "fail";
  return {
    key: "admin_worker_strict_qa",
    label: "Strict QA (AdminWorkerStrictQAResult)",
    status,
    score: status === "pass" ? Math.min(1, passRate) : status === "warn" ? 0.5 : 0,
    lastCheckedAt: now,
    dataSource: "AdminWorkerStrictQAResult (last 7d)",
    latestSuccess: latest?.createdAt,
    summary:
      total === 0
        ? "No strict-QA results in last 7 days."
        : `${passed}/${total} artifacts passed strict QA (${Math.round(passRate * 100)}%); latest finalScore=${latest?.finalScore.toFixed(2) ?? "?"}.`,
    recommendedRepair:
      status === "fail"
        ? "Investigate strict-QA blocking reasons; review NEEDS_REPAIR artifacts."
        : undefined,
  };
}

async function ratingQualityScoring(prisma: PrismaClient): Promise<HealthRating> {
  // Spec §4 + §13: per-publish ContentQualityScore rating.
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
  const [recent, latest] = await Promise.all([
    prisma.contentQualityScore.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
    prisma.contentQualityScore.findFirst({ orderBy: { createdAt: "desc" } }).catch(() => null),
  ]);
  const status: HealthStatus =
    recent === 0 ? "warn" : (latest?.finalScore ?? 0) >= 0.8 ? "pass" : "warn";
  return {
    key: "admin_worker_quality_scoring",
    label: "Quality scoring (ContentQualityScore)",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0,
    lastCheckedAt: now,
    dataSource: "ContentQualityScore (last 7d)",
    latestSuccess: latest?.createdAt,
    summary:
      recent === 0
        ? "No quality scores recorded in last 7 days."
        : `${recent} quality score(s) in last 7d; latest finalScore=${latest?.finalScore.toFixed(2) ?? "?"}.`,
    recommendedRepair:
      recent === 0
        ? "Run a publish pass; the orchestrator records a score per artifact."
        : undefined,
  };
}

async function ratingPackageArtifacts(prisma: PrismaClient): Promise<HealthRating> {
  // Spec §13: surface the per-status counts of AdminWorkerPackageArtifact.
  const now = new Date();
  const [total, buildReady, qaPassed, needsRepair, rejected, published] = await Promise.all([
    prisma.adminWorkerPackageArtifact.count().catch(() => 0),
    prisma.adminWorkerPackageArtifact.count({ where: { status: "BUILD_READY" } }).catch(() => 0),
    prisma.adminWorkerPackageArtifact.count({ where: { status: "QA_PASSED" } }).catch(() => 0),
    prisma.adminWorkerPackageArtifact.count({ where: { status: "NEEDS_REPAIR" } }).catch(() => 0),
    prisma.adminWorkerPackageArtifact.count({ where: { status: "REJECTED" } }).catch(() => 0),
    prisma.adminWorkerPackageArtifact.count({ where: { status: "PUBLISHED" } }).catch(() => 0),
  ]);
  const status: HealthStatus = total === 0 ? "warn" : "pass";
  return {
    key: "admin_worker_package_artifacts",
    label: "Package artifacts",
    status,
    score: total === 0 ? 0.5 : 1,
    lastCheckedAt: now,
    dataSource: "AdminWorkerPackageArtifact",
    summary:
      total === 0
        ? "No package artifacts yet."
        : `Artifacts: ${published} published, ${qaPassed} QA_PASSED, ${buildReady} BUILD_READY, ${needsRepair} NEEDS_REPAIR, ${rejected} REJECTED.`,
    recommendedRepair:
      needsRepair > 0
        ? "Repair NEEDS_REPAIR artifacts before they fall through to rare human review."
        : undefined,
  };
}

async function ratingStructuredBlocks(prisma: PrismaClient): Promise<HealthRating> {
  // Spec §1 + §15: surface structured-block parsing activity.
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
  const [recent, rejected] = await Promise.all([
    prisma.adminWorkerSourceBlock.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
    prisma.adminWorkerSourceBlock
      .count({ where: { createdAt: { gte: since }, isRejected: true } })
      .catch(() => 0),
  ]);
  const status: HealthStatus = recent === 0 ? "warn" : "pass";
  return {
    key: "admin_worker_structured_blocks",
    label: "Structured source blocks",
    status,
    score: recent === 0 ? 0.5 : 1,
    lastCheckedAt: now,
    dataSource: "AdminWorkerSourceBlock (last 7d)",
    summary:
      recent === 0
        ? "No structured blocks created in last 7 days."
        : `${recent} blocks created (${rejected} rejected as junk).`,
    recommendedRepair:
      recent === 0
        ? "Run a source-fetch pass; readSource will parse and persist blocks."
        : undefined,
  };
}

async function ratingCandidateScoring(prisma: PrismaClient): Promise<HealthRating> {
  // Spec §13: candidate-scorer rating from CandidateSourceUrl.fetchPriority.
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
  const [scored, total] = await Promise.all([
    prisma.candidateSourceUrl
      .count({ where: { createdAt: { gte: since }, fetchPriority: { gt: 0 } } })
      .catch(() => 0),
    prisma.candidateSourceUrl.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
  ]);
  const rate = total === 0 ? 0 : scored / total;
  const status: HealthStatus =
    total === 0 ? "warn" : rate >= 0.8 ? "pass" : rate >= 0.5 ? "warn" : "fail";
  return {
    key: "admin_worker_candidate_scoring",
    label: "Candidate scoring",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0,
    lastCheckedAt: now,
    dataSource: "CandidateSourceUrl.fetchPriority (last 7d)",
    summary:
      total === 0
        ? "No candidate URLs scored in last 7 days."
        : `${scored}/${total} candidates carry a non-zero fetchPriority (${Math.round(rate * 100)}%).`,
    recommendedRepair:
      status === "fail" ? "Re-run candidate scoring (rescoreAllCandidates)." : undefined,
  };
}

async function ratingExtractors(prisma: PrismaClient): Promise<HealthRating> {
  // Spec §13: extractors rating from package-artifact confidence.
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
  const [created, withFields] = await Promise.all([
    prisma.adminWorkerPackageArtifact
      .count({ where: { createdAt: { gte: since } } })
      .catch(() => 0),
    prisma.adminWorkerPackageArtifact
      .count({ where: { createdAt: { gte: since }, confidenceScore: { gte: 0.5 } } })
      .catch(() => 0),
  ]);
  const rate = created === 0 ? 0 : withFields / created;
  const status: HealthStatus =
    created === 0 ? "warn" : rate >= 0.7 ? "pass" : rate >= 0.4 ? "warn" : "fail";
  return {
    key: "admin_worker_extractors",
    label: "Extractors",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0,
    lastCheckedAt: now,
    dataSource: "AdminWorkerPackageArtifact.confidenceScore (last 7d)",
    summary:
      created === 0
        ? "No package artifacts extracted in last 7 days."
        : `${withFields}/${created} artifacts have confidence >= 0.5 (${Math.round(rate * 100)}%).`,
    recommendedRepair:
      status === "fail"
        ? "Investigate low-confidence extractions; check structured blocks."
        : undefined,
  };
}

async function ratingChecklistBridge(prisma: PrismaClient): Promise<HealthRating> {
  // Spec §13: checklist + citation bridge — artifacts with a
  // checklistItemId have been promoted to checklist items.
  const now = new Date();
  const [total, bridged] = await Promise.all([
    prisma.adminWorkerPackageArtifact.count().catch(() => 0),
    prisma.adminWorkerPackageArtifact
      .count({ where: { checklistItemId: { not: null } } })
      .catch(() => 0),
  ]);
  const rate = total === 0 ? 0 : bridged / total;
  const status: HealthStatus =
    total === 0 ? "warn" : rate >= 0.6 ? "pass" : rate >= 0.3 ? "warn" : "fail";
  return {
    key: "admin_worker_checklist_bridge",
    label: "Checklist + citation bridge",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0,
    lastCheckedAt: now,
    dataSource: "AdminWorkerPackageArtifact.checklistItemId",
    summary:
      total === 0
        ? "No package artifacts to bridge yet."
        : `${bridged}/${total} artifacts bridged to ChecklistItem (${Math.round(rate * 100)}%).`,
    recommendedRepair:
      status === "fail"
        ? "Run the CHECKLIST_CREATION / CITATION_CREATION dispatcher stages."
        : undefined,
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

/**
 * Spec §18 — legacy `WorkerHeartbeat` table. The Admin Worker writes
 * a compatibility heartbeat there too, so this rating distinguishes
 * "build-queue worker has a heartbeat" from the Admin Worker's own
 * heartbeat (ratingHeartbeat above).
 */
async function ratingLegacyWorkerHeartbeat(prisma: PrismaClient): Promise<HealthRating> {
  const recent = await prisma.workerHeartbeat
    .findFirst({ orderBy: { lastHeartbeatAt: "desc" } })
    .catch(() => null);
  const now = new Date();
  const ageMs = recent ? now.getTime() - recent.lastHeartbeatAt.getTime() : Infinity;
  const status: HealthStatus = ageMs < 5 * 60_000 ? "pass" : ageMs < 60 * 60_000 ? "warn" : "fail";
  return {
    key: "admin_worker_legacy_heartbeat",
    label: "Build queue worker heartbeat (legacy)",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0,
    lastCheckedAt: now,
    dataSource: "WorkerHeartbeat",
    latestSuccess: recent?.lastHeartbeatAt ?? null,
    summary: recent
      ? `Legacy heartbeat ${Math.round(ageMs / 1000)}s ago.`
      : "No legacy worker heartbeat — only Admin Worker heartbeat in use.",
  };
}

async function ratingLastPassTime(prisma: PrismaClient): Promise<HealthRating> {
  const recent = await prisma.adminWorkerPass.findFirst({
    orderBy: { startedAt: "desc" },
    select: { startedAt: true, status: true },
  });
  const now = new Date();
  const ageMs = recent ? now.getTime() - recent.startedAt.getTime() : Infinity;
  const status: HealthStatus = ageMs < 10 * 60_000 ? "pass" : ageMs < 60 * 60_000 ? "warn" : "fail";
  return {
    key: "admin_worker_last_pass",
    label: "Last Admin Worker pass",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0,
    lastCheckedAt: now,
    dataSource: "AdminWorkerPass.startedAt",
    latestSuccess: recent?.startedAt ?? null,
    summary: recent
      ? `Last pass ${Math.round(ageMs / 1000)}s ago (status: ${recent.status}).`
      : "No pass recorded yet.",
  };
}

async function ratingLastTaskTime(prisma: PrismaClient): Promise<HealthRating> {
  const recent = await prisma.adminWorkerTask.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, taskType: true },
  });
  const now = new Date();
  const ageMs = recent ? now.getTime() - recent.createdAt.getTime() : Infinity;
  const status: HealthStatus =
    ageMs < 60 * 60_000 ? "pass" : ageMs < 24 * 60 * 60_000 ? "warn" : "fail";
  return {
    key: "admin_worker_last_task",
    label: "Last Admin Worker task",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0,
    lastCheckedAt: now,
    dataSource: "AdminWorkerTask.createdAt",
    latestSuccess: recent?.createdAt ?? null,
    summary: recent
      ? `Last task ${Math.round(ageMs / 60_000)}min ago (type: ${recent.taskType}).`
      : "No tasks recorded yet.",
  };
}

// ── Spec §18 subsystem ratings ─────────────────────────────────────

async function ratingBrain(prisma: PrismaClient): Promise<HealthRating> {
  const now = new Date();
  const decision = await prisma.adminWorkerDecision
    .findFirst({ where: { decisionType: "brain_pass" }, orderBy: { createdAt: "desc" } })
    .catch(() => null);
  if (!decision) {
    return {
      key: "admin_worker_brain",
      label: "Brain (ranked-action engine)",
      status: "fail",
      score: 0,
      lastCheckedAt: now,
      dataSource: "AdminWorkerDecision.decisionType=brain_pass",
      summary: "No brain decisions recorded yet.",
      recommendedRepair: "Run a worker pass — the brain writes a decision on every cycle.",
    };
  }
  const ageMs = now.getTime() - decision.createdAt.getTime();
  const status: HealthStatus = ageMs < 10 * 60_000 ? "pass" : ageMs < 60 * 60_000 ? "warn" : "fail";
  return {
    key: "admin_worker_brain",
    label: "Brain (ranked-action engine)",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0,
    lastCheckedAt: now,
    dataSource: "AdminWorkerDecision.createdAt",
    latestSuccess: decision.createdAt,
    summary: `Last brain decision ${Math.round(ageMs / 60_000)}min ago: ${decision.chosenAction}.`,
    recommendedRepair:
      status === "pass" ? undefined : "Run a worker pass to refresh the brain decision.",
  };
}

async function ratingMissionPlanner(prisma: PrismaClient): Promise<HealthRating> {
  const now = new Date();
  const pipelineStages = await prisma.adminWorkerPipelineStage.count().catch(() => 0);
  const status: HealthStatus = pipelineStages > 0 ? "pass" : "warn";
  return {
    key: "admin_worker_mission_planner",
    label: "Mission planner + pipeline tracking",
    status,
    score: status === "pass" ? 1 : 0.5,
    lastCheckedAt: now,
    dataSource: "AdminWorkerPipelineStage",
    summary: `${pipelineStages} pipeline stage row(s) recorded.`,
    recommendedRepair: status === "pass" ? undefined : "Run a content-goal pass.",
  };
}

async function ratingFetcher(prisma: PrismaClient): Promise<HealthRating> {
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60_000);
  const [recent, succeeded] = await Promise.all([
    prisma.adminWorkerFetchResult.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
    prisma.adminWorkerFetchResult
      .count({ where: { createdAt: { gte: since }, succeeded: true } })
      .catch(() => 0),
  ]);
  const rate = recent === 0 ? 0 : succeeded / recent;
  const status: HealthStatus =
    recent === 0 ? "warn" : rate >= 0.8 ? "pass" : rate >= 0.5 ? "warn" : "fail";
  return {
    key: "admin_worker_fetcher",
    label: "Fetcher",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0,
    lastCheckedAt: now,
    dataSource: "AdminWorkerFetchResult (last 24h)",
    summary:
      recent === 0
        ? "No fetch attempts in last 24h."
        : `${succeeded}/${recent} fetches succeeded (${Math.round(rate * 100)}%).`,
    recommendedRepair:
      status === "fail"
        ? "Investigate fetch failures; check approved hosts and rate limits."
        : status === "warn"
          ? "Schedule a discovery pass to surface new candidates."
          : undefined,
  };
}

async function ratingVerifier(prisma: PrismaClient): Promise<HealthRating> {
  const now = new Date();
  const count = await prisma.adminWorkerCrossSourceVerification.count().catch(() => 0);
  const status: HealthStatus = count > 0 ? "pass" : "warn";
  return {
    key: "admin_worker_verifier",
    label: "Cross-source verifier",
    status,
    score: status === "pass" ? 1 : 0.5,
    lastCheckedAt: now,
    dataSource: "AdminWorkerCrossSourceVerification",
    summary: `${count} verification row(s) recorded.`,
    recommendedRepair:
      status === "pass"
        ? undefined
        : "Run a CROSS_SOURCE_VERIFICATION pass to populate evidence rows.",
  };
}

async function ratingRepairOrchestrator(prisma: PrismaClient): Promise<HealthRating> {
  const now = new Date();
  const [pending, abandoned] = await Promise.all([
    prisma.adminWorkerRepairPlan
      .count({ where: { status: { in: ["PENDING", "RUNNING"] } } })
      .catch(() => 0),
    prisma.adminWorkerRepairPlan.count({ where: { status: "ABANDONED" } }).catch(() => 0),
  ]);
  const status: HealthStatus = abandoned > 5 ? "fail" : pending > 10 ? "warn" : "pass";
  return {
    key: "admin_worker_repair_orchestrator",
    label: "Repair orchestrator",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0,
    lastCheckedAt: now,
    dataSource: "AdminWorkerRepairPlan",
    summary: `${pending} pending plan(s), ${abandoned} abandoned.`,
    recommendedRepair:
      status === "fail"
        ? "Investigate abandoned repair plans; raise maxAttempts or rework the failing path."
        : status === "warn"
          ? "Run a REPAIR pass to drain pending plans."
          : undefined,
  };
}

async function ratingGrowthOrchestrator(prisma: PrismaClient): Promise<HealthRating> {
  const now = new Date();
  const count = await prisma.adminWorkerGrowthSnapshot.count().catch(() => 0);
  const status: HealthStatus = count > 0 ? "pass" : "warn";
  return {
    key: "admin_worker_growth_orchestrator",
    label: "Growth orchestrator",
    status,
    score: status === "pass" ? 1 : 0.5,
    lastCheckedAt: now,
    dataSource: "AdminWorkerGrowthSnapshot",
    summary: `${count} growth snapshot(s) recorded.`,
    recommendedRepair:
      status === "pass" ? undefined : "Run a REPORTING pass to populate growth snapshots.",
  };
}

async function ratingSourceCoverage(prisma: PrismaClient): Promise<HealthRating> {
  const now = new Date();
  const [total, blocked] = await Promise.all([
    prisma.adminWorkerSourceCoverage.count().catch(() => 0),
    prisma.adminWorkerSourceCoverage.count({ where: { blockedByCoverage: true } }).catch(() => 0),
  ]);
  const status: HealthStatus =
    total === 0 ? "warn" : blocked > total / 3 ? "fail" : blocked > 0 ? "warn" : "pass";
  return {
    key: "admin_worker_source_coverage",
    label: "Source coverage (per content type)",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0,
    lastCheckedAt: now,
    dataSource: "AdminWorkerSourceCoverage",
    summary:
      total === 0
        ? "No source coverage scored yet."
        : `${blocked}/${total} content type(s) blocked by source coverage.`,
    recommendedRepair:
      status === "fail"
        ? "Add approved primary sources for blocked content types via the source registry."
        : status === "warn"
          ? "Schedule a REPORTING pass + review the coverage scorecard."
          : undefined,
  };
}

const RATINGS: ReadonlyArray<RatingFn> = [
  ratingOverall,
  ratingBrain,
  ratingMissionPlanner,
  ratingHeartbeat,
  ratingLegacyWorkerHeartbeat,
  ratingLastPassTime,
  ratingLastTaskTime,
  ratingQueue,
  ratingTaskPlanning,
  ratingSourceDiscovery,
  ratingFetcher,
  ratingSourceReading,
  ratingSourceReputation,
  ratingSourceCoverage,
  ratingClassification,
  ratingBuilding,
  ratingFormatting,
  ratingCandidateScoring,
  ratingExtractors,
  ratingChecklistBridge,
  ratingVerifier,
  ratingCrossSource,
  ratingStructuredBlocks,
  ratingPackageArtifacts,
  ratingStrictQa,
  ratingQualityScoring,
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
  ratingGrowthOrchestrator,
  ratingRepairOrchestrator,
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
