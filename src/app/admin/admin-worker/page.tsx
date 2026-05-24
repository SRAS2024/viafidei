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
  summarizeRatings,
} from "@/lib/admin-worker";
import { AdminWorkerPauseToggle } from "./AdminWorkerPauseToggle";
import { AdminWorkerControls } from "./AdminWorkerControls";

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

  const [state, ratings, recentPasses, recentSecurity, pendingReview, goals, recentDraft] =
    await Promise.all([
      getAdminWorkerState(prisma),
      runAdminWorkerDiagnostics(prisma),
      listRecentPasses(prisma, { limit: 10 }),
      listRecentSecurityActions(prisma, { limit: 5 }),
      countPendingReview(prisma),
      prisma.contentGoal.findMany({ orderBy: [{ gapCount: "desc" }, { priority: "asc" }] }),
      prisma.homepageWorkerDraft.findFirst({ orderBy: { createdAt: "desc" } }),
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
          <div className="mt-3 flex gap-3 text-xs">
            <Link className="text-indigo-600 underline" href="/admin/logs/worker">
              View logs
            </Link>
            <Link className="text-indigo-600 underline" href="/admin/diagnostics">
              Diagnostics card
            </Link>
            <Link className="text-indigo-600 underline" href="/admin/checklist/queue">
              Queue
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
        </article>
      </section>
    </div>
  );
}
