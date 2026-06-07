import { redirect } from "next/navigation";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";
import {
  computeContentFunnel,
  contentGoalStatusLabel,
  countPendingReview,
  getAdminWorkerState,
  listRecentPasses,
  listRecentSecurityActions,
  refreshContentGoals,
  runAdminWorkerDiagnostics,
  runReadiness,
  summarizeRatings,
} from "@/lib/admin-worker";
import { loadCommandCenterMetrics } from "@/lib/admin-worker/metrics";
import { planMission } from "@/lib/admin-worker/mission-planner";
import { CATALOG_DERIVED_TYPES, computeContentCatalog } from "@/lib/content-shared/content-catalog";
import { AdminWorkerPauseToggle } from "./AdminWorkerPauseToggle";
import { AdminWorkerControls } from "./AdminWorkerControls";
import { RequestHomepageMakeoverButton } from "./RequestHomepageMakeoverButton";
import { DeveloperAuditButton } from "../diagnostics/DeveloperAuditButton";

export const dynamic = "force-dynamic";

/**
 * Admin Worker Command Center.
 *
 * Single-page overview of the autonomous content / diagnostics / design
 * / security / maintenance system. Shows current state, content goals,
 * blockers, source reputation summary, publish/QA/deletion rates,
 * review queue count, security state, homepage state, and monthly
 * report status. Controls let the operator pause, resume, or run any
 * named pass.
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
    // spec §22: latest growth snapshot per content type
    prisma.adminWorkerGrowthSnapshot
      .findMany({
        distinct: ["contentType"],
        orderBy: { createdAt: "desc" },
        take: 15,
      })
      .catch(() => []),
    // spec §23: source coverage scorecard
    prisma.adminWorkerSourceCoverage
      .findMany({ orderBy: [{ blockedByCoverage: "desc" }, { coverageScore: "asc" }] })
      .catch(() => []),
    // spec §3: pipeline-stage snapshot for the diagnostics card
    import("@/lib/admin-worker/pipeline-stages").then(({ pipelineSnapshot }) =>
      pipelineSnapshot(prisma).catch(() => []),
    ),
    // spec §5: rejected candidates surfacing the rejection pattern
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
    // spec §18: what the worker learned recently
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
    // spec §18: latest repair plans (what's broken + being fixed)
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

  // Spec §15: live "Why no content growth" walk of the chain.
  const whyNoGrowth = await (await import("@/lib/admin-worker/why-no-growth"))
    .diagnoseWhyNoGrowth(prisma)
    .catch(() => null);

  // Spec §17: per-content-type growth execution funnel.
  const funnel = await computeContentFunnel(prisma).catch(() => []);

  // Full quality model: most recent scores with the failed dimension(s)
  // so the operator can see exactly which dimension dragged a score down.
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

  // Durable rollback ledger (spec: rollback guarantees) for diagnostics.
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

  // Exact stage-outcome ledger: the most recent precise per-stage results
  // the brain learns from (spec: make brain feedback exact).
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

  // Final-brain status: the Python brain is the final decision brain. Show
  // its latest provenance + warn loudly if it has been unavailable / had
  // actions rejected recently (safe degraded mode).
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

  const summary = summarizeRatings(ratings);

  // Content catalog: live published count for EVERY user-facing category,
  // including the view-based ones that are not their own content type
  // (Litanies, Our Lady, Chaplets, Liturgical Calendar, History). This proves
  // every page the site offers is represented and growing in the console.
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
  const catalogTotal = contentCatalog
    .filter((c) => !c.derived)
    .reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">Admin Worker · Command Center</h1>
          <p className="mt-1 font-serif text-ink-soft">
            Autonomous content, diagnostics, design, security, and maintenance system.{" "}
            <span className="font-medium text-green-700">{summary.pass} pass</span> ·{" "}
            <span className="font-medium text-amber-700">{summary.warn} warn</span> ·{" "}
            <span className="font-medium text-rose-700">{summary.fail} fail</span>
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {/* Developer Report: generate + download the audit PDF straight
              from the worker control console (spec §12). */}
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

      {/* Final-brain banner: the Python brain is the final decision brain;
          TypeScript validates + executes. Warn loudly in safe degraded mode. */}
      <section
        className={`rounded border p-3 text-sm shadow-sm ${
          brainDegradedEvents24h > 0
            ? "border-rose-300 bg-rose-50"
            : latestFinalBrain === "python"
              ? "border-emerald-300 bg-emerald-50"
              : "border-slate-300 bg-white"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium text-ink">
            🧠 Final decision brain:{" "}
            <span className="font-mono">
              {latestFinalBrain === "python"
                ? "Python (final brain)"
                : latestFinalBrain === "degraded"
                  ? "safe degraded mode"
                  : "—"}
            </span>
          </span>
          <span className="font-mono text-xs text-ink-soft">
            {selectActionCalls24h} select_action call(s)/24h · TypeScript validates + executes
          </span>
        </div>
        {brainDegradedEvents24h > 0 && (
          <p className="mt-1 font-serif text-rose-800">
            ⚠ PYTHON_BRAIN_UNAVAILABLE — the Python brain was unavailable / had{" "}
            {brainDegradedEvents24h} action(s) rejected in the last 24h. The worker is in safe
            degraded mode (security, diagnostics, reporting, repair only — no autonomous content
            publishing). It does NOT fall back to a legacy brain.
          </p>
        )}
      </section>

      <section className="grid grid-cols-2 gap-4 rounded border bg-white p-4 shadow-sm md:grid-cols-4">
        <Metric label="Publish rate (30d)" value={fmtPct(metrics.publishRate30d)} tone="emerald" />
        <Metric label="QA pass rate (30d)" value={fmtPct(metrics.qaPassRate30d)} tone="emerald" />
        <Metric
          label="Deletion rate (30d)"
          value={fmtPct(metrics.deletionRate30d)}
          tone={metrics.deletionRate30d > 0.1 ? "rose" : "slate"}
        />
        <Metric
          label="Review queue"
          value={String(metrics.reviewQueueCount)}
          tone={metrics.reviewQueueCount > 0 ? "amber" : "slate"}
        />
        <Metric label="Published live" value={String(metrics.publishedContentLive)} tone="slate" />
        <Metric label="Queue in-flight" value={String(metrics.queueInFlight)} tone="slate" />
        <Metric
          label="Security actions (24h)"
          value={String(metrics.recentSecurityActions24h)}
          tone={metrics.recentSecurityActions24h > 0 ? "rose" : "slate"}
        />
        <Metric
          label="Monthly report"
          value={
            metrics.monthlyReportLastAt
              ? `${metrics.monthlyReportLastAt.toISOString().slice(0, 10)}${metrics.monthlyReportFresh ? " (fresh)" : " (stale)"}`
              : "—"
          }
          tone={metrics.monthlyReportFresh ? "emerald" : "amber"}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <article className="rounded border bg-white p-4 shadow-sm">
          <h2 className="font-display text-xl text-ink">Current mission</h2>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <dt className="text-ink-soft">Mode</dt>
            <dd className="font-mono">{state.currentMode}</dd>
            <dt className="text-ink-soft">Priority</dt>
            <dd className="font-mono">{state.currentPriority}</dd>
            <dt className="text-ink-soft">Goal</dt>
            <dd className="font-mono">{state.currentGoal ?? "—"}</dd>
            <dt className="text-ink-soft">Task</dt>
            <dd className="font-mono">{state.currentTask ?? "—"}</dd>
            <dt className="text-ink-soft">Heartbeat</dt>
            <dd className="font-mono">
              {state.lastHeartbeatAt ? state.lastHeartbeatAt.toISOString() : "—"}
            </dd>
            <dt className="text-ink-soft">Last success</dt>
            <dd className="font-mono">
              {state.lastSuccessfulAt ? state.lastSuccessfulAt.toISOString() : "—"}
            </dd>
            <dt className="text-ink-soft">Last failure</dt>
            <dd className="font-mono">
              {state.lastFailedAt ? state.lastFailedAt.toISOString() : "—"}
            </dd>
            <dt className="text-ink-soft">Blocker</dt>
            <dd className="font-mono">{state.currentBlocker ?? "none"}</dd>
            <dt className="text-ink-soft">Recovery</dt>
            <dd className="font-mono">{state.recoveryAction ?? "—"}</dd>
            <dt className="text-ink-soft">Review queue</dt>
            <dd className="font-mono">{pendingReview} pending</dd>
          </dl>
        </article>

        <article className="rounded border bg-white p-4 shadow-sm">
          <h2 className="font-display text-xl text-ink">Controls</h2>
          <p className="mt-1 text-xs italic text-ink-soft">
            Pausing stops content / homepage / cleanup work — security defense continues.
          </p>
          <div className="mt-3">
            <AdminWorkerControls initialPaused={state.paused} />
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            <Link className="text-indigo-600 underline" href="/admin/admin-worker/logs">
              Admin Worker logs
            </Link>
            <Link className="text-indigo-600 underline" href="/admin/admin-worker/pipeline">
              Pipeline map
            </Link>
            <Link className="text-indigo-600 underline" href="/admin/admin-worker/reasoning">
              Worker Reasoning
            </Link>
            <Link className="text-indigo-600 underline" href="/admin/admin-worker/artifacts">
              Package artifacts
            </Link>
            <Link className="text-indigo-600 underline" href="/admin/admin-worker/rules">
              Rule catalogue
            </Link>
            <Link className="text-indigo-600 underline" href="/admin/diagnostics">
              Diagnostics card
            </Link>
            <Link className="text-indigo-600 underline" href="/admin/checklist/queue">
              Build queue
            </Link>
            <Link className="text-indigo-600 underline" href="/admin/logs/worker">
              Build log
            </Link>
          </div>
        </article>

        <article className="rounded border bg-white p-4 shadow-sm">
          <h2 className="font-display text-xl text-ink">Content goals</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Only Sacraments have a hard maximum (7). Every other type has a growth{" "}
            <span className="font-medium">target</span>, not a cap — verified content keeps growing
            past it at a maintenance pace. A target is never a reason to publish; content must still
            pass every accuracy / source / verification / QA / quality gate.
          </p>
          {goals.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">
              No content goals seeded yet. Use the diagnostics page or run a setup pass to seed.
            </p>
          ) : (
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-soft">
                  <th>Content type</th>
                  <th className="text-right">Have</th>
                  <th className="text-right">Target</th>
                  <th className="text-right">Hard max</th>
                  <th className="text-right">Gap</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {goals.map((g) => (
                  <tr key={g.id} className="border-t">
                    <td className="py-1 font-mono">{g.contentType}</td>
                    <td className="py-1 text-right font-mono">{g.currentValidCount}</td>
                    <td className="py-1 text-right font-mono">
                      {g.desiredTarget.toLocaleString()}
                    </td>
                    <td className="py-1 text-right font-mono">{g.canonicalMax ?? "—"}</td>
                    <td className="py-1 text-right font-mono">{g.gapCount.toLocaleString()}</td>
                    <td className="py-1 text-xs">{contentGoalStatusLabel(g.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>

        <article className="rounded border bg-white p-4 shadow-sm">
          <h2 className="font-display text-xl text-ink">Content catalog</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Every content page the site offers, with its live published count — including the
            view-based categories that are not their own content type (Litanies, Our Lady, Chaplets,
            Liturgical Calendar, History). {catalogTotal.toLocaleString()} item(s) across the
            primary content types.
          </p>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-ink-soft">
                <th>Category</th>
                <th className="text-right">Published</th>
                <th>Page</th>
              </tr>
            </thead>
            <tbody>
              {contentCatalog.map((c) => (
                <tr key={c.key} className="border-t">
                  <td className="py-1">
                    <span className={c.count === 0 ? "text-rose-600" : "text-ink"}>{c.label}</span>
                    {c.derived ? (
                      <span className="ml-1 text-[10px] uppercase tracking-wide text-ink-faint">
                        view
                      </span>
                    ) : null}
                    {c.note ? <div className="text-[11px] text-ink-faint">{c.note}</div> : null}
                  </td>
                  <td className="py-1 text-right font-mono">{c.count.toLocaleString()}</td>
                  <td className="py-1">
                    <Link href={c.page} className="text-indigo-600 underline">
                      {c.page}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="rounded border bg-white p-4 shadow-sm">
          <h2 className="font-display text-xl text-ink">Recent passes</h2>
          {recentPasses.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">No passes recorded yet.</p>
          ) : (
            <table className="mt-2 w-full text-xs">
              <thead>
                <tr className="text-left uppercase text-ink-soft">
                  <th>Pass</th>
                  <th>Status</th>
                  <th className="text-right">Built</th>
                  <th className="text-right">Pub</th>
                  <th className="text-right">Failed</th>
                </tr>
              </thead>
              <tbody>
                {recentPasses.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="py-1 font-mono">{p.passType}</td>
                    <td className="py-1">{p.status}</td>
                    <td className="py-1 text-right">{p.contentBuilt}</td>
                    <td className="py-1 text-right">{p.contentPublished}</td>
                    <td className="py-1 text-right">{p.tasksFailed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>

        <article className="rounded border bg-white p-4 shadow-sm">
          <h2 className="font-display text-xl text-ink">Security defense</h2>
          {recentSecurity.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">
              No recent defense actions. The defender stays active even when paused.
            </p>
          ) : (
            <ul className="mt-2 space-y-1 text-xs">
              {recentSecurity.map((s) => (
                <li key={s.id} className="border-l-2 border-slate-300 pl-2">
                  <span className="font-mono">{s.actionType}</span> · {s.actionTaken}
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="rounded border bg-white p-4 shadow-sm">
          <h2 className="font-display text-xl text-ink">Homepage</h2>
          {recentDraft ? (
            <p className="mt-2 text-sm">
              Latest draft: <span className="font-mono">{recentDraft.status}</span> · mode{" "}
              <span className="font-mono">{recentDraft.mode}</span> · confidence{" "}
              <span className="font-mono">{recentDraft.confidence.toFixed(2)}</span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">
              No homepage drafts. The designer files drafts only when the score is below 0.65.
            </p>
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
        </article>

        {/* Brain "why" view (spec §1 + §2). Shows the most recent
            AdminWorkerDecision plus the ranked alternatives the brain
            considered, so the operator can audit:
              - what the worker chose
              - why it chose that
              - what it rejected and why (next-best alternatives)
              - whether the brain failed to find a safe action  */}
        <article className="rounded border bg-white p-4 shadow-sm md:col-span-2">
          <h2 className="font-display text-xl text-ink">Last brain decision</h2>
          {recentBrainDecision ? (
            <>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm md:grid-cols-4">
                <dt className="text-ink-soft">When</dt>
                <dd className="font-mono">
                  {recentBrainDecision.createdAt.toISOString().slice(0, 19)}
                </dd>
                <dt className="text-ink-soft">Mission stage</dt>
                <dd className="font-mono">{recentBrainDecision.missionStage ?? "—"}</dd>
                <dt className="text-ink-soft">Chosen action</dt>
                <dd className="font-mono">{recentBrainDecision.chosenAction}</dd>
                <dt className="text-ink-soft">Confidence</dt>
                <dd className="font-mono">{recentBrainDecision.confidence.toFixed(2)}</dd>
                <dt className="text-ink-soft">Risk</dt>
                <dd className="font-mono">{recentBrainDecision.riskScore.toFixed(2)}</dd>
                <dt className="text-ink-soft">Content type</dt>
                <dd className="font-mono">{recentBrainDecision.contentType ?? "—"}</dd>
                <dt className="text-ink-soft">Fallback</dt>
                <dd className="font-mono">{recentBrainDecision.fallbackAction ?? "—"}</dd>
                <dt className="text-ink-soft">Expected result</dt>
                <dd className="font-serif">{recentBrainDecision.expectedResult ?? "—"}</dd>
                <dt className="text-ink-soft md:col-span-1">Reason</dt>
                <dd className="font-serif md:col-span-3">{recentBrainDecision.reason ?? "—"}</dd>
              </dl>
              {recentBrainDecision.brainExplanation && (
                <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs font-mono text-ink-soft">
                  {recentBrainDecision.brainExplanation}
                </pre>
              )}
              {recentBrainDecision.brainFailure && (
                <p className="mt-3 rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-serif text-rose-900">
                  <span className="font-semibold">Brain failure:</span>{" "}
                  {recentBrainDecision.brainFailure}
                </p>
              )}
              <BrainInfluences raw={recentBrainDecision.rulesEvaluated} />
              <RankedAlternatives raw={recentBrainDecision.rankedAlternatives} />
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">
              No brain decisions recorded yet. The first pass will populate this card.
            </p>
          )}
        </article>

        {/* Mission planner (spec §3). Shows the next stage the worker
            will work on + the concrete next step. Helps the operator
            see the worker's current mission at a glance. */}
        <article className="rounded border bg-white p-4 shadow-sm md:col-span-2">
          <h2 className="font-display text-xl text-ink">Current mission</h2>
          {mission ? (
            <dl className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1 text-sm md:grid-cols-2">
              <dt className="text-ink-soft">Stage</dt>
              <dd className="font-mono">{mission.stage}</dd>
              <dt className="text-ink-soft">Task type</dt>
              <dd className="font-mono">{mission.taskType}</dd>
              <dt className="text-ink-soft">Content type</dt>
              <dd className="font-mono">{mission.contentType ?? "—"}</dd>
              <dt className="text-ink-soft">Confidence</dt>
              <dd className="font-mono">{mission.confidence.toFixed(2)}</dd>
              <dt className="text-ink-soft md:col-span-1">Reason</dt>
              <dd className="font-serif md:col-span-1">{mission.reason}</dd>
              <dt className="text-ink-soft md:col-span-1">Next step</dt>
              <dd className="font-serif md:col-span-1">{mission.nextStep}</dd>
            </dl>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">
              Mission planner unavailable. Run a worker pass to populate.
            </p>
          )}
        </article>

        {/* What the worker will do next (spec §18). Drawn from the
            most recent brain decision — surfaces mission stage,
            content type, target source, expected output. */}
        <article className="rounded border bg-white p-4 shadow-sm">
          <h2 className="font-display text-xl text-ink">What the worker will do next</h2>
          {recentBrainDecision ? (
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <dt className="text-ink-soft">Mission stage</dt>
              <dd className="font-mono">{recentBrainDecision.missionStage ?? "—"}</dd>
              <dt className="text-ink-soft">Action</dt>
              <dd className="font-mono">{recentBrainDecision.chosenAction}</dd>
              <dt className="text-ink-soft">Content type</dt>
              <dd className="font-mono">{recentBrainDecision.contentType ?? "—"}</dd>
              {/* Spec §13: source target + candidate target from the chosen action. */}
              <dt className="text-ink-soft">Source target</dt>
              <dd className="font-mono">
                {chosenActionTargets(recentBrainDecision.rankedAlternatives).sourceTarget ?? "—"}
              </dd>
              <dt className="text-ink-soft">Candidate target</dt>
              <dd className="truncate font-mono">
                {chosenActionTargets(recentBrainDecision.rankedAlternatives).candidateUrl ?? "—"}
              </dd>
              {/* Spec §13: current content goal gap (largest gap first). */}
              <dt className="text-ink-soft">Content goal gap</dt>
              <dd className="font-mono">
                {goals.length > 0 ? `${goals[0].contentType} (${goals[0].gapCount} short)` : "—"}
              </dd>
              <dt className="text-ink-soft">Confidence</dt>
              <dd className="font-mono">{recentBrainDecision.confidence.toFixed(2)}</dd>
              <dt className="text-ink-soft">Expected</dt>
              <dd className="font-serif">{recentBrainDecision.expectedResult ?? "—"}</dd>
              <dt className="text-ink-soft">Fallback</dt>
              <dd className="font-mono">{recentBrainDecision.fallbackAction ?? "—"}</dd>
            </dl>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">Run a pass to populate.</p>
          )}
        </article>

        {/* What the worker learned recently (spec §18). Top 15 most-
            recently-used memory rows. */}
        <article className="rounded border bg-white p-4 shadow-sm">
          <h2 className="font-display text-xl text-ink">What the worker learned recently</h2>
          {recentMemory.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">
              No memory rows yet. The worker writes one per outcome (source success/failure,
              extractor outcome, URL pattern, repair outcome).
            </p>
          ) : (
            <table className="mt-2 w-full text-xs">
              <thead>
                <tr className="text-left uppercase text-ink-soft">
                  <th>Type</th>
                  <th>Key</th>
                  <th className="text-right">Confidence</th>
                  <th className="text-right">✓ / ✕</th>
                  <th>Last used</th>
                </tr>
              </thead>
              <tbody>
                {recentMemory.map((m) => (
                  <tr key={`${m.memoryType}|${m.memoryKey}`} className="border-t">
                    <td className="py-1 font-mono">{m.memoryType}</td>
                    <td className="py-1 font-mono">{m.memoryKey.slice(0, 40)}</td>
                    <td className="py-1 text-right font-mono">{m.confidence.toFixed(2)}</td>
                    <td className="py-1 text-right font-mono">
                      {m.successCount} / {m.failureCount}
                    </td>
                    <td className="py-1 font-mono">
                      {m.lastUsedAt ? m.lastUsedAt.toISOString().slice(0, 19) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>

        {/* Durable rollback ledger (spec: rollback guarantees). */}
        <article className="rounded border bg-white p-4 shadow-sm md:col-span-2">
          <h2 className="font-display text-xl text-ink">Rollback ledger</h2>
          {recentRollbacks.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">
              No rollbacks recorded. Every post-publish rollback is logged here with whether it can
              be safely restored.
            </p>
          ) : (
            <table className="mt-2 w-full text-xs">
              <thead>
                <tr className="text-left uppercase text-ink-soft">
                  <th>Type</th>
                  <th>Slug</th>
                  <th>Result</th>
                  <th>Restorable</th>
                  <th>Review?</th>
                  <th>Reason</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {recentRollbacks.map((r) => (
                  <tr
                    key={r.id}
                    className={`border-t ${r.rollbackResult === "DELETED" ? "bg-rose-50" : "bg-amber-50"}`}
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
              </tbody>
            </table>
          )}
        </article>

        {/* Exact stage-outcome ledger (spec: make brain feedback exact). */}
        <article className="rounded border bg-white p-4 shadow-sm md:col-span-2">
          <h2 className="font-display text-xl text-ink">Stage outcomes (exact feedback)</h2>
          {recentStageOutcomes.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">
              No stage outcomes yet. Every dispatcher stage writes one precise outcome row.
            </p>
          ) : (
            <table className="mt-2 w-full text-xs">
              <thead>
                <tr className="text-left uppercase text-ink-soft">
                  <th>Stage</th>
                  <th>Result</th>
                  <th>Type</th>
                  <th className="text-right">ms</th>
                  <th>Repair?</th>
                  <th>Next / failure</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {recentStageOutcomes.map((s) => (
                  <tr
                    key={s.id}
                    className={`border-t ${
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
                    <td className="py-1 font-serif">
                      {s.failureReason ?? s.downstreamStage ?? "—"}
                    </td>
                    <td className="py-1 font-mono">{s.createdAt.toISOString().slice(11, 19)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>

        {/* Full quality model — shows which dimension failed. */}
        <article className="rounded border bg-white p-4 shadow-sm md:col-span-2">
          <h2 className="font-display text-xl text-ink">Quality scores — failed dimensions</h2>
          {recentQualityScores.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">
              No quality scores yet. Each built package records a full ten-dimension score.
            </p>
          ) : (
            <table className="mt-2 w-full text-xs">
              <thead>
                <tr className="text-left uppercase text-ink-soft">
                  <th>Content type</th>
                  <th className="text-right">Score</th>
                  <th className="text-right">Threshold</th>
                  <th>Result</th>
                  <th>Failed dimensions</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {recentQualityScores.map((q) => (
                  <tr key={q.id} className={`border-t ${q.passed ? "" : "bg-rose-50"}`}>
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
              </tbody>
            </table>
          )}
        </article>

        {/* Latest repair plans (spec §17 + §18). */}
        <article className="rounded border bg-white p-4 shadow-sm md:col-span-2">
          <h2 className="font-display text-xl text-ink">Latest repair plans</h2>
          {recentRepairs.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">No repair plans on record.</p>
          ) : (
            <table className="mt-2 w-full text-xs">
              <thead>
                <tr className="text-left uppercase text-ink-soft">
                  <th>Kind</th>
                  <th>Status</th>
                  <th className="text-right">Attempts</th>
                  <th>Final result</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {recentRepairs.map((r) => (
                  <tr
                    key={r.id}
                    className={`border-t ${
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
                      {r.attempts} / {r.maxAttempts}
                    </td>
                    <td className="py-1 font-serif">{r.finalResult ?? "—"}</td>
                    <td className="py-1 font-mono">{r.updatedAt.toISOString().slice(0, 19)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>

        {/* Why no content growth — live diagnostic (spec §15).
            Walks the chain top-to-bottom and identifies the first
            blocked stage with the exact table, count, and next
            automatic repair. */}
        <article className="rounded border bg-white p-4 shadow-sm md:col-span-2">
          <h2 className="font-display text-xl text-ink">Why no content growth — live chain walk</h2>
          {whyNoGrowth ? (
            <>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm md:grid-cols-4">
                <dt className="text-ink-soft">Blocker stage</dt>
                <dd
                  className={`font-mono ${
                    whyNoGrowth.blocker === "NONE" ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {whyNoGrowth.blocker}
                </dd>
                <dt className="text-ink-soft">Content type</dt>
                <dd className="font-mono">{whyNoGrowth.contentType ?? "(all types)"}</dd>
                <dt className="text-ink-soft">Exact table</dt>
                <dd className="font-mono">{whyNoGrowth.exactTable || "—"}</dd>
                <dt className="text-ink-soft">Most recent failure</dt>
                <dd className="font-serif">
                  {whyNoGrowth.mostRecentFailure
                    ? `${whyNoGrowth.mostRecentFailure.when.toISOString().slice(0, 19)} — ${whyNoGrowth.mostRecentFailure.reason}`
                    : "none in window"}
                </dd>
                <dt className="text-ink-soft md:col-span-1">Explanation</dt>
                <dd className="font-serif md:col-span-3">{whyNoGrowth.blockerExplanation}</dd>
                <dt className="text-ink-soft md:col-span-1">Next automatic repair</dt>
                <dd className="font-serif md:col-span-3">
                  {whyNoGrowth.nextAutomaticRepair ?? "no repair queued"}
                </dd>
                <dt className="text-ink-soft md:col-span-1">Last worker decision</dt>
                <dd className="font-serif md:col-span-3">
                  {whyNoGrowth.lastWorkerDecision
                    ? `${whyNoGrowth.lastWorkerDecision.chosenAction}: ${whyNoGrowth.lastWorkerDecision.reason ?? "—"}`
                    : "no decision on record"}
                </dd>
                <dt className="text-ink-soft md:col-span-1">Next worker decision</dt>
                <dd className="font-serif md:col-span-3">{whyNoGrowth.nextWorkerDecision}</dd>
              </dl>

              <h3 className="mt-4 font-display text-sm uppercase tracking-wide text-ink-soft">
                Chain walk
              </h3>
              <table className="mt-1 w-full text-xs">
                <thead>
                  <tr className="text-left uppercase text-ink-soft">
                    <th>Stage</th>
                    <th>OK?</th>
                    <th className="text-right">Count</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {whyNoGrowth.checks.map((c) => (
                    <tr key={c.stage} className={`border-t ${c.ok ? "" : "bg-rose-50"}`}>
                      <td className="py-1 font-mono">{c.stage}</td>
                      <td className="py-1 font-mono">{c.ok ? "✓" : "✕"}</td>
                      <td className="py-1 text-right font-mono">{c.count}</td>
                      <td className="py-1 font-serif">{c.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">Diagnostic unavailable.</p>
          )}
        </article>

        {/* Why no content growth (spec §22 + §18). One panel per
            content type, showing the GrowthOrchestrator's
            classification and recommendation. */}
        <article className="rounded border bg-white p-4 shadow-sm md:col-span-2">
          <h2 className="font-display text-xl text-ink">Why no content growth?</h2>
          {growthSnapshots.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">
              No growth snapshots yet. The orchestrator writes one on each REPORTING pass.
            </p>
          ) : (
            <table className="mt-2 w-full text-xs">
              <thead>
                <tr className="text-left uppercase text-ink-soft">
                  <th>Content type</th>
                  <th>Status</th>
                  <th className="text-right">Gap</th>
                  <th className="text-right">24h</th>
                  <th className="text-right">7d</th>
                  <th className="text-right">Last growth</th>
                  <th>Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {growthSnapshots.map((g) => (
                  <tr
                    key={g.id}
                    className={`border-t ${
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
              </tbody>
            </table>
          )}
        </article>

        {/* Source coverage scorecard (spec §23). */}
        <article className="rounded border bg-white p-4 shadow-sm md:col-span-2">
          <h2 className="font-display text-xl text-ink">Source coverage</h2>
          {coverageRows.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">
              No source coverage scored yet. Runs on every REPORTING pass.
            </p>
          ) : (
            <table className="mt-2 w-full text-xs">
              <thead>
                <tr className="text-left uppercase text-ink-soft">
                  <th>Content type</th>
                  <th className="text-right">Primary</th>
                  <th className="text-right">Valid.</th>
                  <th className="text-right">Enrich.</th>
                  <th className="text-right">Active</th>
                  <th className="text-right">OK 7d</th>
                  <th className="text-right">Fail 7d</th>
                  <th className="text-right">Cand. 7d</th>
                  <th className="text-right">Builds 7d</th>
                  <th className="text-right">Publ. 7d</th>
                  <th className="text-right">Score</th>
                  <th>Block?</th>
                </tr>
              </thead>
              <tbody>
                {coverageRows.map((r) => (
                  <tr key={r.id} className={`border-t ${r.blockedByCoverage ? "bg-rose-50" : ""}`}>
                    <td className="py-1 font-mono">{r.contentType}</td>
                    <td className="py-1 text-right font-mono">{r.primarySources}</td>
                    <td className="py-1 text-right font-mono">{r.validationSources}</td>
                    <td className="py-1 text-right font-mono">{r.enrichmentSources}</td>
                    <td className="py-1 text-right font-mono">{r.activeSourceCount}</td>
                    <td className="py-1 text-right font-mono">{r.recentlySuccessfulSources}</td>
                    <td className="py-1 text-right font-mono">{r.recentlyFailedSources}</td>
                    <td className="py-1 text-right font-mono">{r.recentCandidates7d}</td>
                    <td className="py-1 text-right font-mono">{r.recentValidPackages7d}</td>
                    <td className="py-1 text-right font-mono">{r.recentPublishes7d}</td>
                    <td className="py-1 text-right font-mono">{r.coverageScore.toFixed(2)}</td>
                    <td className="py-1 font-serif">
                      {r.blockedByCoverage ? (r.blockReason ?? "blocked") : "ok"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>

        {/* Content growth execution funnel (spec §17). Full per-content-
            type funnel from candidates → public/search/sitemap. */}
        <article className="rounded border bg-white p-4 shadow-sm md:col-span-2">
          <h2 className="font-display text-xl text-ink">Content growth funnel (spec §17)</h2>
          <p className="mb-2 text-xs italic text-ink-soft">
            Per content type: candidates → prioritized → fetched → reads → blocks → artifacts →
            checklist → validation → strict QA → quality → published → post-publish, plus
            public/search/sitemap visibility. The bottleneck column shows the first stage that
            dropped to zero.
          </p>
          {funnel.length === 0 ? (
            <p className="text-sm italic text-ink-soft">No content goals seeded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left uppercase text-ink-soft">
                    <th>Type</th>
                    <th className="text-right">Cand.</th>
                    <th className="text-right">Prio.</th>
                    <th className="text-right">Fetch</th>
                    <th className="text-right">Reads</th>
                    <th className="text-right">Blocks</th>
                    <th className="text-right">Artif.</th>
                    <th className="text-right">Check.</th>
                    <th className="text-right">Valid.</th>
                    <th className="text-right">QA</th>
                    <th className="text-right">Qual.</th>
                    <th className="text-right">Pub.</th>
                    <th className="text-right">PostPub</th>
                    <th>Visible</th>
                    <th>Bottleneck</th>
                  </tr>
                </thead>
                <tbody>
                  {funnel.map((f) => (
                    <tr
                      key={f.contentType}
                      className={`border-t ${f.firstEmptyStage ? "bg-amber-50" : ""}`}
                    >
                      <td className="py-1 font-mono">{f.contentType}</td>
                      <td className="py-1 text-right font-mono">{f.candidatesDiscovered}</td>
                      <td className="py-1 text-right font-mono">{f.candidatesPrioritized}</td>
                      <td className="py-1 text-right font-mono">{f.sourcesFetched}</td>
                      <td className="py-1 text-right font-mono">{f.sourceReadsCreated}</td>
                      <td className="py-1 text-right font-mono">{f.structuredBlocksCreated}</td>
                      <td className="py-1 text-right font-mono">{f.packageArtifactsCreated}</td>
                      <td className="py-1 text-right font-mono">{f.checklistItemsCreated}</td>
                      <td className="py-1 text-right font-mono">{f.validationPasses}</td>
                      <td className="py-1 text-right font-mono">{f.strictQAPasses}</td>
                      <td className="py-1 text-right font-mono">{f.qualityScorePasses}</td>
                      <td className="py-1 text-right font-mono">{f.publishedItems}</td>
                      <td className="py-1 text-right font-mono">{f.postPublishPasses}</td>
                      <td className="py-1 font-mono">
                        {f.publicTabVisible ? "tab" : "—"}/{f.searchVisible ? "srch" : "—"}/
                        {f.sitemapVisible ? "map" : "—"}
                      </td>
                      <td className="py-1 font-serif">{f.firstEmptyStage ?? "flowing"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        {/* Pipeline snapshot (spec §3). Per-stage counts so the operator
            can see exactly where the chain is bottlenecked. */}
        <article className="rounded border bg-white p-4 shadow-sm md:col-span-2">
          <h2 className="font-display text-xl text-ink">Pipeline (Discovery → Cache)</h2>
          <table className="mt-2 w-full text-xs">
            <thead>
              <tr className="text-left uppercase text-ink-soft">
                <th>Stage</th>
                <th className="text-right">Pending</th>
                <th className="text-right">Running</th>
                <th className="text-right">Succeeded</th>
                <th className="text-right">Failed</th>
                <th className="text-right">Blocked</th>
              </tr>
            </thead>
            <tbody>
              {pipelineCounts.map((s) => (
                <tr
                  key={s.stage}
                  className={`border-t ${
                    s.failed > 0 || s.blocked > 0
                      ? "bg-rose-50"
                      : s.pending > 0
                        ? "bg-amber-50"
                        : ""
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
            </tbody>
          </table>
        </article>

        {/* Rejected candidates (spec §5). Surfaces the exact junk
            pattern that triggered each rejection. */}
        <article className="rounded border bg-white p-4 shadow-sm md:col-span-2">
          <h2 className="font-display text-xl text-ink">Rejected candidates (last 15)</h2>
          {rejectedCandidates.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">
              No rejected candidates. The candidate scorer flips junk-heavy URLs to REJECTED.
            </p>
          ) : (
            <table className="mt-2 w-full text-xs">
              <thead>
                <tr className="text-left uppercase text-ink-soft">
                  <th>Host</th>
                  <th>URL</th>
                  <th className="text-right">Junk</th>
                  <th className="text-right">Dup</th>
                  <th>Pattern</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {rejectedCandidates.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="py-1 font-mono">{r.sourceHost}</td>
                    <td className="py-1 font-mono break-all">{r.discoveredUrl.slice(0, 60)}</td>
                    <td className="py-1 text-right font-mono">{r.junkRisk.toFixed(2)}</td>
                    <td className="py-1 text-right font-mono">{r.duplicateRisk.toFixed(2)}</td>
                    <td className="py-1 font-mono text-[10px]">{r.rejectionPattern ?? "—"}</td>
                    <td className="py-1 font-serif">{r.rejectionReason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>

        {/* Production readiness (spec §28). */}
        <article className="rounded border bg-white p-4 shadow-sm md:col-span-2">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl text-ink">Production readiness</h2>
            <span
              className={`rounded px-2 py-0.5 text-xs font-mono ${
                readiness.failing === 0
                  ? "bg-emerald-100 text-emerald-900"
                  : readiness.passing >= readiness.checks.length / 2
                    ? "bg-amber-100 text-amber-900"
                    : "bg-rose-100 text-rose-900"
              }`}
            >
              {Math.round(readiness.score * 100)}% · {readiness.passing}/{readiness.checks.length}{" "}
              passing
            </span>
          </div>
          <ul className="mt-3 space-y-1 text-xs">
            {readiness.checks.map((c) => (
              <li
                key={c.key}
                className={`rounded border-l-4 px-2 py-1 ${
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
        </article>
      </section>
    </div>
  );
}

function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function Metric(props: {
  label: string;
  value: string;
  tone: "emerald" | "amber" | "rose" | "slate";
}) {
  const tone = {
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    rose: "text-rose-700",
    slate: "text-slate-900",
  }[props.tone];
  return (
    <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-ink-soft">{props.label}</div>
      <div className={`font-mono text-base ${tone}`}>{props.value}</div>
    </div>
  );
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

/**
 * Spec §13: extract the chosen action's source + candidate targets
 * from the persisted rankedAlternatives JSON (first entry = chosen).
 */
function chosenActionTargets(raw: unknown): {
  sourceTarget: string | null;
  candidateUrl: string | null;
} {
  if (!Array.isArray(raw) || raw.length === 0) return { sourceTarget: null, candidateUrl: null };
  const chosen = raw[0] as { sourceTarget?: string | null; candidateUrl?: string | null };
  return {
    sourceTarget: chosen?.sourceTarget ?? null,
    candidateUrl: chosen?.candidateUrl ?? null,
  };
}

/**
 * Spec §13: surface the memory + source reputation the brain consulted
 * for its decision. Read from the persisted rulesEvaluated JSON.
 */
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
        <h3 className="font-display uppercase tracking-wide text-ink-soft">Memory used</h3>
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
        <h3 className="font-display uppercase tracking-wide text-ink-soft">
          Source reputation used
        </h3>
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
      <h3 className="font-display text-sm uppercase tracking-wide text-ink-soft">
        Ranked alternatives (spec §1) — top 6
      </h3>
      <table className="mt-2 w-full text-xs">
        <thead>
          <tr className="text-left uppercase text-ink-soft">
            <th>#</th>
            <th>Stage</th>
            <th>Action</th>
            <th className="text-right">Score</th>
            <th className="text-right">Urgency</th>
            <th className="text-right">Risk</th>
            <th className="text-right">Quality</th>
            <th>Why</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 6).map((r, i) => (
            <tr
              key={`${r.missionStage}-${i}`}
              className={`border-t ${i === 0 ? "bg-emerald-50" : r.safe === false ? "text-rose-700" : ""}`}
            >
              <td className="py-1 font-mono">{i === 0 ? "★" : i + 1}</td>
              <td className="py-1 font-mono">{r.missionStage ?? "—"}</td>
              <td className="py-1 font-mono">{r.actionType ?? "—"}</td>
              <td className="py-1 text-right font-mono">
                {typeof r.finalScore === "number" ? r.finalScore.toFixed(1) : "—"}
              </td>
              <td className="py-1 text-right font-mono">
                {typeof r.urgencyScore === "number" ? r.urgencyScore.toFixed(1) : "—"}
              </td>
              <td className="py-1 text-right font-mono">
                {typeof r.riskScore === "number" ? r.riskScore.toFixed(2) : "—"}
              </td>
              <td className="py-1 text-right font-mono">
                {typeof r.qualityExpectation === "number" ? r.qualityExpectation.toFixed(2) : "—"}
              </td>
              <td className="py-1 font-serif">
                {i === 0
                  ? (r.reasonSummary ?? "chosen")
                  : (r.rejectionReason ?? r.reasonSummary ?? "lower score")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
