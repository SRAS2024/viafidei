import { redirect } from "next/navigation";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";
import { runAllDiagnostics } from "@/lib/diagnostics";
// Deep module imports, deliberately NOT the `@/lib/admin-worker` barrel.
// The barrel re-exports the whole ~150-module worker tree (dispatcher, Python
// brain bridge, headless-browser fetcher, PDF report generator, skills), so a
// single barrel import drags all of it into the production web server's bundle
// and resident memory — for a page that only needs four cheap Postgres reads.
import { runAdminWorkerDiagnostics, summarizeRatings } from "@/lib/admin-worker/diagnostics";
import { readExecutionStatus } from "@/lib/admin-worker/execution-host";
import { listRecentPasses } from "@/lib/admin-worker/passes";
import { getAdminWorkerState } from "@/lib/admin-worker/state";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export default async function DiagnosticsPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const [results, adminWorkerRatings, state, recentPasses, execution] = await Promise.all([
    runAllDiagnostics(),
    runAdminWorkerDiagnostics(prisma),
    getAdminWorkerState(prisma),
    listRecentPasses(prisma, { limit: 15 }),
    readExecutionStatus(prisma),
  ]);
  const counts = { pass: 0, warn: 0, fail: 0 };
  for (const r of results) counts[r.status]++;
  const awSummary = summarizeRatings(adminWorkerRatings);

  // Worker liveness for the pause/status banner (matches the Command Center's
  // 10-minute heartbeat cutoff), so it reads "Offline" rather than "Active"
  // when the process isn't running.
  const heartbeatAgeMs = state.lastHeartbeatAt
    ? Date.now() - state.lastHeartbeatAt.getTime()
    : null;
  // Liveness means "the LOCAL runtime on the operator's Mac is alive". A fresh
  // heartbeat with no live local lease is not an active worker.
  const workerLive =
    execution.executingLocally && heartbeatAgeMs != null && heartbeatAgeMs <= 10 * 60 * 1000;
  const heartbeatAgo =
    heartbeatAgeMs == null
      ? "never"
      : heartbeatAgeMs < 60_000
        ? "just now"
        : heartbeatAgeMs < 3_600_000
          ? `${Math.round(heartbeatAgeMs / 60_000)}m ago`
          : `${Math.round(heartbeatAgeMs / 3_600_000)}h ago`;

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">System diagnostics</h1>
          <p className="mt-1 font-serif text-ink-soft">
            Live health of the Admin Worker and the checklist-first system.{" "}
            <span className="font-medium text-green-700">{counts.pass + awSummary.pass} pass</span>{" "}
            ·{" "}
            <span className="font-medium text-amber-700">{counts.warn + awSummary.warn} warn</span>{" "}
            · <span className="font-medium text-rose-700">{counts.fail + awSummary.fail} fail</span>
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link className="text-indigo-600 underline" href="/admin/logs/worker">
            Worker logs →
          </Link>
          <Link className="text-indigo-600 underline" href="/admin/checklist">
            ← dashboard
          </Link>
        </div>
      </header>

      {/*
        Execution status — READ ONLY. The Admin Worker's controls (activation,
        passes, homepage makeover, reports, file ingestion) live in the native
        Via Fidei application, which runs the worker on the operator's MacBook.
        The browser admin deliberately exposes no way to start worker work on
        the production web service.
      */}
      <section
        className="rounded-sm border p-4"
        data-execution-state={execution.state}
        style={{
          borderColor: execution.state === "LOCAL_ACTIVE" ? "#185c2a" : "#94908a",
          backgroundColor: execution.state === "LOCAL_ACTIVE" ? "#f0f7f1" : "#f4f3f0",
        }}
      >
        <h2 className="font-display text-xl text-ink">Admin Worker execution</h2>
        <p className="mt-1 font-serif text-sm text-ink-soft">{execution.label}</p>
        <p className="mt-1 text-xs text-ink-soft">
          Heartbeat {heartbeatAgo} ·{" "}
          {workerLive ? "local runtime healthy" : "no active local runtime"}
          {execution.lease ? ` · host ${execution.lease.host.label}` : ""}
          {state.paused ? " · paused" : ""}
        </p>
        <p className="mt-2 text-xs italic text-ink-soft">
          The Admin Worker runs on the operator&apos;s MacBook, under the native Via Fidei
          application. Turning it off means no worker runs anywhere — the production service never
          takes the work over.
        </p>
      </section>

      <section>
        <h2 className="font-display text-2xl text-ink">Admin Worker health</h2>
        <p className="mb-2 text-xs italic text-ink-soft">
          30 ratings covering every Admin Worker subsystem. Each rating links to the underlying data
          source.
        </p>
        <div className="space-y-2">
          {adminWorkerRatings.map((r) => (
            <DiagnosticRow
              key={r.key}
              status={r.status}
              label={r.label}
              summary={r.summary}
              score={r.score}
              recommended={r.recommendedRepair}
              dataSource={r.dataSource}
              blocker={r.currentBlocker}
              automaticRepairStatus={r.automaticRepairStatus}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl text-ink">Admin Worker pass breakdown</h2>
        <p className="mb-2 text-xs italic text-ink-soft">
          Most recent passes. Each row records what the worker decided, what it ran, and what the
          outcome was.
        </p>
        {recentPasses.length === 0 ? (
          <p className="rounded border border-dashed border-slate-300 p-4 text-sm italic text-ink-soft">
            No passes recorded yet. Switch the Admin Worker on in the native Via Fidei application
            to populate this list.
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left uppercase text-ink-soft">
                <th className="py-1">Pass ID</th>
                <th>Started</th>
                <th>Completed</th>
                <th>Status</th>
                <th className="text-right">Planned</th>
                <th className="text-right">Done</th>
                <th className="text-right">Failed</th>
                <th className="text-right">Built</th>
                <th className="text-right">Pub</th>
                <th className="text-right">Rej</th>
                <th className="text-right">Sec</th>
                <th className="text-right">Home</th>
                <th>Logs</th>
              </tr>
            </thead>
            <tbody>
              {recentPasses.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="py-1 font-mono">{p.id.slice(0, 8)}</td>
                  <td className="font-mono">{p.startedAt.toISOString()}</td>
                  <td className="font-mono">{p.completedAt?.toISOString() ?? "—"}</td>
                  <td>{p.status}</td>
                  <td className="text-right">{p.tasksPlanned}</td>
                  <td className="text-right">{p.tasksCompleted}</td>
                  <td className="text-right">{p.tasksFailed}</td>
                  <td className="text-right">{p.contentBuilt}</td>
                  <td className="text-right">{p.contentPublished}</td>
                  <td className="text-right">{p.contentRejected}</td>
                  <td className="text-right">{p.securityActions}</td>
                  <td className="text-right">{p.homepageActions}</td>
                  <td>
                    <Link
                      className="text-indigo-600 underline"
                      href={`/admin/logs/worker?passId=${p.id}`}
                    >
                      view
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="font-display text-2xl text-ink">Checklist-first system</h2>
        <div className="space-y-2">
          {results.map((r) => (
            <DiagnosticRow
              key={r.key}
              status={r.status}
              label={r.label}
              summary={r.summary}
              recommended={r.suggestedAction}
              details={r.details}
              metric={r.metric}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function DiagnosticRow(props: {
  status: "pass" | "warn" | "fail" | "unknown";
  label: string;
  summary: string;
  recommended?: string;
  blocker?: string;
  dataSource?: string;
  details?: string[];
  metric?: number;
  score?: number;
  automaticRepairStatus?: "in_progress" | "available" | "manual";
}) {
  const tone =
    props.status === "pass"
      ? "border-green-500 bg-green-50 text-green-900"
      : props.status === "warn"
        ? "border-amber-500 bg-amber-50 text-amber-900"
        : props.status === "fail"
          ? "border-rose-600 bg-rose-100 text-black"
          : "border-slate-400 bg-slate-50 text-slate-900";
  const badge =
    props.status === "pass"
      ? "bg-green-600 text-white"
      : props.status === "warn"
        ? "bg-amber-500 text-black"
        : props.status === "fail"
          ? "bg-rose-600 text-white"
          : "bg-slate-500 text-white";
  return (
    <div className={`rounded border-l-4 ${tone} px-4 py-3`} data-status={props.status}>
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`rounded px-2 py-0.5 text-xs uppercase ${badge}`}>{props.status}</span>
          <span className="font-display text-lg">{props.label}</span>
        </div>
        {(props.metric != null || props.score != null) && (
          <span className="font-mono text-xs">{(props.metric ?? props.score ?? 0).toFixed(2)}</span>
        )}
      </div>
      <p className="mt-1 font-serif text-sm">{props.summary}</p>
      {props.details && props.details.length > 0 && (
        <ul className="mt-2 list-disc pl-6 text-xs">
          {props.details.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}
      {props.dataSource && (
        <p className="mt-1 text-[10px] uppercase tracking-wide text-ink-soft">
          source: {props.dataSource}
        </p>
      )}
      {props.blocker && <p className="mt-1 text-xs">Blocker: {props.blocker}</p>}
      {props.automaticRepairStatus && (
        <p className="mt-1 text-[10px] uppercase tracking-wide text-ink-soft">
          auto-repair:{" "}
          {props.automaticRepairStatus === "in_progress"
            ? "in progress"
            : props.automaticRepairStatus === "available"
              ? "available"
              : "manual"}
        </p>
      )}
      {props.recommended && <p className="mt-2 text-xs italic">→ {props.recommended}</p>}
    </div>
  );
}
