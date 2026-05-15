import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  loadIngestionLiveSnapshot,
  runIngestionDiagnostics,
  type DiagnosticResult,
} from "@/lib/diagnostics";
import {
  getRecentActivityByAction,
  getRecentActivityByContentType,
  dataManagementActionLabel,
} from "@/lib/data/data-management-log";
import { AdminSection } from "../../_sections/AdminSection";

export const dynamic = "force-dynamic";

function statusColor(status: string) {
  switch (status) {
    case "pass":
      return "#185c2a";
    case "warn":
      return "#9b6b00";
    case "fail":
      return "#8b1a1a";
    default:
      return "#3b3f4a";
  }
}

function statusGlyph(status: string) {
  switch (status) {
    case "pass":
      return "✓";
    case "warn":
      return "!";
    case "fail":
      return "✗";
    default:
      return "·";
  }
}

function liveStatusBadge(status: string): { bg: string; text: string; label: string } {
  switch (status) {
    case "running":
      return { bg: "bg-blue-100", text: "text-blue-800", label: "RUNNING" };
    case "active":
      return { bg: "bg-emerald-100", text: "text-emerald-800", label: "ACTIVE" };
    case "maintenance":
      return { bg: "bg-emerald-100", text: "text-emerald-800", label: "MAINTENANCE" };
    case "stale":
      return { bg: "bg-amber-100", text: "text-amber-800", label: "STALE" };
    case "disabled":
      return { bg: "bg-amber-100", text: "text-amber-800", label: "DISABLED" };
    case "blocked":
      return { bg: "bg-red-100", text: "text-red-800", label: "BLOCKED" };
    case "failing":
      return { bg: "bg-red-100", text: "text-red-800", label: "FAILING" };
    default:
      return { bg: "bg-stone-100", text: "text-stone-700", label: "IDLE" };
  }
}

function ResultCard({ r }: { r: DiagnosticResult }) {
  return (
    <li className="vf-card rounded-sm p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-xs text-white"
          style={{ backgroundColor: statusColor(r.severity) }}
        >
          {statusGlyph(r.severity)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="break-words font-display text-base text-ink">{r.label}</p>
            <span
              className="font-mono text-[0.65rem] uppercase tracking-wide"
              style={{ color: statusColor(r.severity) }}
            >
              {r.severity}
            </span>
          </div>
          <p className="mt-1 break-words font-serif text-sm text-ink-soft">{r.summary}</p>
          {r.explanation ? (
            <p className="mt-2 break-words font-serif text-xs text-ink-faint">{r.explanation}</p>
          ) : null}
          {r.evidence ? (
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-sm bg-paper-soft px-2 py-1 font-mono text-xs text-ink-faint">
              {Object.entries(r.evidence)
                .map(([k, v]) => `${k}: ${v}`)
                .join("\n")}
            </pre>
          ) : null}
          <p className="mt-2 font-serif text-xs text-ink-faint">
            Ran at {new Date(r.ranAt).toISOString().replace("T", " ").slice(0, 19)}
            {typeof r.durationMs === "number" ? ` · ${r.durationMs}ms` : null} · request id{" "}
            <span className="font-mono">{r.requestId}</span>
          </p>
        </div>
      </div>
    </li>
  );
}

export default async function IngestionDiagnostics() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const [section, snapshot, byContentType, byAction] = await Promise.all([
    runIngestionDiagnostics(),
    loadIngestionLiveSnapshot().catch(() => null),
    getRecentActivityByContentType(24).catch(() => ({}) as Record<string, number>),
    getRecentActivityByAction(24).catch(() => ({}) as Record<string, number>),
  ]);

  const lr = snapshot?.lastRun;
  const badge = snapshot ? liveStatusBadge(snapshot.status) : null;

  return (
    <AdminSection
      titleKey="admin.card.diagnostics"
      subtitle="Ingestion & Data Management — live status, last successful and failed runs, 24h activity, content totals, review queue, and per-action data-management counts."
    >
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link href="/admin/diagnostics" className="vf-nav-link">
          ← Diagnostics
        </Link>
        <Link href="/admin/ingestion" className="vf-nav-link">
          Open Ingestion →
        </Link>
        <Link href="/admin/logs/ingestion" className="vf-nav-link">
          Ingestion run logs →
        </Link>
        <Link href="/admin/logs/data-management" className="vf-nav-link">
          Data Management logs →
        </Link>
      </div>

      {snapshot ? (
        <section className="mb-8 vf-card rounded-sm p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-xl">Live status</h2>
            {badge ? (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs uppercase ${badge.bg} ${badge.text}`}
              >
                {badge.label}
              </span>
            ) : null}
          </div>
          <p className="mt-2 font-serif text-sm text-ink-soft">{snapshot.detail}</p>
          <dl className="mt-4 grid gap-3 font-serif text-sm sm:grid-cols-2">
            <div>
              <dt className="vf-eyebrow text-ink-faint">Auto-cleanup</dt>
              <dd className="mt-0.5 text-ink">
                {snapshot.autoCleanupEnabled
                  ? `Enabled · hard-delete after ${snapshot.hardDeleteAfterDays} day${snapshot.hardDeleteAfterDays === 1 ? "" : "s"}`
                  : "Disabled — manual control"}
              </dd>
            </div>
            <div>
              <dt className="vf-eyebrow text-ink-faint">Runs in last 24h</dt>
              <dd className="mt-0.5 text-ink">
                {snapshot.totalRuns24h} total · {snapshot.failedRuns24h} failed
              </dd>
            </div>
            <div>
              <dt className="vf-eyebrow text-ink-faint">Last successful run</dt>
              <dd className="mt-0.5 text-ink">
                {snapshot.lastSuccessAt
                  ? snapshot.lastSuccessAt.replace("T", " ").slice(0, 19) + " UTC"
                  : "never"}
              </dd>
            </div>
            <div>
              <dt className="vf-eyebrow text-ink-faint">Last failed run</dt>
              <dd className="mt-0.5 text-ink">
                {snapshot.lastFailureAt
                  ? snapshot.lastFailureAt.replace("T", " ").slice(0, 19) + " UTC"
                  : "no failures recorded"}
              </dd>
            </div>
          </dl>
          {lr ? (
            <div className="mt-5 rounded-sm border border-ink/10 p-4">
              <p className="vf-eyebrow text-ink-faint">Last ingestion run detail</p>
              <dl className="mt-2 grid gap-2 font-serif text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-ink-faint">Source</dt>
                  <dd className="text-ink">{lr.sourceName}</dd>
                </div>
                <div>
                  <dt className="text-ink-faint">Job</dt>
                  <dd className="text-ink">{lr.jobName}</dd>
                </div>
                <div>
                  <dt className="text-ink-faint">Status</dt>
                  <dd className="text-ink">{lr.status}</dd>
                </div>
                <div>
                  <dt className="text-ink-faint">Started</dt>
                  <dd className="text-ink">{lr.startedAt.replace("T", " ").slice(0, 19)}</dd>
                </div>
                <div>
                  <dt className="text-ink-faint">Finished</dt>
                  <dd className="text-ink">
                    {lr.finishedAt ? lr.finishedAt.replace("T", " ").slice(0, 19) : "still running"}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-faint">Duration</dt>
                  <dd className="text-ink">
                    {typeof lr.durationMs === "number" ? `${lr.durationMs}ms` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-faint">Created</dt>
                  <dd className="text-ink">{lr.recordsCreated}</dd>
                </div>
                <div>
                  <dt className="text-ink-faint">Updated</dt>
                  <dd className="text-ink">{lr.recordsUpdated}</dd>
                </div>
                <div>
                  <dt className="text-ink-faint">Skipped</dt>
                  <dd className="text-ink">{lr.recordsSkipped}</dd>
                </div>
                <div>
                  <dt className="text-ink-faint">Failed</dt>
                  <dd className={lr.recordsFailed > 0 ? "text-red-700" : "text-ink"}>
                    {lr.recordsFailed}
                  </dd>
                </div>
                {lr.errorMessage ? (
                  <div className="sm:col-span-2">
                    <dt className="text-ink-faint">Error message</dt>
                    <dd className="break-words font-mono text-xs text-red-700">
                      {lr.errorMessage.slice(0, 400)}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
          ) : null}
        </section>
      ) : null}

      <header className="mb-6 vf-card rounded-sm p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-xl">{section.label}</h2>
          <span
            className="inline-flex items-center gap-2 font-serif text-sm"
            style={{ color: statusColor(section.severity) }}
          >
            <span
              aria-hidden="true"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full font-mono text-xs text-white"
              style={{ backgroundColor: statusColor(section.severity) }}
            >
              {statusGlyph(section.severity)}
            </span>
            Overall: <span className="font-medium uppercase">{section.severity}</span>
          </span>
        </div>
        <p className="mt-1 font-serif text-xs text-ink-faint">
          Run at {new Date(section.ranAt).toISOString().replace("T", " ").slice(0, 19)} · request id{" "}
          <span className="font-mono">{section.requestId}</span>
        </p>
      </header>

      <ul className="mt-4 flex flex-col gap-3">
        {section.results.map((r) => (
          <ResultCard key={r.id} r={r} />
        ))}
      </ul>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="vf-card rounded-sm p-5">
          <h3 className="font-display text-lg">Activity by content type (24h)</h3>
          {Object.keys(byContentType).length === 0 ? (
            <p className="mt-3 font-serif text-sm text-ink-faint">
              No actions recorded yet — see the diagnostic above for whether the cron is running.
            </p>
          ) : (
            <ul className="mt-3 grid gap-2 font-serif text-sm">
              {Object.entries(byContentType)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => (
                  <li key={type} className="flex items-baseline justify-between">
                    <span className="text-ink-soft">{type}</span>
                    <span className="font-medium text-ink">{count}</span>
                  </li>
                ))}
            </ul>
          )}
        </div>
        <div className="vf-card rounded-sm p-5">
          <h3 className="font-display text-lg">Activity by action (24h)</h3>
          {Object.keys(byAction).length === 0 ? (
            <p className="mt-3 font-serif text-sm text-ink-faint">No actions recorded yet.</p>
          ) : (
            <ul className="mt-3 grid gap-2 font-serif text-sm">
              {Object.entries(byAction)
                .sort((a, b) => b[1] - a[1])
                .map(([action, count]) => (
                  <li key={action} className="flex items-baseline justify-between">
                    <span className="text-ink-soft">{dataManagementActionLabel(action)}</span>
                    <span className="font-medium text-ink">{count}</span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </section>
    </AdminSection>
  );
}
