import { redirect } from "next/navigation";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";
import {
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
import { AdminWorkerPauseToggle } from "./AdminWorkerPauseToggle";
import { AdminWorkerControls } from "./AdminWorkerControls";
import { RequestHomepageMakeoverButton } from "./RequestHomepageMakeoverButton";

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
  ]);

  const summary = summarizeRatings(ratings);

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
          <Link className="text-indigo-600 underline" href="/admin/diagnostics">
            Diagnostics →
          </Link>
          <Link className="text-indigo-600 underline" href="/admin">
            ← dashboard
          </Link>
        </div>
      </header>

      <AdminWorkerPauseToggle initialPaused={state.paused} initialReason={state.pausedReason} />

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
                  <th className="text-right">Min</th>
                  <th className="text-right">Gap</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {goals.map((g) => (
                  <tr key={g.id} className="border-t">
                    <td className="py-1 font-mono">{g.contentType}</td>
                    <td className="py-1 text-right font-mono">{g.currentValidCount}</td>
                    <td className="py-1 text-right font-mono">{g.minimumTarget}</td>
                    <td className="py-1 text-right font-mono">{g.gapCount}</td>
                    <td className="py-1 text-xs">{g.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
            <RequestHomepageMakeoverButton />
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
