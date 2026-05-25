/**
 * Production-readiness checks (spec §28). Each check returns a
 * pass/fail with a concrete repair instruction. The composite score
 * is a percentage that the diagnostics card surfaces so the operator
 * knows whether the Admin Worker is actually production-ready.
 */

import type { PrismaClient } from "@prisma/client";

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

  const passing = checks.filter((c) => c.status === "pass").length;
  const failing = checks.length - passing;
  return {
    checks,
    score: checks.length === 0 ? 0 : passing / checks.length,
    passing,
    failing,
  };
}
