import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { listIngestionSourcesWithLatestRuns } from "@/lib/data/ingestion";
import { getBacklogProgress } from "@/lib/ingestion/scheduler";
import { AdminSection } from "../_sections/AdminSection";
import { ManualIngestRunButton } from "./ManualIngestRunButton";

export const dynamic = "force-dynamic";

export default async function AdminIngestion() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const sources = await listIngestionSourcesWithLatestRuns();
  const progress = await getBacklogProgress().catch(() => null);

  return (
    <AdminSection titleKey="admin.card.ingestion">
      {progress ? (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-2xl">Backlog progress</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["Prayers", progress.counts.prayers, progress.targets.prayers],
                ["Saints", progress.counts.saints, progress.targets.saints],
                ["Parishes", progress.counts.parishes, progress.targets.parishes],
                [
                  "Church Documents",
                  progress.counts.churchDocuments,
                  progress.targets.churchDocuments,
                ],
                ["Sacraments", progress.counts.sacraments, progress.targets.sacraments],
                [
                  "Consecrations",
                  progress.counts.consecrations,
                  progress.targets.consecrations,
                ],
              ] as const
            ).map(([label, count, target]) => {
              const pct = Math.min(100, Math.round((count / Math.max(1, target)) * 100));
              const met = count >= target;
              return (
                <div key={label} className="vf-card rounded-sm p-5">
                  <p className="vf-eyebrow">{label}</p>
                  <p className="mt-2 font-display text-3xl">
                    {count.toLocaleString()}{" "}
                    <span className="text-base text-ink-faint">/ {target.toLocaleString()}</span>
                  </p>
                  <div className="mt-3 h-2 w-full rounded-sm bg-ink/10">
                    <div
                      className={`h-2 rounded-sm ${met ? "bg-emerald-600" : "bg-ink"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-ink-faint">
                    {pct}% · {met ? "target met" : "below target"}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="mt-4 vf-card rounded-sm p-5">
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
