import { redirect } from "next/navigation";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";
import {
  computeContentFunnel,
  contentGoalStatusLabel,
  countPendingReview,
  deriveStatus,
  getAdminWorkerState,
  listRecentPasses,
  listRecentSecurityActions,
  refreshContentGoals,
  runAdminWorkerDiagnostics,
  runReadiness,
  summarizeRatings,
} from "@/lib/admin-worker";
import { loadCommandCenterMetrics } from "@/lib/admin-worker/metrics";
import { dailyReadingsCoverage } from "@/lib/admin-worker/daily-readings";
import { planMission } from "@/lib/admin-worker/mission-planner";
import { CATALOG_DERIVED_TYPES, computeContentCatalog } from "@/lib/content-shared/content-catalog";
import { AdminWorkerPauseToggle } from "./AdminWorkerPauseToggle";
import { AdminWorkerControls } from "./AdminWorkerControls";
import { RequestHomepageMakeoverButton } from "./RequestHomepageMakeoverButton";
import { DeveloperAuditButton } from "../diagnostics/DeveloperAuditButton";
import { Card, DataTable, Empty, Field, SectionHeading, Stat, StatusPill, type Tone } from "./_ui";

export const dynamic = "force-dynamic";

/**
 * Admin Worker · Command Center.
 *
 * One organised overview of the autonomous content / diagnostics / design /
 * security / maintenance system, grouped into clear sections: worker health,
 * content & coverage, pipeline & diagnostics, quality & safety, and brain &
 * learning. Every figure is read live from Postgres.
 */
export default async function AdminWorkerPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  // Refresh content goals before reading so the page shows live counts.
  await refreshContentGoals(prisma).catch(() => {});

  const [
    state,
    ratings,
    recentPasses,
    recentSecurity,
    pendingReview,
    goals,
    recentDraft,
    metrics,
    readiness,
    recentBrainDecision,
    mission,
    growthSnapshots,
    coverageRows,
    pipelineCounts,
    rejectedCandidates,
    recentMemory,
    recentRepairs,
  ] = await Promise.all([
    getAdminWorkerState(prisma),
    runAdminWorkerDiagnostics(prisma),
    listRecentPasses(prisma, { limit: 10 }),
    listRecentSecurityActions(prisma, { limit: 5 }),
    countPendingReview(prisma),
    prisma.contentGoal.findMany({ orderBy: [{ gapCount: "desc" }, { priority: "asc" }] }),
    prisma.homepageWorkerDraft.findFirst({ orderBy: { createdAt: "desc" } }),
    loadCommandCenterMetrics(prisma),
    runReadiness(prisma),
    prisma.adminWorkerDecision.findFirst({
      where: { decisionType: "brain_pass" },
      orderBy: { createdAt: "desc" },
    }),
    planMission(prisma).catch(() => null),
    prisma.adminWorkerGrowthSnapshot
      .findMany({ distinct: ["contentType"], orderBy: { createdAt: "desc" }, take: 15 })
      .catch(() => []),
    prisma.adminWorkerSourceCoverage
      .findMany({ orderBy: [{ blockedByCoverage: "desc" }, { coverageScore: "asc" }] })
      .catch(() => []),
    import("@/lib/admin-worker/pipeline-stages").then(({ pipelineSnapshot }) =>
      pipelineSnapshot(prisma).catch(() => []),
    ),
    prisma.candidateSourceUrl
      .findMany({
        where: { status: "REJECTED" },
        orderBy: { updatedAt: "desc" },
        take: 15,
        select: {
          id: true,
          discoveredUrl: true,
          sourceHost: true,
          rejectionReason: true,
          rejectionPattern: true,
          junkRisk: true,
          duplicateRisk: true,
        },
      })
      .catch(() => []),
    prisma.adminWorkerMemory
      .findMany({
        orderBy: [{ lastUsedAt: "desc" }, { confidence: "desc" }],
        take: 15,
        select: {
          memoryType: true,
          memoryKey: true,
          confidence: true,
          successCount: true,
          failureCount: true,
          lastUsedAt: true,
        },
      })
      .catch(() => []),
    prisma.adminWorkerRepairPlan
      .findMany({
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: {
          id: true,
          kind: true,
          status: true,
          attempts: true,
          maxAttempts: true,
          finalResult: true,
          updatedAt: true,
        },
      })
      .catch(() => []),
  ]);

  const whyNoGrowth = await (await import("@/lib/admin-worker/why-no-growth"))
    .diagnoseWhyNoGrowth(prisma)
    .catch(() => null);
  const funnel = await computeContentFunnel(prisma).catch(() => []);
  const readingsCoverage = await dailyReadingsCoverage(prisma).catch(() => null);

  const recentQualityScores = await prisma.contentQualityScore
    .findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        contentType: true,
        finalScore: true,
        threshold: true,
        passed: true,
        failedDimensions: true,
        createdAt: true,
      },
    })
    .catch(() => []);

  const recentRollbacks = await prisma.adminWorkerRollbackLedger
    .findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        contentType: true,
        slug: true,
        rollbackResult: true,
        rollbackAction: true,
        failedVerificationReason: true,
        restorable: true,
        humanReviewCreated: true,
        createdAt: true,
      },
    })
    .catch(() => []);

  const recentStageOutcomes = await prisma.adminWorkerStageOutcome
    .findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        stage: true,
        result: true,
        resultType: true,
        contentType: true,
        failureReason: true,
        downstreamStage: true,
        durationMs: true,
        repairCreated: true,
        createdAt: true,
      },
    })
    .catch(() => []);

  // Final-brain status. The CURRENT state is the latest pass's provenance — not
  // "any blip in 24h" — so a single transient rejection never makes the console
  // claim the worker is offline when its latest pass actually used the brain.
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [latestBrainDecided, brainDegradedEvents24h, selectActionCalls24h] = await Promise.all([
    prisma.adminWorkerLog
      .findFirst({
        where: { eventName: "brain_decided" },
        orderBy: { createdAt: "desc" },
        select: { safeMetadata: true, createdAt: true },
      })
      .catch(() => null),
    prisma.adminWorkerLog
      .count({
        where: {
          eventName: {
            in: [
              "python_brain_unavailable",
              "python_brain_invalid_decision",
              "python_brain_rejected_action",
            ],
          },
          createdAt: { gte: since24h },
        },
      })
      .catch(() => 0),
    prisma.adminWorkerBrainCall
      .count({ where: { op: "select_action", createdAt: { gte: since24h } } })
      .catch(() => 0),
  ]);
  const latestFinalBrain =
    (latestBrainDecided?.safeMetadata as { finalBrain?: string } | null)?.finalBrain ?? null;

  // Worker liveness: a heartbeat older than 10 minutes means the worker process
  // is not running (so nothing is publishing regardless of the brain).
  const heartbeatAgeMs = state.lastHeartbeatAt
    ? Date.now() - state.lastHeartbeatAt.getTime()
    : null;
  const workerLive = heartbeatAgeMs != null && heartbeatAgeMs <= 10 * 60 * 1000;
  const brainCurrent: "active" | "degraded" | "unknown" =
    latestFinalBrain === "python"
      ? "active"
      : latestFinalBrain === "degraded"
        ? "degraded"
        : "unknown";
  const publishingOn = workerLive && brainCurrent === "active" && !state.paused;

  const summary = summarizeRatings(ratings);

  // Content catalog: live published count for EVERY user-facing category.
  const [catalogGrouped, catalogDerivedRows] = await Promise.all([
    prisma.publishedContent
      .groupBy({ by: ["contentType"], where: { isPublished: true }, _count: { _all: true } })
      .catch(() => [] as Array<{ contentType: string; _count: { _all: number } }>),
    prisma.publishedContent
      .findMany({
        where: { isPublished: true, contentType: { in: CATALOG_DERIVED_TYPES } },
        select: { contentType: true, payload: true },
      })
      .catch(() => [] as Array<{ contentType: string; payload: unknown }>),
  ]);
  const contentCatalog = computeContentCatalog(
    catalogGrouped.map((g) => ({ contentType: g.contentType, count: g._count._all })),
    catalogDerivedRows.map((r) => ({
      contentType: r.contentType,
      payload: (r.payload ?? {}) as Record<string, unknown>,
    })),
  );
  const catalogTotal = contentCatalog.filter((c) => !c.derived).reduce((s, c) => s + c.count, 0);

  return (
    <div className="space-y-4">
      {/* z-30 lifts the header (and its Developer Report dropdown) above the
          following cards, which globals.css puts at position:relative; z-index:1. */}
      <header className="relative z-30 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="vf-eyebrow">Autonomous system</div>
          <h1 className="font-display text-3xl text-ink">Admin Worker · Command Center</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
            <StatusPill tone="ok">{summary.pass} pass</StatusPill>
            <StatusPill tone={summary.warn > 0 ? "warn" : "neutral"}>
              {summary.warn} warn
            </StatusPill>
            <StatusPill tone={summary.fail > 0 ? "bad" : "neutral"}>{summary.fail} fail</StatusPill>
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <DeveloperAuditButton />
          <Link className="text-indigo-600 underline" href="/admin/diagnostics">
            Diagnostics →
          </Link>
          <Link className="text-indigo-600 underline" href="/admin">
            ← dashboard
          </Link>
        </div>
      </header>

      <AdminWorkerPauseToggle initialPaused={state.paused} initialReason={state.pausedReason} />

      {/* ── Worker health ─────────────────────────────────────────────────── */}
      <BrainHealthBanner
        workerLive={workerLive}
        heartbeatAgo={ago(state.lastHeartbeatAt)}
        paused={state.paused}
        brainCurrent={brainCurrent}
        publishingOn={publishingOn}
        degradedEvents24h={brainDegradedEvents24h}
        selectActionCalls24h={selectActionCalls24h}
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Publish rate (30d)" value={fmtPct(metrics.publishRate30d)} tone="ok" />
        <Stat label="QA pass rate (30d)" value={fmtPct(metrics.qaPassRate30d)} tone="ok" />
        <Stat
          label="Deletion rate (30d)"
          value={fmtPct(metrics.deletionRate30d)}
          tone={metrics.deletionRate30d > 0.1 ? "bad" : "neutral"}
        />
        <Stat
          label="Review queue"
          value={String(metrics.reviewQueueCount)}
          tone={metrics.reviewQueueCount > 0 ? "warn" : "neutral"}
        />
        <Stat label="Published live" value={String(metrics.publishedContentLive)} />
        <Stat label="Queue in-flight" value={String(metrics.queueInFlight)} />
        <Stat
          label="Security actions (24h)"
          value={String(metrics.recentSecurityActions24h)}
          tone={metrics.recentSecurityActions24h > 0 ? "bad" : "neutral"}
        />
        <Stat
          label="Monthly report"
          value={metrics.monthlyReportLastAt ? fmtDate(metrics.monthlyReportLastAt) : "—"}
          tone={metrics.monthlyReportFresh ? "ok" : "warn"}
          hint={
            metrics.monthlyReportLastAt
              ? metrics.monthlyReportFresh
                ? "fresh"
                : "stale"
              : undefined
          }
        />
      </section>

      {/* ── Mission & control ─────────────────────────────────────────────── */}
      <SectionHeading
        title="Mission & control"
        description="What the worker is doing right now, and the operator controls."
      />
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Current state" eyebrow="Worker">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
            <Field label="Mode">{state.currentMode}</Field>
            <Field label="Priority">{state.currentPriority}</Field>
            <Field label="Goal">{state.currentGoal ?? "—"}</Field>
            <Field label="Task">{state.currentTask ?? "—"}</Field>
            <Field label="Heartbeat">{ago(state.lastHeartbeatAt)}</Field>
            <Field label="Last success">{ago(state.lastSuccessfulAt)}</Field>
            <Field label="Last failure">{ago(state.lastFailedAt)}</Field>
            <Field label="Blocker">{state.currentBlocker ?? "none"}</Field>
            <Field label="Recovery">{state.recoveryAction ?? "—"}</Field>
            <Field label="Review queue">{pendingReview} pending</Field>
          </dl>
        </Card>

        <Card title="Controls" eyebrow="Operator">
          <p className="text-xs italic text-ink-soft">
            Pausing stops content / homepage / cleanup work — security defense continues.
          </p>
          <div className="mt-3">
            <AdminWorkerControls initialPaused={state.paused} />
          </div>
          <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5 text-xs">
            {[
              ["/admin/admin-worker/logs", "Worker logs"],
              ["/admin/admin-worker/pipeline", "Pipeline map"],
              ["/admin/admin-worker/reasoning", "Reasoning"],
              ["/admin/admin-worker/artifacts", "Artifacts"],
              ["/admin/admin-worker/rules", "Rule catalogue"],
              ["/admin/skills", "Skill runtime"],
              ["/admin/checklist/queue", "Build queue"],
              ["/admin/logs/worker", "Build log"],
            ].map(([href, label]) => (
              <Link key={href} className="text-indigo-600 underline" href={href}>
                {label}
              </Link>
            ))}
          </div>
        </Card>

        <Card title="Mission planner" eyebrow="Next">
          {mission ? (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
              <Field label="Stage">{mission.stage}</Field>
              <Field label="Task type">{mission.taskType}</Field>
              <Field label="Content type">{mission.contentType ?? "—"}</Field>
              <Field label="Confidence">{mission.confidence.toFixed(2)}</Field>
              <dt className="text-ink-faint">Reason</dt>
              <dd className="font-serif text-ink">{mission.reason}</dd>
              <dt className="text-ink-faint">Next step</dt>
              <dd className="font-serif text-ink">{mission.nextStep}</dd>
            </dl>
          ) : (
            <Empty>Mission planner unavailable. Run a worker pass to populate.</Empty>
          )}
        </Card>

        <Card title="What the worker will do next" eyebrow="Plan">
          {recentBrainDecision ? (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
              <Field label="Mission stage">{recentBrainDecision.missionStage ?? "—"}</Field>
              <Field label="Action">{recentBrainDecision.chosenAction}</Field>
              <Field label="Content type">{recentBrainDecision.contentType ?? "—"}</Field>
              <Field label="Source target">
                {chosenActionTargets(recentBrainDecision.rankedAlternatives).sourceTarget ?? "—"}
              </Field>
              <Field label="Candidate">
                <span className="block max-w-[12rem] truncate">
                  {chosenActionTargets(recentBrainDecision.rankedAlternatives).candidateUrl ?? "—"}
                </span>
              </Field>
              <Field label="Largest gap">
                {goals.length > 0 ? `${goals[0].contentType} (${goals[0].gapCount})` : "—"}
              </Field>
              <Field label="Confidence">{recentBrainDecision.confidence.toFixed(2)}</Field>
              <dt className="text-ink-faint">Expected</dt>
              <dd className="font-serif text-ink">{recentBrainDecision.expectedResult ?? "—"}</dd>
            </dl>
          ) : (
            <Empty>Run a pass to populate.</Empty>
          )}
        </Card>
      </section>

      {/* ── Content & coverage ────────────────────────────────────────────── */}
      <SectionHeading
        title="Content & coverage"
        description="Every page the site offers, the daily-readings calendar, and where the growth pipeline is flowing or stuck."
      />
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card
          title="Content goals"
          eyebrow="Catalogue"
          span={2}
          right={<StatusPill tone="neutral">{catalogTotal.toLocaleString()} live</StatusPill>}
        >
          <p className="mb-2 text-xs text-ink-faint">
            Every content page — including view-based categories that are not their own content type
            (Litanies, Our Lady, Liturgical Calendar, History, marked <em>view</em>) — over its
            growth target. Only Sacraments have a hard maximum (7); every other target is a goal,
            not a cap, and never a reason to publish (content still passes every accuracy / QA
            gate).
          </p>
          <DataTable
            head={
              <>
                <th className="py-1.5">Content</th>
                <th className="py-1.5 text-right">Have / Target</th>
                <th className="py-1.5 text-right">Hard max</th>
                <th className="py-1.5 text-right">Gap</th>
                <th className="py-1.5">Status</th>
              </>
            }
          >
            {contentCatalog.map((c) => {
              const hardMax = c.hardMax ?? null;
              const gap = Math.max(0, c.target - c.count);
              const status = deriveStatus(c.count, c.target, hardMax);
              return (
                <tr key={c.key} className="border-t border-ink/5">
                  <td className="py-1">
                    <Link href={c.page} className="text-indigo-600 underline">
                      {c.label}
                    </Link>
                    {c.derived ? (
                      <span className="ml-1 text-[10px] uppercase text-ink-faint">view</span>
                    ) : null}
                  </td>
                  <td className="py-1 text-right font-mono">
                    <span className={c.count === 0 ? "text-rose-600" : "text-ink"}>
                      {c.count.toLocaleString()}
                    </span>{" "}
                    / {c.target.toLocaleString()}
                  </td>
                  <td className="py-1 text-right font-mono">{hardMax ?? "—"}</td>
                  <td className="py-1 text-right font-mono">{gap.toLocaleString()}</td>
                  <td className="py-1 text-xs">{contentGoalStatusLabel(status)}</td>
                </tr>
              );
            })}
          </DataTable>
        </Card>

        <DailyReadingsCard coverage={readingsCoverage} />

        <Card title="Why no content growth — live chain walk" eyebrow="Diagnostic" span={2}>
          {whyNoGrowth ? (
            <>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm md:grid-cols-4">
                <dt className="text-ink-faint">Blocker stage</dt>
                <dd
                  className={`font-mono ${whyNoGrowth.blocker === "NONE" ? "text-emerald-700" : "text-rose-700"}`}
                >
                  {whyNoGrowth.blocker}
                </dd>
                <Field label="Content type">{whyNoGrowth.contentType ?? "(all types)"}</Field>
                <Field label="Exact table">{whyNoGrowth.exactTable || "—"}</Field>
                <dt className="text-ink-faint">Most recent failure</dt>
                <dd className="font-serif text-ink">
                  {whyNoGrowth.mostRecentFailure
                    ? `${whyNoGrowth.mostRecentFailure.when.toISOString().slice(0, 19)} — ${whyNoGrowth.mostRecentFailure.reason}`
                    : "none in window"}
                </dd>
                <dt className="text-ink-faint md:col-span-1">Explanation</dt>
                <dd className="font-serif text-ink md:col-span-3">
                  {whyNoGrowth.blockerExplanation}
                </dd>
                <dt className="text-ink-faint md:col-span-1">Next automatic repair</dt>
                <dd className="font-serif text-ink md:col-span-3">
                  {whyNoGrowth.nextAutomaticRepair ?? "no repair queued"}
                </dd>
                <dt className="text-ink-faint md:col-span-1">Next worker decision</dt>
                <dd className="font-serif text-ink md:col-span-3">
                  {whyNoGrowth.nextWorkerDecision}
                </dd>
              </dl>
              <h4 className="mt-4 vf-eyebrow">Chain walk</h4>
              <DataTable
                head={
                  <>
                    <th className="py-1.5">Stage</th>
                    <th className="py-1.5">OK?</th>
                    <th className="py-1.5 text-right">Count</th>
                    <th className="py-1.5">Detail</th>
                  </>
                }
              >
                {whyNoGrowth.checks.map((c) => (
                  <tr key={c.stage} className={`border-t border-ink/5 ${c.ok ? "" : "bg-rose-50"}`}>
                    <td className="py-1 font-mono">{c.stage}</td>
                    <td className="py-1 font-mono">{c.ok ? "✓" : "✕"}</td>
                    <td className="py-1 text-right font-mono">{c.count}</td>
                    <td className="py-1 font-serif">{c.detail}</td>
                  </tr>
                ))}
              </DataTable>
            </>
          ) : (
            <Empty>Diagnostic unavailable.</Empty>
          )}
        </Card>

        <Card title="Content growth funnel" eyebrow="Per type" span={2}>
          <p className="mb-2 text-xs italic text-ink-faint">
            candidates → prioritized → fetched → reads → blocks → artifacts → checklist → validation
            → strict QA → quality → published → post-publish, plus public/search/sitemap visibility.
            The bottleneck column shows the first stage that dropped to zero.
          </p>
          {funnel.length === 0 ? (
            <Empty>No content goals seeded yet.</Empty>
          ) : (
            <DataTable
              head={
                <>
                  <th className="py-1.5">Type</th>
                  <th className="py-1.5 text-right">Cand.</th>
                  <th className="py-1.5 text-right">Prio.</th>
                  <th className="py-1.5 text-right">Fetch</th>
                  <th className="py-1.5 text-right">Reads</th>
                  <th className="py-1.5 text-right">Artif.</th>
                  <th className="py-1.5 text-right">Check.</th>
                  <th className="py-1.5 text-right">Valid.</th>
                  <th className="py-1.5 text-right">QA</th>
                  <th className="py-1.5 text-right">Pub.</th>
                  <th className="py-1.5">Visible</th>
                  <th className="py-1.5">Bottleneck</th>
                </>
              }
            >
              {funnel.map((f) => (
                <tr
                  key={f.contentType}
                  className={`border-t border-ink/5 ${f.firstEmptyStage ? "bg-amber-50" : ""}`}
                >
                  <td className="py-1 font-mono">{f.contentType}</td>
                  <td className="py-1 text-right font-mono">{f.candidatesDiscovered}</td>
                  <td className="py-1 text-right font-mono">{f.candidatesPrioritized}</td>
                  <td className="py-1 text-right font-mono">{f.sourcesFetched}</td>
                  <td className="py-1 text-right font-mono">{f.sourceReadsCreated}</td>
                  <td className="py-1 text-right font-mono">{f.packageArtifactsCreated}</td>
                  <td className="py-1 text-right font-mono">{f.checklistItemsCreated}</td>
                  <td className="py-1 text-right font-mono">{f.validationPasses}</td>
                  <td className="py-1 text-right font-mono">{f.strictQAPasses}</td>
                  <td className="py-1 text-right font-mono">{f.publishedItems}</td>
                  <td className="py-1 font-mono">
                    {f.publicTabVisible ? "tab" : "—"}/{f.searchVisible ? "srch" : "—"}/
                    {f.sitemapVisible ? "map" : "—"}
                  </td>
                  <td className="py-1 font-serif">{f.firstEmptyStage ?? "flowing"}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>

        <Card title="Growth status by type" eyebrow="Orchestrator" span={2}>
          {growthSnapshots.length === 0 ? (
            <Empty>No growth snapshots yet. The orchestrator writes one each REPORTING pass.</Empty>
          ) : (
            <DataTable
              head={
                <>
                  <th className="py-1.5">Content type</th>
                  <th className="py-1.5">Status</th>
                  <th className="py-1.5 text-right">Gap</th>
                  <th className="py-1.5 text-right">24h</th>
                  <th className="py-1.5 text-right">7d</th>
                  <th className="py-1.5 text-right">Last growth</th>
                  <th className="py-1.5">Recommendation</th>
                </>
              }
            >
              {growthSnapshots.map((g) => (
                <tr
                  key={g.id}
                  className={`border-t border-ink/5 ${
                    g.status === "STUCK_7D" || g.status === "REJECT_HEAVY"
                      ? "bg-rose-50"
                      : g.status === "SLOW_24H" || g.status === "PARTIAL_HEAVY"
                        ? "bg-amber-50"
                        : g.status === "AT_GOAL"
                          ? "bg-emerald-50"
                          : ""
                  }`}
                >
                  <td className="py-1 font-mono">{g.contentType}</td>
                  <td className="py-1 font-mono">{g.status}</td>
                  <td className="py-1 text-right font-mono">{g.gap}</td>
                  <td className="py-1 text-right font-mono">{g.growth24h}</td>
                  <td className="py-1 text-right font-mono">{g.growth7d}</td>
                  <td className="py-1 text-right font-mono">
                    {g.hoursSinceLastGrowth == null ? "—" : `${g.hoursSinceLastGrowth}h`}
                  </td>
                  <td className="py-1 font-serif">{g.recommendation ?? "—"}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>

        <Card title="Source coverage" eyebrow="Scorecard" span={2}>
          {coverageRows.length === 0 ? (
            <Empty>No source coverage scored yet. Runs on every REPORTING pass.</Empty>
          ) : (
            <DataTable
              head={
                <>
                  <th className="py-1.5">Content type</th>
                  <th className="py-1.5 text-right">Primary</th>
                  <th className="py-1.5 text-right">Active</th>
                  <th className="py-1.5 text-right">OK 7d</th>
                  <th className="py-1.5 text-right">Fail 7d</th>
                  <th className="py-1.5 text-right">Cand. 7d</th>
                  <th className="py-1.5 text-right">Publ. 7d</th>
                  <th className="py-1.5 text-right">Score</th>
                  <th className="py-1.5">Block?</th>
                </>
              }
            >
              {coverageRows.map((r) => (
                <tr
                  key={r.id}
                  className={`border-t border-ink/5 ${r.blockedByCoverage ? "bg-rose-50" : ""}`}
                >
                  <td className="py-1 font-mono">{r.contentType}</td>
                  <td className="py-1 text-right font-mono">{r.primarySources}</td>
                  <td className="py-1 text-right font-mono">{r.activeSourceCount}</td>
                  <td className="py-1 text-right font-mono">{r.recentlySuccessfulSources}</td>
                  <td className="py-1 text-right font-mono">{r.recentlyFailedSources}</td>
                  <td className="py-1 text-right font-mono">{r.recentCandidates7d}</td>
                  <td className="py-1 text-right font-mono">{r.recentPublishes7d}</td>
                  <td className="py-1 text-right font-mono">{r.coverageScore.toFixed(2)}</td>
                  <td className="py-1 font-serif">
                    {r.blockedByCoverage ? (r.blockReason ?? "blocked") : "ok"}
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      </section>

      {/* ── Pipeline & diagnostics ────────────────────────────────────────── */}
      <SectionHeading
        title="Pipeline & diagnostics"
        description="Per-stage throughput, exact stage outcomes the brain learns from, and what got rejected."
      />
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Pipeline (Discovery → Cache)" eyebrow="Stages" span={2}>
          <DataTable
            head={
              <>
                <th className="py-1.5">Stage</th>
                <th className="py-1.5 text-right">Pending</th>
                <th className="py-1.5 text-right">Running</th>
                <th className="py-1.5 text-right">Succeeded</th>
                <th className="py-1.5 text-right">Failed</th>
                <th className="py-1.5 text-right">Blocked</th>
              </>
            }
          >
            {pipelineCounts.map((s) => (
              <tr
                key={s.stage}
                className={`border-t border-ink/5 ${
                  s.failed > 0 || s.blocked > 0 ? "bg-rose-50" : s.pending > 0 ? "bg-amber-50" : ""
                }`}
              >
                <td className="py-1 font-mono">{s.stage}</td>
                <td className="py-1 text-right font-mono">{s.pending}</td>
                <td className="py-1 text-right font-mono">{s.running}</td>
                <td className="py-1 text-right font-mono">{s.succeeded}</td>
                <td className="py-1 text-right font-mono">{s.failed}</td>
                <td className="py-1 text-right font-mono">{s.blocked}</td>
              </tr>
            ))}
          </DataTable>
        </Card>

        <Card title="Stage outcomes" eyebrow="Exact feedback" span={2}>
          {recentStageOutcomes.length === 0 ? (
            <Empty>No stage outcomes yet. Every dispatcher stage writes one precise row.</Empty>
          ) : (
            <DataTable
              head={
                <>
                  <th className="py-1.5">Stage</th>
                  <th className="py-1.5">Result</th>
                  <th className="py-1.5">Type</th>
                  <th className="py-1.5 text-right">ms</th>
                  <th className="py-1.5">Repair?</th>
                  <th className="py-1.5">Next / failure</th>
                  <th className="py-1.5">When</th>
                </>
              }
            >
              {recentStageOutcomes.map((s) => (
                <tr
                  key={s.id}
                  className={`border-t border-ink/5 ${
                    s.resultType === "failure"
                      ? "bg-rose-50"
                      : s.resultType === "needs_repair"
                        ? "bg-amber-50"
                        : ""
                  }`}
                >
                  <td className="py-1 font-mono">{s.stage}</td>
                  <td className="py-1 font-mono">{s.result}</td>
                  <td className="py-1 font-mono">{s.resultType}</td>
                  <td className="py-1 text-right font-mono">{Math.round(s.durationMs)}</td>
                  <td className="py-1 font-mono">{s.repairCreated ? "✓" : "—"}</td>
                  <td className="py-1 font-serif">{s.failureReason ?? s.downstreamStage ?? "—"}</td>
                  <td className="py-1 font-mono">{s.createdAt.toISOString().slice(11, 19)}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>

        <Card title="Recent passes" eyebrow="Activity">
          {recentPasses.length === 0 ? (
            <Empty>No passes recorded yet.</Empty>
          ) : (
            <DataTable
              head={
                <>
                  <th className="py-1.5">Pass</th>
                  <th className="py-1.5">Status</th>
                  <th className="py-1.5 text-right">Built</th>
                  <th className="py-1.5 text-right">Pub</th>
                  <th className="py-1.5 text-right">Failed</th>
                </>
              }
            >
              {recentPasses.map((p) => (
                <tr key={p.id} className="border-t border-ink/5">
                  <td className="py-1 font-mono">{p.passType}</td>
                  <td className="py-1">{p.status}</td>
                  <td className="py-1 text-right">{p.contentBuilt}</td>
                  <td className="py-1 text-right">{p.contentPublished}</td>
                  <td className="py-1 text-right">{p.tasksFailed}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>

        <Card title="Rejected candidates" eyebrow="Last 15">
          {rejectedCandidates.length === 0 ? (
            <Empty>No rejected candidates. The scorer flips junk-heavy URLs to REJECTED.</Empty>
          ) : (
            <DataTable
              head={
                <>
                  <th className="py-1.5">Host</th>
                  <th className="py-1.5 text-right">Junk</th>
                  <th className="py-1.5">Reason</th>
                </>
              }
            >
              {rejectedCandidates.map((r) => (
                <tr key={r.id} className="border-t border-ink/5">
                  <td className="py-1 font-mono">{r.sourceHost}</td>
                  <td className="py-1 text-right font-mono">{r.junkRisk.toFixed(2)}</td>
                  <td className="py-1 font-serif">
                    {r.rejectionReason ?? r.rejectionPattern ?? "—"}
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      </section>

      {/* ── Quality & safety ──────────────────────────────────────────────── */}
      <SectionHeading
        title="Quality & safety"
        description="Ten-dimension quality scoring, the rollback ledger, production readiness, and the always-on defender."
      />
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Quality scores — failed dimensions" eyebrow="Quality" span={2}>
          {recentQualityScores.length === 0 ? (
            <Empty>
              No quality scores yet. Each built package records a full ten-dimension score.
            </Empty>
          ) : (
            <DataTable
              head={
                <>
                  <th className="py-1.5">Content type</th>
                  <th className="py-1.5 text-right">Score</th>
                  <th className="py-1.5 text-right">Threshold</th>
                  <th className="py-1.5">Result</th>
                  <th className="py-1.5">Failed dimensions</th>
                  <th className="py-1.5">When</th>
                </>
              }
            >
              {recentQualityScores.map((q) => (
                <tr key={q.id} className={`border-t border-ink/5 ${q.passed ? "" : "bg-rose-50"}`}>
                  <td className="py-1 font-mono">{q.contentType}</td>
                  <td className="py-1 text-right font-mono">{q.finalScore.toFixed(2)}</td>
                  <td className="py-1 text-right font-mono">{q.threshold.toFixed(2)}</td>
                  <td className="py-1 font-mono">
                    {q.passed ? (
                      <span className="text-emerald-700">PASS</span>
                    ) : (
                      <span className="text-rose-700">FAIL</span>
                    )}
                  </td>
                  <td className="py-1 font-serif">
                    {q.failedDimensions.length > 0 ? q.failedDimensions.join(", ") : "—"}
                  </td>
                  <td className="py-1 font-mono">{q.createdAt.toISOString().slice(0, 19)}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>

        <Card title="Rollback ledger" eyebrow="Safety" span={2}>
          {recentRollbacks.length === 0 ? (
            <Empty>No rollbacks recorded. Every post-publish rollback is logged here.</Empty>
          ) : (
            <DataTable
              head={
                <>
                  <th className="py-1.5">Type</th>
                  <th className="py-1.5">Slug</th>
                  <th className="py-1.5">Result</th>
                  <th className="py-1.5">Restorable</th>
                  <th className="py-1.5">Review?</th>
                  <th className="py-1.5">Reason</th>
                  <th className="py-1.5">When</th>
                </>
              }
            >
              {recentRollbacks.map((r) => (
                <tr
                  key={r.id}
                  className={`border-t border-ink/5 ${r.rollbackResult === "DELETED" ? "bg-rose-50" : "bg-amber-50"}`}
                >
                  <td className="py-1 font-mono">{r.contentType ?? "—"}</td>
                  <td className="py-1 font-mono">{(r.slug ?? "—").slice(0, 28)}</td>
                  <td className="py-1 font-mono">{r.rollbackResult}</td>
                  <td className="py-1 font-mono">{r.restorable ? "yes" : "no"}</td>
                  <td className="py-1 font-mono">{r.humanReviewCreated ? "✓" : "—"}</td>
                  <td className="py-1 font-serif">
                    {(r.failedVerificationReason ?? r.rollbackAction).slice(0, 50)}
                  </td>
                  <td className="py-1 font-mono">{r.createdAt.toISOString().slice(0, 19)}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>

        <Card
          title="Production readiness"
          eyebrow="Health"
          span={2}
          right={
            <StatusPill
              tone={
                readiness.failing === 0
                  ? "ok"
                  : readiness.passing >= readiness.checks.length / 2
                    ? "warn"
                    : "bad"
              }
            >
              {Math.round(readiness.score * 100)}% · {readiness.passing}/{readiness.checks.length}
            </StatusPill>
          }
        >
          <ul className="space-y-1 text-xs">
            {readiness.checks.map((c) => (
              <li
                key={c.key}
                className={`rounded-sm border-l-4 px-2 py-1 ${
                  c.status === "pass"
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-rose-500 bg-rose-50"
                }`}
              >
                <span className="font-mono text-[10px] uppercase">
                  {c.status === "pass" ? "✓" : "✕"} {c.label}
                </span>
                <span className="ml-2 font-serif">{c.detail}</span>
                {c.status === "fail" && <p className="mt-0.5 italic text-ink-soft">→ {c.repair}</p>}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Security defense" eyebrow="Defender">
          {recentSecurity.length === 0 ? (
            <Empty>No recent defense actions. The defender stays active even when paused.</Empty>
          ) : (
            <ul className="space-y-1 text-xs">
              {recentSecurity.map((s) => (
                <li key={s.id} className="border-l-2 border-ink/20 pl-2">
                  <span className="font-mono">{s.actionType}</span> · {s.actionTaken}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Latest repair plans" eyebrow="Self-healing">
          {recentRepairs.length === 0 ? (
            <Empty>No repair plans on record.</Empty>
          ) : (
            <DataTable
              head={
                <>
                  <th className="py-1.5">Kind</th>
                  <th className="py-1.5">Status</th>
                  <th className="py-1.5 text-right">Tries</th>
                  <th className="py-1.5">Updated</th>
                </>
              }
            >
              {recentRepairs.map((r) => (
                <tr
                  key={r.id}
                  className={`border-t border-ink/5 ${
                    r.status === "ABANDONED"
                      ? "bg-rose-50"
                      : r.status === "SUCCEEDED"
                        ? "bg-emerald-50"
                        : r.status === "PENDING" || r.status === "RUNNING"
                          ? "bg-amber-50"
                          : ""
                  }`}
                >
                  <td className="py-1 font-mono">{r.kind}</td>
                  <td className="py-1 font-mono">{r.status}</td>
                  <td className="py-1 text-right font-mono">
                    {r.attempts}/{r.maxAttempts}
                  </td>
                  <td className="py-1 font-mono">{r.updatedAt.toISOString().slice(0, 19)}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      </section>

      {/* ── Brain & learning ──────────────────────────────────────────────── */}
      <SectionHeading
        title="Brain & learning"
        description="The Python brain's most recent decision, what it rejected and why, and what the worker has learned."
      />
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Last brain decision" eyebrow="Why" span={2}>
          {recentBrainDecision ? (
            <>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm md:grid-cols-4">
                <Field label="When">
                  {recentBrainDecision.createdAt.toISOString().slice(0, 19)}
                </Field>
                <Field label="Mission stage">{recentBrainDecision.missionStage ?? "—"}</Field>
                <Field label="Chosen action">{recentBrainDecision.chosenAction}</Field>
                <Field label="Confidence">{recentBrainDecision.confidence.toFixed(2)}</Field>
                <Field label="Risk">{recentBrainDecision.riskScore.toFixed(2)}</Field>
                <Field label="Content type">{recentBrainDecision.contentType ?? "—"}</Field>
                <Field label="Fallback">{recentBrainDecision.fallbackAction ?? "—"}</Field>
                <dt className="text-ink-faint">Expected</dt>
                <dd className="font-serif text-ink">{recentBrainDecision.expectedResult ?? "—"}</dd>
                <dt className="text-ink-faint md:col-span-1">Reason</dt>
                <dd className="font-serif text-ink md:col-span-3">
                  {recentBrainDecision.reason ?? "—"}
                </dd>
              </dl>
              {recentBrainDecision.brainExplanation && (
                <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-sm bg-ink/5 p-3 text-xs font-mono text-ink-soft">
                  {recentBrainDecision.brainExplanation}
                </pre>
              )}
              {recentBrainDecision.brainFailure && (
                <p className="mt-3 rounded-sm border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-serif text-rose-900">
                  <span className="font-semibold">Brain failure:</span>{" "}
                  {recentBrainDecision.brainFailure}
                </p>
              )}
              <BrainInfluences raw={recentBrainDecision.rulesEvaluated} />
              <RankedAlternatives raw={recentBrainDecision.rankedAlternatives} />
            </>
          ) : (
            <Empty>No brain decisions recorded yet. The first pass will populate this card.</Empty>
          )}
        </Card>

        <Card title="What the worker learned recently" eyebrow="Memory" span={2}>
          {recentMemory.length === 0 ? (
            <Empty>No memory rows yet. The worker writes one per outcome.</Empty>
          ) : (
            <DataTable
              head={
                <>
                  <th className="py-1.5">Type</th>
                  <th className="py-1.5">Key</th>
                  <th className="py-1.5 text-right">Confidence</th>
                  <th className="py-1.5 text-right">✓ / ✕</th>
                  <th className="py-1.5">Last used</th>
                </>
              }
            >
              {recentMemory.map((m) => (
                <tr key={`${m.memoryType}|${m.memoryKey}`} className="border-t border-ink/5">
                  <td className="py-1 font-mono">{m.memoryType}</td>
                  <td className="py-1 font-mono">{m.memoryKey.slice(0, 40)}</td>
                  <td className="py-1 text-right font-mono">{m.confidence.toFixed(2)}</td>
                  <td className="py-1 text-right font-mono">
                    {m.successCount} / {m.failureCount}
                  </td>
                  <td className="py-1 font-mono">{m.lastUsedAt ? ago(m.lastUsedAt) : "—"}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      </section>

      {/* ── Site surfaces ─────────────────────────────────────────────────── */}
      <SectionHeading title="Site surfaces" description="Homepage design state and quick links." />
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Homepage" eyebrow="Designer">
          {recentDraft ? (
            <p className="text-sm text-ink">
              Latest draft: <span className="font-mono">{recentDraft.status}</span> · mode{" "}
              <span className="font-mono">{recentDraft.mode}</span> · confidence{" "}
              <span className="font-mono">{recentDraft.confidence.toFixed(2)}</span>
            </p>
          ) : (
            <Empty>
              No homepage drafts. The designer files drafts only when the score is below 0.65.
            </Empty>
          )}
          <div className="mt-3">
            <RequestHomepageMakeoverButton
              initialDraft={
                recentDraft &&
                (recentDraft.status === "PROPOSED" || recentDraft.status === "AWAITING_REVIEW")
                  ? {
                      id: recentDraft.id,
                      status: recentDraft.status,
                      reasonSummary: recentDraft.reasonSummary ?? "",
                      sectionsChanged: recentDraft.sectionsChanged,
                      confidence: recentDraft.confidence,
                    }
                  : null
              }
            />
          </div>
        </Card>
      </section>
    </div>
  );
}

/* ── Worker-health banner ───────────────────────────────────────────────────
 * The CURRENT state comes from the latest pass + heartbeat, not from "any
 * degraded event in 24h" — a single transient blip is reported as an informational
 * footnote, never as "the worker is offline / not publishing".
 */
function BrainHealthBanner(props: {
  workerLive: boolean;
  heartbeatAgo: string;
  paused: boolean;
  brainCurrent: "active" | "degraded" | "unknown";
  publishingOn: boolean;
  degradedEvents24h: number;
  selectActionCalls24h: number;
}) {
  const {
    workerLive,
    paused,
    brainCurrent,
    publishingOn,
    degradedEvents24h,
    selectActionCalls24h,
  } = props;

  let tone: Tone;
  let headline: string;
  let detail: string;
  if (!workerLive) {
    tone = "warn";
    headline = "Worker offline — no recent heartbeat";
    detail = `Last heartbeat ${props.heartbeatAgo}. Start the worker process (\`npm run worker\`) so it resumes autonomous passes. Nothing publishes while the loop is not running.`;
  } else if (paused) {
    tone = "warn";
    headline = "Worker paused by operator";
    detail =
      "Content / homepage / cleanup work is paused. Security defense still runs. Resume to continue autonomous publishing.";
  } else if (brainCurrent === "active") {
    tone = "ok";
    headline = "Python brain active — autonomous publishing enabled";
    detail =
      "The Python brain is the final decision-maker; TypeScript validates + executes. The worker is publishing and managing content across every type and subtype." +
      (degradedEvents24h > 0
        ? ` (${degradedEvents24h} transient brain blip(s) auto-recovered in the last 24h.)`
        : "");
  } else if (brainCurrent === "degraded") {
    tone = "bad";
    headline = "Safe degraded mode — Python brain unavailable";
    detail =
      "The latest pass could not use the Python brain (disabled, unreachable, timed out, or returned an invalid/unsafe action), so the worker is running security, diagnostics, reporting, and repair only — no new autonomous publishing. It does NOT fall back to a legacy brain. Confirm python3 is on PATH and INTELLIGENCE_BRAIN_ENABLED is not '0'.";
  } else {
    tone = "neutral";
    headline = "Brain state unknown";
    detail = "No brain decision recorded yet. Run a worker pass to populate.";
  }

  return (
    <section
      className={`rounded-sm border p-4 ${
        tone === "ok"
          ? "border-emerald-300 bg-emerald-50"
          : tone === "warn"
            ? "border-amber-300 bg-amber-50"
            : tone === "bad"
              ? "border-rose-300 bg-rose-50"
              : "border-ink/15 bg-paper-bright"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧠</span>
          <span className="font-display text-base text-ink">{headline}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={workerLive ? "ok" : "warn"}>
            {workerLive ? "worker live" : "worker offline"} · {props.heartbeatAgo}
          </StatusPill>
          <StatusPill tone={publishingOn ? "ok" : "neutral"}>
            publishing {publishingOn ? "on" : "off"}
          </StatusPill>
          <StatusPill tone="neutral">{selectActionCalls24h} brain calls/24h</StatusPill>
        </div>
      </div>
      <p className="mt-2 font-serif text-sm text-ink-soft">{detail}</p>
    </section>
  );
}

/* ── Daily readings coverage ─────────────────────────────────────────────── */
function DailyReadingsCard({
  coverage,
}: {
  coverage: Awaited<ReturnType<typeof dailyReadingsCoverage>> | null;
}) {
  if (!coverage || coverage.total === 0) {
    return (
      <Card title="Daily readings" eyebrow="Liturgical calendar">
        <Empty>
          No daily readings framed yet. The worker backfills a rolling window of the calendar each
          pass (no target — the goal is full coverage).
        </Empty>
      </Card>
    );
  }
  const textPct = coverage.total > 0 ? Math.round((coverage.published / coverage.total) * 100) : 0;
  return (
    <Card
      title="Daily readings"
      eyebrow="Liturgical calendar"
      right={
        <StatusPill tone={coverage.todayHasText ? "ok" : coverage.todayHasRow ? "warn" : "bad"}>
          today {coverage.todayHasText ? "verified" : coverage.todayHasRow ? "framed" : "missing"}
        </StatusPill>
      }
    >
      <p className="mb-3 text-xs text-ink-faint">
        The worker frames every day of the liturgical calendar and fills verified readings text
        where a trusted source supplies it; the rest link to the official source until verified. No
        target — the goal is to cover the whole calendar.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="Days framed"
          value={coverage.total.toLocaleString()}
          hint={`${coverage.spanDays} day span`}
        />
        <Stat
          label="Verified text"
          value={`${coverage.published.toLocaleString()} · ${textPct}%`}
          tone="ok"
        />
        <Stat
          label="On official link"
          value={coverage.review.toLocaleString()}
          tone={coverage.review > 0 ? "warn" : "neutral"}
        />
        <Stat
          label="Next 30 / 90d"
          value={`${coverage.next30WithText} / ${coverage.next90WithText}`}
          hint="verified text"
        />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <Field label="Covered range">
          {fmtDate(coverage.earliest)} → {fmtDate(coverage.latest)}
        </Field>
        <Field label="Last updated">{ago(coverage.lastUpdatedAt)}</Field>
      </dl>
      <div className="mt-3 text-xs">
        <Link className="text-indigo-600 underline" href="/liturgy/readings">
          View today&apos;s readings →
        </Link>
      </div>
    </Card>
  );
}

/* ── small formatters ───────────────────────────────────────────────────── */
function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
function fmtDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "—";
}
function ago(d: Date | null): string {
  if (!d) return "never";
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

interface RankedAlternativeRow {
  missionStage?: string;
  actionType?: string;
  finalScore?: number;
  urgencyScore?: number;
  riskScore?: number;
  qualityExpectation?: number;
  safe?: boolean;
  rejectionReason?: string | null;
  reasonSummary?: string;
}

function chosenActionTargets(raw: unknown): {
  sourceTarget: string | null;
  candidateUrl: string | null;
} {
  if (!Array.isArray(raw) || raw.length === 0) return { sourceTarget: null, candidateUrl: null };
  const chosen = raw[0] as { sourceTarget?: string | null; candidateUrl?: string | null };
  return { sourceTarget: chosen?.sourceTarget ?? null, candidateUrl: chosen?.candidateUrl ?? null };
}

function BrainInfluences({ raw }: { raw: unknown }) {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as {
    memoryUsed?: Record<string, unknown>;
    sourceReputationUsed?: Array<{ host?: string; tier?: string }>;
  };
  const memoryEntries = r.memoryUsed ? Object.entries(r.memoryUsed) : [];
  const reputation = Array.isArray(r.sourceReputationUsed) ? r.sourceReputationUsed : [];
  if (memoryEntries.length === 0 && reputation.length === 0) return null;
  return (
    <div className="mt-3 grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
      <div>
        <h4 className="vf-eyebrow">Memory used</h4>
        {memoryEntries.length === 0 ? (
          <p className="font-serif text-ink-soft">No memory influenced this decision.</p>
        ) : (
          <ul className="mt-1 font-mono">
            {memoryEntries.map(([k, v]) => (
              <li key={k}>
                {k}: {String(v)}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h4 className="vf-eyebrow">Source reputation used</h4>
        {reputation.length === 0 ? (
          <p className="font-serif text-ink-soft">No source reputation influenced this decision.</p>
        ) : (
          <ul className="mt-1 font-mono">
            {reputation.slice(0, 8).map((s, i) => (
              <li key={i}>
                {s.host ?? "—"} → {s.tier ?? "—"}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function RankedAlternatives({ raw }: { raw: unknown }) {
  if (!raw || !Array.isArray(raw)) return null;
  const rows = raw as RankedAlternativeRow[];
  if (rows.length === 0) return null;
  return (
    <div className="mt-4">
      <h4 className="vf-eyebrow">Ranked alternatives — top 6</h4>
      <DataTable
        head={
          <>
            <th className="py-1.5">#</th>
            <th className="py-1.5">Stage</th>
            <th className="py-1.5">Action</th>
            <th className="py-1.5 text-right">Score</th>
            <th className="py-1.5 text-right">Risk</th>
            <th className="py-1.5">Why</th>
          </>
        }
      >
        {rows.slice(0, 6).map((r, i) => (
          <tr
            key={`${r.missionStage}-${i}`}
            className={`border-t border-ink/5 ${i === 0 ? "bg-emerald-50" : r.safe === false ? "text-rose-700" : ""}`}
          >
            <td className="py-1 font-mono">{i === 0 ? "★" : i + 1}</td>
            <td className="py-1 font-mono">{r.missionStage ?? "—"}</td>
            <td className="py-1 font-mono">{r.actionType ?? "—"}</td>
            <td className="py-1 text-right font-mono">
              {typeof r.finalScore === "number" ? r.finalScore.toFixed(1) : "—"}
            </td>
            <td className="py-1 text-right font-mono">
              {typeof r.riskScore === "number" ? r.riskScore.toFixed(2) : "—"}
            </td>
            <td className="py-1 font-serif">
              {i === 0
                ? (r.reasonSummary ?? "chosen")
                : (r.rejectionReason ?? r.reasonSummary ?? "lower score")}
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}
