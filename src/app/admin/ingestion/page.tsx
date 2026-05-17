import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { listIngestionSourcesWithLatestRuns } from "@/lib/data/ingestion";
import { getDataManagementSettings } from "@/lib/data/site-settings";
import {
  getRecentActivityByAction,
  getRecentActivityByContentType,
} from "@/lib/data/data-management-log";
import { loadIngestionLiveSnapshot, getDashboardWarnings } from "@/lib/diagnostics";
import { getBacklogProgress } from "@/lib/ingestion/scheduler";
import { AdminSection } from "../_sections/AdminSection";
import { ManualIngestRunButton } from "./ManualIngestRunButton";
import { ManualCleanupRunButton } from "./ManualCleanupRunButton";
import { DataManagementSettings } from "./DataManagementSettings";
import { LiveBacklogPanel } from "./LiveBacklogPanel";

export const dynamic = "force-dynamic";

function describeZeroActivity(args: {
  totalRuns24h: number;
  autoCleanupEnabled: boolean;
  hardDeleteAfterDays: number;
  totalActions: number;
}): string {
  // We never show a blunt "0 edits in 24h" — every empty state explains
  // which condition produced it so the admin knows whether to investigate.
  const { totalRuns24h, autoCleanupEnabled, totalActions } = args;
  if (!autoCleanupEnabled) {
    return "0 edits in the last 24h — automatic Data Management is disabled, so only manual admin actions would write to this log.";
  }
  if (totalRuns24h === 0) {
    return "0 edits in the last 24h — no ingestion run ticked in the last 24 hours. Check the cron token / scheduler config.";
  }
  if (totalActions === 0) {
    return `0 edits in the last 24h — ingestion ran ${totalRuns24h} time${totalRuns24h === 1 ? "" : "s"} but every item was deduplicated as already-in-catalog. This is the normal steady state when there is no new upstream content.`;
  }
  return `${totalActions} action${totalActions === 1 ? "" : "s"} in the last 24h.`;
}

export default async function AdminIngestion() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const [sources, progress, dataManagement, activity24h, byAction, snapshot, warnings] =
    await Promise.all([
      listIngestionSourcesWithLatestRuns(),
      getBacklogProgress().catch(() => null),
      getDataManagementSettings(),
      getRecentActivityByContentType(24).catch(() => ({}) as Record<string, number>),
      getRecentActivityByAction(24).catch(() => ({}) as Record<string, number>),
      loadIngestionLiveSnapshot().catch(() => null),
      getDashboardWarnings().catch(() => [] as Awaited<ReturnType<typeof getDashboardWarnings>>),
    ]);

  const totalActions = Object.values(byAction).reduce((sum, n) => sum + n, 0);
  const activitySummary = describeZeroActivity({
    totalRuns24h: snapshot?.totalRuns24h ?? 0,
    autoCleanupEnabled: dataManagement.autoCleanupEnabled,
    hardDeleteAfterDays: dataManagement.hardDeleteAfterDays,
    totalActions,
  });

  return (
    <AdminSection titleKey="admin.card.ingestion">
      {warnings.length > 0 ? (
        <section className="mb-6 vf-card rounded-sm border-l-4 border-amber-500 bg-amber-50 p-4">
          <p className="font-display text-lg text-amber-900">
            {warnings.length} active dashboard warning{warnings.length === 1 ? "" : "s"}
          </p>
          <ul className="mt-3 space-y-3 font-serif text-sm text-amber-900">
            {warnings.map((w) => (
              <li key={w.key}>
                <p className="font-medium">{w.label}</p>
                <p className="mt-1 text-xs">{w.detail}</p>
                <p className="mt-1 text-xs italic">{w.actionable}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <nav className="mb-6 flex flex-wrap gap-3 font-serif text-sm">
        <Link
          href="/admin/ingestion/factory"
          className="vf-nav-link rounded-sm border border-stone-300 px-3 py-1 hover:bg-stone-100"
        >
          Content Factory Dashboard →
        </Link>
        <Link
          href="/admin/ingestion/why-not-visible"
          className="vf-nav-link rounded-sm border border-stone-300 px-3 py-1 hover:bg-stone-100"
        >
          Why is this content not visible? →
        </Link>
        <Link
          href="/admin/ingestion/queue"
          className="vf-nav-link rounded-sm border border-stone-300 px-3 py-1 hover:bg-stone-100"
        >
          Queue jobs →
        </Link>
        <Link
          href="/admin/ingestion/workers"
          className="vf-nav-link rounded-sm border border-stone-300 px-3 py-1 hover:bg-stone-100"
        >
          Workers →
        </Link>
      </nav>

      <DataManagementSettings
        initialAutoCleanupEnabled={dataManagement.autoCleanupEnabled}
        initialHardDeleteAfterDays={dataManagement.hardDeleteAfterDays}
      />
      <LiveBacklogPanel
        initialSnapshot={{
          progress: progress ?? null,
          settings: dataManagement,
          activity24h,
          status: snapshot?.status ?? "idle",
          statusDetail: snapshot?.detail ?? "No recent activity.",
          latestRun: snapshot?.lastRun
            ? {
                status: snapshot.lastRun.status,
                startedAt: snapshot.lastRun.startedAt,
                finishedAt: snapshot.lastRun.finishedAt,
                recordsCreated: snapshot.lastRun.recordsCreated,
                recordsUpdated: snapshot.lastRun.recordsUpdated,
                recordsSkipped: snapshot.lastRun.recordsSkipped,
                errorMessage: snapshot.lastRun.errorMessage,
                jobName: snapshot.lastRun.jobName,
                sourceName: snapshot.lastRun.sourceName,
              }
            : null,
        }}
      />

      <section className="mb-8 vf-card rounded-sm p-5">
        <h3 className="font-display text-xl">24-hour activity</h3>
        <p className="mt-1 font-serif text-sm text-ink-soft">{activitySummary}</p>
        <p className="mt-1 font-serif text-xs text-ink-faint">
          See{" "}
          <Link href="/admin/logs/data-management" className="vf-nav-link">
            Data Management logs
          </Link>{" "}
          for per-item add / update / skip / reject detail, or{" "}
          <Link href="/admin/logs/ingestion" className="vf-nav-link">
            Ingestion run logs
          </Link>{" "}
          for the per-run picture.
        </p>
      </section>

      <section className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="vf-card rounded-sm p-5">
          <h3 className="font-display text-xl">Run ingestion now</h3>
          <p className="mt-1 font-serif text-sm text-ink-soft">
            Triggers every active ingestion job once. Uses the same advisory lock as the cron job so
            manual and automatic runs cannot conflict, duplicate content, or override valid content.
          </p>
          <div className="mt-3">
            <ManualIngestRunButton initialMode={progress?.mode ?? "constant"} />
          </div>
        </div>
        <div className="vf-card rounded-sm p-5">
          <h3 className="font-display text-xl">Run data cleanup now</h3>
          <p className="mt-1 font-serif text-sm text-ink-soft">
            Runs the misc-content archive sweep, duplicate-prayer collapse, and the hard-delete
            pass. Same logic the cron job runs — safe to run manually whenever you want to see the
            result immediately.
          </p>
          <div className="mt-3">
            <ManualCleanupRunButton />
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-2xl">Sources</h2>
        {sources.length === 0 ? (
          <div className="vf-card rounded-sm p-8 text-center font-serif text-ink-faint">
            No ingestion sources registered yet. They are created automatically on the next
            scheduler tick.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {sources.map((s) => {
              const latest = s.jobs
                .flatMap((j) => j.runs)
                .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
              return (
                <div key={s.id} className="vf-card rounded-sm p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="vf-eyebrow">{s.isOfficial ? "Official" : "Source"}</p>
                      <h3 className="mt-1 font-display text-2xl">{s.name}</h3>
                      <p className="font-serif text-sm text-ink-faint">{s.host}</p>
                    </div>
                    <div className="text-right font-serif text-xs text-ink-faint">
                      <div>
                        {s.jobs.length} job{s.jobs.length === 1 ? "" : "s"}
                      </div>
                      {latest ? (
                        <div className="mt-1">
                          last run {latest.startedAt.toISOString().slice(0, 16)} ·{" "}
                          <span
                            className={
                              latest.status === "SUCCESS"
                                ? "text-emerald-700"
                                : latest.status === "FAILED"
                                  ? "text-red-700"
                                  : "text-ink-soft"
                            }
                          >
                            {latest.status}
                          </span>
                        </div>
                      ) : (
                        <div className="mt-1">no runs yet</div>
                      )}
                    </div>
                  </div>
                  {latest ? (
                    <div className="mt-3 grid grid-cols-2 gap-2 font-serif text-xs text-ink-soft sm:grid-cols-4">
                      <span>seen: {latest.recordsSeen}</span>
                      <span>created: {latest.recordsCreated}</span>
                      <span>updated: {latest.recordsUpdated}</span>
                      <span>skipped: {latest.recordsSkipped}</span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </AdminSection>
  );
}
