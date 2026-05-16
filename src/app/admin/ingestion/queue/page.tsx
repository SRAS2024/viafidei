import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getQueueDashboard } from "@/lib/data/ingestion-dashboard";
import { listQueueJobs } from "@/lib/ingestion/queue/queue";
import { AdminSection } from "../../_sections/AdminSection";
import { QueueRetryButton } from "./QueueRetryButton";
import { QueueFilters } from "./QueueFilters";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  pending: "text-ink",
  running: "text-emerald-700",
  completed: "text-emerald-700",
  failed: "text-red-700",
  skipped: "text-ink-faint",
  retrying: "text-amber-700",
};

export default async function QueuePage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const dashboard = await getQueueDashboard();
  const initialRows = await listQueueJobs({ take: 100 });

  return (
    <AdminSection
      titleKey="admin.card.ingestion"
      subtitle="Durable ingestion job queue. Pending, running, completed, failed, skipped, and retrying job counts."
    >
      <section className="mb-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {(["pending", "running", "completed", "failed", "skipped", "retrying"] as const).map(
          (status) => (
            <div key={status} className="vf-card rounded-sm p-4 text-center">
              <p className="vf-eyebrow">{status}</p>
              <p className={`mt-1 font-display text-3xl ${STATUS_TONE[status] ?? ""}`}>
                {dashboard.counts[status]}
              </p>
            </div>
          ),
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-display text-2xl">Failed (need review)</h2>
        {dashboard.failedNeedingReview.length === 0 ? (
          <div className="vf-card rounded-sm p-8 text-center font-serif text-ink-faint">
            No failed jobs awaiting review.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {dashboard.failedNeedingReview.map((row) => (
              <div key={row.id} className="vf-card rounded-sm p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg">{row.jobName}</h3>
                    <p className="font-serif text-sm text-ink-faint">
                      {row.contentType ?? "—"} · {row.attempts} / {row.maxAttempts} attempts
                    </p>
                  </div>
                  <QueueRetryButton jobQueueId={row.id} />
                </div>
                {row.errorMessage ? (
                  <p className="mt-2 font-serif text-xs text-red-700">{row.errorMessage}</p>
                ) : null}
                <p className="mt-1 font-serif text-xs text-ink-faint">
                  failed {row.finishedAt?.toISOString().slice(0, 16) ?? "?"} · sent to review{" "}
                  {row.sentToReviewAt?.toISOString().slice(0, 16) ?? "?"}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-2xl">Retrying</h2>
        {dashboard.recentRetrying.length === 0 ? (
          <div className="vf-card rounded-sm p-8 text-center font-serif text-ink-faint">
            No jobs are currently retrying.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {dashboard.recentRetrying.map((row) => (
              <div key={row.id} className="vf-card rounded-sm p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg">{row.jobName}</h3>
                    <p className="font-serif text-sm text-ink-faint">
                      attempt {row.attempts} · next run {row.runAt.toISOString().slice(0, 16)}
                    </p>
                  </div>
                </div>
                {row.lastError ? (
                  <p className="mt-2 font-serif text-xs text-amber-700">{row.lastError}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <QueueFilters
        initial={initialRows.map((r) => ({
          id: r.id,
          jobName: r.jobName,
          contentType: r.contentType,
          status: r.status,
          priority: r.priority,
          attempts: r.attempts,
          maxAttempts: r.maxAttempts,
          runAt: r.runAt.toISOString(),
          finishedAt: r.finishedAt?.toISOString() ?? null,
          errorMessage: r.errorMessage,
          lastError: r.lastError,
          sentToReviewAt: r.sentToReviewAt?.toISOString() ?? null,
        }))}
      />
    </AdminSection>
  );
}
