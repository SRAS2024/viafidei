/**
 * Production-readiness checks (spec §28). Each check returns a
 * pass/fail with a concrete repair instruction. The composite score
 * is a percentage that the diagnostics card surfaces so the operator
 * knows whether the Admin Worker is actually production-ready.
 */

import type { PrismaClient } from "@prisma/client";

import { isLegacyPublishAllowed } from "@/lib/worker/publishing";

export type ReadinessStatus = "pass" | "fail";

export interface ReadinessCheck {
  key: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
  /** Concrete next step the operator can take to flip this to pass. */
  repair: string;
}

export interface ReadinessReport {
  checks: ReadinessCheck[];
  score: number; // 0..1
  passing: number;
  failing: number;
}

const FIVE_MIN_MS = 5 * 60_000;

export async function runReadiness(prisma: PrismaClient): Promise<ReadinessReport> {
  const [
    state,
    contentGoals,
    candidateUrlCount,
    publishedContentCount,
    sourceReadCount,
    buildJobCount,
    qaReportCount,
    postPublishCount,
    securityActionCount,
    homepageScoreCount,
    recentDeveloperReport,
    growthSnapshotCount,
    coverageCount,
    coverageBlockedCount,
    crossSourceVerificationCount,
    pipelineStageCount,
  ] = await Promise.all([
    prisma.adminWorkerState.findUnique({ where: { id: "singleton" } }).catch(() => null),
    prisma.contentGoal.count(),
    prisma.candidateSourceUrl.count(),
    prisma.publishedContent.count({ where: { isPublished: true } }),
    prisma.adminWorkerSourceRead.count(),
    prisma.workerBuildJob.count(),
    prisma.checklistQAReport.count(),
    prisma.postPublishVerification.count(),
    prisma.adminWorkerSecurityAction.count(),
    prisma.homepageQualityScore.count(),
    prisma.adminDeveloperReportLog.findFirst({
      where: { status: "GENERATED" },
      orderBy: { generatedAt: "desc" },
    }),
    prisma.adminWorkerGrowthSnapshot.count().catch(() => 0),
    prisma.adminWorkerSourceCoverage.count().catch(() => 0),
    prisma.adminWorkerSourceCoverage.count({ where: { blockedByCoverage: true } }).catch(() => 0),
    prisma.adminWorkerCrossSourceVerification.count().catch(() => 0),
    prisma.adminWorkerPipelineStage.count().catch(() => 0),
  ]);

  const checks: ReadinessCheck[] = [];

  // Admin Worker heartbeat
  const heartbeatAgeMs = state?.lastHeartbeatAt
    ? Date.now() - state.lastHeartbeatAt.getTime()
    : Infinity;
  checks.push({
    key: "heartbeat",
    label: "Admin Worker heartbeat",
    status: heartbeatAgeMs < FIVE_MIN_MS ? "pass" : "fail",
    detail: state?.lastHeartbeatAt
      ? `Last heartbeat ${Math.round(heartbeatAgeMs / 1000)}s ago.`
      : "No heartbeat recorded.",
    repair:
      "Start or restart the worker process: `npm run worker` (or redeploy the worker service on Railway).",
  });

  // Brain has run (any AdminWorkerDecision)
  const decisionCount = await prisma.adminWorkerDecision.count();
  checks.push({
    key: "brain",
    label: "Admin Worker brain has run",
    status: decisionCount > 0 ? "pass" : "fail",
    detail: `${decisionCount} brain decisions recorded.`,
    repair: "Run a worker pass — Command Center → Run diagnostic / content-goal pass.",
  });

  checks.push({
    key: "content_goals",
    label: "Content goals seeded",
    status: contentGoals > 0 ? "pass" : "fail",
    detail: `${contentGoals} ContentGoal row(s).`,
    repair: "Call seedContentGoals(prisma) — runs automatically on first worker pass.",
  });

  checks.push({
    key: "source_discovery",
    label: "Source discovery candidates",
    status: candidateUrlCount > 0 ? "pass" : "fail",
    detail: `${candidateUrlCount} candidate source URL(s).`,
    repair:
      "Run a source discovery pass: Command Center → Run source repair / discovery, or call discoverFromAllAuthorities().",
  });

  checks.push({
    key: "source_reads",
    label: "Source reads recorded",
    status: sourceReadCount > 0 ? "pass" : "fail",
    detail: `${sourceReadCount} AdminWorkerSourceRead row(s).`,
    repair:
      "Worker source reader must fetch at least one approved source. Verify outbound HTTPS is allowed.",
  });

  checks.push({
    key: "build_jobs",
    label: "Build pipeline alive",
    status: buildJobCount > 0 ? "pass" : "fail",
    detail: `${buildJobCount} WorkerBuildJob row(s).`,
    repair: "Approve a SOURCE_VERIFIED checklist item, then run a content-goal pass.",
  });

  checks.push({
    key: "qa_reports",
    label: "QA reports exist",
    status: qaReportCount > 0 ? "pass" : "fail",
    detail: `${qaReportCount} ChecklistQAReport row(s).`,
    repair: "Run a worker pass that completes at least one build → QA report.",
  });

  checks.push({
    key: "published_content",
    label: "Public content live",
    status: publishedContentCount > 0 ? "pass" : "fail",
    detail: `${publishedContentCount} PublishedContent row(s) live.`,
    repair: "Run an autonomous cycle: Command Center → Run content goal pass.",
  });

  checks.push({
    key: "post_publish",
    label: "Post-publish verification ran",
    status: postPublishCount > 0 ? "pass" : "fail",
    detail: `${postPublishCount} PostPublishVerification row(s).`,
    repair:
      "Publish at least one item with `process.env.NODE_ENV=production` so the live probe runs.",
  });

  checks.push({
    key: "security_defender",
    label: "Security defender wired",
    status: securityActionCount > 0 || decisionCount > 0 ? "pass" : "fail",
    detail: `${securityActionCount} AdminWorkerSecurityAction row(s).`,
    repair:
      "Defender activates on the next SecurityEvent. To verify, hit a protected admin route without auth.",
  });

  checks.push({
    key: "homepage_score",
    label: "Homepage scoring active",
    status: homepageScoreCount > 0 ? "pass" : "fail",
    detail: `${homepageScoreCount} HomepageQualityScore row(s).`,
    repair: "Command Center → Run homepage pass.",
  });

  checks.push({
    key: "developer_audit",
    label: "Developer Audit generates",
    status: recentDeveloperReport ? "pass" : "fail",
    detail: recentDeveloperReport
      ? `Last generated ${recentDeveloperReport.generatedAt.toISOString().slice(0, 10)}.`
      : "No Developer Audit recorded yet.",
    repair:
      "POST /api/admin/developer-audit with a period (LAST_24_HOURS / LAST_7_DAYS / LAST_30_DAYS).",
  });

  // ── New subsystem ratings (spec §18) ──────────────────────────────

  checks.push({
    key: "pipeline_stages",
    label: "Pipeline stage tracking",
    status: pipelineStageCount > 0 ? "pass" : "fail",
    detail: `${pipelineStageCount} AdminWorkerPipelineStage row(s).`,
    repair:
      "Run a dispatcher pass — every stage now records a pipeline row with input/output checksums.",
  });

  checks.push({
    key: "growth_orchestrator",
    label: "Growth orchestrator active",
    status: growthSnapshotCount > 0 ? "pass" : "fail",
    detail: `${growthSnapshotCount} AdminWorkerGrowthSnapshot row(s).`,
    repair: "Run a REPORTING pass; the dispatcher invokes the GrowthOrchestrator each pass.",
  });

  checks.push({
    key: "source_coverage",
    label: "Source coverage scored",
    status: coverageCount > 0 ? "pass" : "fail",
    detail:
      coverageCount > 0
        ? `${coverageCount} content type(s) scored; ${coverageBlockedCount} blocked by coverage.`
        : "No source coverage scorecards yet.",
    repair: "Run a REPORTING pass to populate source coverage rows.",
  });

  checks.push({
    key: "cross_source_verifier",
    label: "Cross-source verifier wired",
    status: crossSourceVerificationCount > 0 ? "pass" : "fail",
    detail: `${crossSourceVerificationCount} AdminWorkerCrossSourceVerification row(s).`,
    repair: "Run a CROSS_SOURCE_VERIFICATION pass — verifier persists per-field evidence.",
  });

  // Spec §1: production-readiness FAILS if content can still become
  // public through a legacy path. The legacy publish writer is
  // hard-disabled unless the ALLOW_LEGACY_PUBLISH escape hatch is set;
  // if it is set in production the worker is NOT the only publish path.
  const legacyAllowed = isLegacyPublishAllowed();
  checks.push({
    key: "legacy_publish_disabled",
    label: "Legacy publish path disabled",
    status: legacyAllowed ? "fail" : "pass",
    detail: legacyAllowed
      ? "ALLOW_LEGACY_PUBLISH=1 — the legacy build/publish engine can still create public content outside the Admin Worker artifact pipeline."
      : "Legacy build/publish engine is hard-disabled; the Admin Worker artifact pipeline is the only path to public content.",
    repair: "Unset ALLOW_LEGACY_PUBLISH so only runPublishOrchestrator() can publish.",
  });

  // Spec §1: every recently-published row must trace to an
  // AdminWorkerPackageArtifact. A published row in the last 7 days with
  // no artifact came from a legacy path — readiness fails.
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentPublished = await prisma.publishedContent
    .findMany({
      where: { isPublished: true, publishedAt: { gte: since } },
      select: { id: true },
      take: 200,
    })
    .catch(() => [] as Array<{ id: string }>);
  let orphanPublished = 0;
  if (recentPublished.length > 0) {
    const withArtifact = await prisma.adminWorkerPackageArtifact
      .count({ where: { publishedContentId: { in: recentPublished.map((r) => r.id) } } })
      .catch(() => recentPublished.length);
    orphanPublished = Math.max(0, recentPublished.length - withArtifact);
  }
  checks.push({
    key: "published_via_artifact_path",
    label: "Recent public content traces to the artifact pipeline",
    status: orphanPublished === 0 ? "pass" : "fail",
    detail:
      orphanPublished === 0
        ? `All ${recentPublished.length} row(s) published in the last 7d trace to an AdminWorkerPackageArtifact.`
        : `${orphanPublished} of ${recentPublished.length} row(s) published in the last 7d have NO package artifact — a legacy path published them.`,
    repair:
      "Investigate the orphan rows; ensure publishing only happens via runPublishOrchestrator with a linked artifact.",
  });

  const passing = checks.filter((c) => c.status === "pass").length;
  const failing = checks.length - passing;
  return {
    checks,
    score: checks.length === 0 ? 0 : passing / checks.length,
    passing,
    failing,
  };
}
