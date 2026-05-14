import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { listIngestionSourcesWithLatestRuns } from "@/lib/data/ingestion";
import { getDataManagementSettings } from "@/lib/data/site-settings";
import { getRecentActivityByContentType } from "@/lib/data/data-management-log";
import { getBacklogProgress } from "@/lib/ingestion/scheduler";
import { prisma } from "@/lib/db/client";
import { AdminSection } from "../_sections/AdminSection";
import { ManualIngestRunButton } from "./ManualIngestRunButton";
import { DataManagementSettings } from "./DataManagementSettings";
import { LiveBacklogPanel } from "./LiveBacklogPanel";

export const dynamic = "force-dynamic";

export default async function AdminIngestion() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const [sources, progress, dataManagement, activity24h, latestRun] = await Promise.all([
    listIngestionSourcesWithLatestRuns(),
    getBacklogProgress().catch(() => null),
    getDataManagementSettings(),
    getRecentActivityByContentType(24).catch(() => ({})),
    prisma.ingestionJobRun
      .findFirst({
        orderBy: { startedAt: "desc" },
        include: { job: { include: { source: true } } },
      })
      .catch(() => null),
  ]);

  // Compute the initial status snapshot for the live panel so the page
  // is informative on first paint, before the first poll lands.
  let status: "active" | "paused" | "disabled" | "running" | "failed" | "idle" = "idle";
  let statusDetail = "No recent activity.";
  if (!dataManagement.autoCleanupEnabled) {
    status = "paused";
    statusDetail =
      "Automatic Data Management is paused. Per-row ingestion validation still runs; catalog-wide cleanup is on manual control.";
  } else if (latestRun) {
    if (latestRun.status === "RUNNING") {
      status = "running";
      statusDetail = `${latestRun.job.source.name} → ${latestRun.job.jobName} running since ${latestRun.startedAt.toISOString().slice(0, 16)}.`;
    } else if (latestRun.status === "FAILED") {
      status = "failed";
      statusDetail = `Last run failed: ${latestRun.errorMessage?.slice(0, 200) ?? "no error message recorded"}`;
    } else if (latestRun.status === "PARTIAL") {
      status = "active";
      statusDetail = "Last run partially completed — some items were rejected or sent to review.";
    } else {
      status = "active";
      statusDetail = `Last run ${latestRun.status.toLowerCase()} at ${latestRun.startedAt.toISOString().slice(0, 16)}.`;
    }
  }

  return (
    <AdminSection titleKey="admin.card.ingestion">
      <DataManagementSettings
        initialAutoCleanupEnabled={dataManagement.autoCleanupEnabled}
        initialHardDeleteAfterDays={dataManagement.hardDeleteAfterDays}
      />
      <LiveBacklogPanel
        initialSnapshot={{
          progress: progress ?? null,
          settings: dataManagement,
          activity24h,
          status,
          statusDetail,
          latestRun: latestRun
            ? {
                status: latestRun.status,
                startedAt: latestRun.startedAt.toISOString(),
                finishedAt: latestRun.finishedAt?.toISOString() ?? null,
                recordsCreated: latestRun.recordsCreated,
                recordsUpdated: latestRun.recordsUpdated,
                recordsSkipped: latestRun.recordsSkipped,
                errorMessage: latestRun.errorMessage,
                jobName: latestRun.job.jobName,
                sourceName: latestRun.job.source.name,
              }
            : null,
        }}
      />
      {progress ? (
        <section className="mb-8 vf-card rounded-sm p-5">
          <h3 className="font-display text-xl">Manual ingestion run</h3>
          <p className="mt-1 font-serif text-sm text-ink-soft">
            The app runs ingestion automatically on every cron tick. This button is here for
            troubleshooting only — it acquires the same advisory lock as the cron job, so manual
            and automatic runs cannot conflict, duplicate content, or override valid content. Each
            adapter still skips rows that already exist by slug, externalSourceKey, or content
            checksum.
          </p>
          <div className="mt-3">
            <ManualIngestRunButton initialMode={progress.mode} />
          </div>
        </section>
      ) : null}

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
