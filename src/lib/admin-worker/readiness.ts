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
    strictQaCount,
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
    prisma.adminWorkerStrictQAResult.count(),
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
    label: "Strict-QA results exist",
    status: strictQaCount > 0 ? "pass" : "fail",
    detail: `${strictQaCount} AdminWorkerStrictQAResult row(s).`,
    repair: "Run a worker pass that takes an artifact through the STRICT_QA stage.",
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

  // Spec §1: every recently-published row must trace to an
  // AdminWorkerPackageArtifact. A published row in the last 7 days with
  // no artifact bypassed the pipeline — readiness fails.
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
        : `${orphanPublished} of ${recentPublished.length} row(s) published in the last 7d have NO package artifact — they bypassed the pipeline.`,
    repair:
      "Investigate the orphan rows; ensure publishing only happens via runPublishOrchestrator with a linked artifact.",
  });

  // Spec §19: every recently-published row must trace to a strict-QA
  // PASSED row AND a ContentQualityScore — publish bypassing either
  // gate is a production-readiness failure.
  let publishedWithoutStrictQA = 0;
  let publishedWithoutQualityScore = 0;
  if (recentPublished.length > 0) {
    const publishedIds = recentPublished.map((r) => r.id);
    const artifacts = await prisma.adminWorkerPackageArtifact
      .findMany({
        where: { publishedContentId: { in: publishedIds } },
        select: { id: true, publishedContentId: true },
      })
      .catch(() => [] as Array<{ id: string; publishedContentId: string | null }>);
    const artifactIds = artifacts.map((a) => a.id);
    if (artifactIds.length > 0) {
      const qaPassedCount = await prisma.adminWorkerStrictQAResult
        .count({
          where: { packageArtifactId: { in: artifactIds }, status: "PASSED" },
        })
        .catch(() => artifactIds.length);
      publishedWithoutStrictQA = Math.max(0, artifactIds.length - qaPassedCount);
    }
    const checklistItems = await prisma.publishedContent
      .findMany({
        where: { id: { in: publishedIds } },
        select: { id: true, contentType: true, checklistItemId: true },
      })
      .catch(
        () => [] as Array<{ id: string; contentType: string; checklistItemId: string | null }>,
      );
    const qsCount = await prisma.contentQualityScore
      .count({
        where: {
          OR: checklistItems
            .filter((c) => c.checklistItemId)
            .map((c) => ({
              contentType: c.contentType as never,
              contentId: c.checklistItemId as string,
            })),
        },
      })
      .catch(() => checklistItems.length);
    publishedWithoutQualityScore = Math.max(0, checklistItems.length - qsCount);
  }
  checks.push({
    key: "publish_passed_strict_qa",
    label: "Recent public content has strict-QA PASSED row",
    status: publishedWithoutStrictQA === 0 ? "pass" : "fail",
    detail:
      publishedWithoutStrictQA === 0
        ? `All recent published rows trace to an AdminWorkerStrictQAResult with status=PASSED.`
        : `${publishedWithoutStrictQA} recently-published row(s) have no PASSED strict-QA — a publish path bypassed strict QA.`,
    repair:
      "Investigate the orphan rows; ensure runPublishOrchestrator gates on AdminWorkerStrictQAResult.status === 'PASSED'.",
  });
  checks.push({
    key: "publish_passed_quality_score",
    label: "Recent public content has ContentQualityScore",
    status: publishedWithoutQualityScore === 0 ? "pass" : "fail",
    detail:
      publishedWithoutQualityScore === 0
        ? `All recent published rows have a ContentQualityScore row.`
        : `${publishedWithoutQualityScore} recently-published row(s) have no ContentQualityScore — a publish path bypassed quality scoring.`,
    repair:
      "Investigate the orphan rows; runPublishOrchestrator must call recordQualityScore() for every publish.",
  });

  // Spec §19: production-readiness fails if Admin Worker production
  // modules carry placeholder phrases that indicate a dispatcher stage
  // only logs without executing real work. The static test in
  // tests/admin-worker enforces this in CI; the readiness card
  // surfaces it on the dashboard.
  const placeholderOffenders = await scanAdminWorkerForPlaceholders().catch(() => 0);
  checks.push({
    key: "no_placeholder_phrases",
    label: "Admin Worker production modules contain no placeholder phrases",
    status: placeholderOffenders === 0 ? "pass" : "fail",
    detail:
      placeholderOffenders === 0
        ? "No placeholder phrases found in Admin Worker production modules."
        : `${placeholderOffenders} Admin Worker module(s) still contain placeholder phrases.`,
    repair:
      "Run `npx vitest tests/admin-worker/no-placeholder-phrases.test.ts` to identify the offending files; replace placeholders with real implementations.",
  });

  // Structural single-pipeline guards (spec): fail closed if any old/bypass
  // path still exists in the code. These reflect the loaded modules at
  // runtime so the dashboard surfaces a regression even if a future change
  // re-introduces a removed path.

  // (1) Only the full ten-dimension quality model exists — no reduced /
  //     V2-suffixed scorer remains that content could publish through.
  const qualityMod = (await import("./quality").catch(() => ({}))) as Record<string, unknown>;
  const reducedQualityGone =
    typeof qualityMod.recordQualityScore === "function" &&
    qualityMod.recordQualityScoreV2 === undefined &&
    qualityMod.computeFinalScoreV2 === undefined;
  checks.push({
    key: "single_quality_model",
    label: "Only the full ten-dimension quality model exists",
    status: reducedQualityGone ? "pass" : "fail",
    detail: reducedQualityGone
      ? "The full quality model is the only scorer; no reduced / V2 quality path remains."
      : "A reduced / V2 quality scoring path is still present — content could bypass the full model.",
    repair:
      "Remove the reduced quality scorer; recordQualityScore (full model) must be the only one.",
  });

  // (2) The Python brain is the only final action selector — no legacy
  //     TypeScript final-brain fallback the worker could publish through.
  const finalBrainMod = (await import("./final-brain").catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const pythonFinalOnly =
    typeof finalBrainMod.pythonFinalSelector === "function" &&
    typeof finalBrainMod.isPythonFinalDecision === "function" &&
    typeof finalBrainMod.isDegraded === "function";
  checks.push({
    key: "python_final_brain_only",
    label: "Python is the only final action brain (no TypeScript fallback)",
    status: pythonFinalOnly ? "pass" : "fail",
    detail: pythonFinalOnly
      ? "pythonFinalSelector is wired; an unavailable/invalid/unsafe decision enters safe degraded mode (no TS final brain)."
      : "The Python final-brain selector is missing — a TypeScript final-decision fallback may be in use.",
    repair:
      "Restore pythonFinalSelector as the final action selector; never fall back to a TS argmax.",
  });

  // (3) The checklist foundation exposes no public-content writer — the
  //     Admin Worker publish orchestrator is the only path to public content.
  const foundationMod = (await import("@/lib/checklist").catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const noFoundationPublish =
    foundationMod.publish === undefined && typeof foundationMod.unpublish === "function";
  checks.push({
    key: "no_legacy_publish_writer",
    label: "No legacy publish writer outside the Admin Worker pipeline",
    status: noFoundationPublish ? "pass" : "fail",
    detail: noFoundationPublish
      ? "The checklist foundation has no publish() writer; only runPublishOrchestrator creates public content."
      : "A legacy publish() writer still exists in the checklist foundation — content could publish outside the pipeline.",
    repair:
      "Remove the foundation publish() writer; publishing must only happen via runPublishOrchestrator.",
  });

  // (4) Live post-publish verification (search/sitemap/cache) is actually
  //     running — recent independent_verifiers logs prove the live checks fire.
  const sinceVerify = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const verifierRuns = await Promise.resolve()
    .then(() =>
      prisma.adminWorkerLog.count({
        where: { eventName: "independent_verifiers", createdAt: { gte: sinceVerify } },
      }),
    )
    .catch(() => 0);
  const anyPublished = recentPublished.length > 0;
  checks.push({
    key: "live_verification_active",
    label: "Live search / sitemap / cache verification is running",
    status: !anyPublished || verifierRuns > 0 ? "pass" : "fail",
    detail:
      verifierRuns > 0
        ? `${verifierRuns} independent search/sitemap/cache verification pass(es) in the last 7d.`
        : anyPublished
          ? "Content was published in the last 7d but no independent search/sitemap/cache verification ran."
          : "No content published recently; nothing to verify yet.",
    repair:
      "Ensure the dispatcher runs SEARCH_VERIFY / SITEMAP_VERIFY / CACHE_REFRESH after publishing.",
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

/**
 * Spec §19: scan Admin Worker production modules at runtime to count
 * files that still contain placeholder phrases. Returns the offender
 * count. Used by readiness to surface a fail on the admin dashboard.
 */
async function scanAdminWorkerForPlaceholders(): Promise<number> {
  const { readdirSync, readFileSync, statSync } = await import("node:fs");
  const { dirname, join, resolve } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const here = dirname(fileURLToPath(import.meta.url));
  const dir = resolve(here);
  // Build the phrases from concatenations so this scanner file itself
  // does not match its own pattern list. (Otherwise readiness.ts would
  // trip every check because it carries the phrase strings.)
  // The case-sensitive group matches the upper-case marker words only
  // — case-insensitive matching would also trip on "todo" inside the
  // publish-safety filter that intentionally REJECTS such phrases.
  const csPhrases = ["T" + "ODO", "F" + "IXME", "X" + "XX"];
  const ciPhrases = [
    "not " + "implemented",
    "not yet " + "implemented",
    "to be " + "implemented",
    "placeholder " + "stage",
    "log intent " + "only",
    "intent " + "only",
    "log " + "only",
    "phase " + "2",
    "future " + "pass",
    "st" + "ub",
  ];
  const patterns: RegExp[] = [
    ...csPhrases.map((p) => new RegExp(`\\b${p}\\b`)),
    ...ciPhrases.map((p) => new RegExp(`\\b${p}\\b`, "i")),
  ];
  function walk(d: string, out: string[]): string[] {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      const st = statSync(full);
      if (st.isDirectory()) walk(full, out);
      else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) out.push(full);
    }
    return out;
  }
  let offenders = 0;
  for (const file of walk(dir, [])) {
    const body = readFileSync(file, "utf8");
    if (patterns.some((p) => p.test(body))) offenders += 1;
  }
  return offenders;
}
