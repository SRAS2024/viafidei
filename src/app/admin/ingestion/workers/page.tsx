import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { listWorkerHealth } from "@/lib/ingestion/queue/heartbeat";
import { getQueueHealthSummary } from "@/lib/data/queue-health";
import { AdminSection } from "../../_sections/AdminSection";

export const dynamic = "force-dynamic";

function ms(ageMs: number | null): string {
  if (ageMs == null) return "—";
  if (ageMs < 1_000) return `${ageMs}ms`;
  if (ageMs < 60_000) return `${(ageMs / 1_000).toFixed(1)}s`;
  if (ageMs < 60 * 60_000) return `${(ageMs / 60_000).toFixed(1)}m`;
  return `${(ageMs / (60 * 60_000)).toFixed(1)}h`;
}

export default async function WorkersPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const [workers, health] = await Promise.all([listWorkerHealth(), getQueueHealthSummary()]);

  const healthy = workers.filter((w) => !w.isStale);
  const stale = workers.filter((w) => w.isStale);

  return (
    <AdminSection
      titleKey="admin.card.ingestion"
      subtitle="Worker process dashboard — live workers, stale workers, and queue latency."
    >
      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="vf-card rounded-sm p-4 text-center">
          <p className="vf-eyebrow">Workers alive</p>
          <p className="mt-1 font-display text-3xl text-emerald-700">{health.workersAlive}</p>
        </div>
        <div className="vf-card rounded-sm p-4 text-center">
          <p className="vf-eyebrow">Workers stale</p>
          <p className="mt-1 font-display text-3xl text-amber-700">{health.workersStale}</p>
        </div>
        <div className="vf-card rounded-sm p-4 text-center">
          <p className="vf-eyebrow">Oldest pending</p>
          <p className="mt-1 font-display text-3xl text-ink">{ms(health.oldestPendingAgeMs)}</p>
        </div>
        <div className="vf-card rounded-sm p-4 text-center">
          <p className="vf-eyebrow">Avg wait</p>
          <p className="mt-1 font-display text-3xl text-ink">{ms(health.avgWaitMs)}</p>
        </div>
      </section>

      {health.pendingJobsButNoWorker ? (
        <div className="mb-6 rounded-sm bg-red-100 p-4 font-serif text-sm text-red-900">
          ⚠ Queue has pending jobs but no healthy worker heartbeat. Start a worker:{" "}
          <code>npm run worker</code>.
        </div>
      ) : null}

      <section className="mb-8">
        <h2 className="mb-3 font-display text-2xl">Active workers</h2>
        {healthy.length === 0 ? (
          <div className="vf-card rounded-sm p-8 text-center font-serif text-ink-faint">
            No active workers. Start one with <code>npm run worker</code>.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {healthy.map((w) => (
              <div key={w.workerId} className="vf-card rounded-sm p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base">{w.workerId}</h3>
                    <p className="font-serif text-xs text-ink-faint">
                      status: {w.status} · started {w.startedAt.toISOString().slice(0, 16)}
                    </p>
                  </div>
                  <div className="text-right font-serif text-xs text-ink-faint">
                    <div>last beat: {ms(w.ageMs)} ago</div>
                    <div>
                      processed: {w.processedCount} · retried: {w.retryCount} · failed:{" "}
                      {w.failedCount}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {stale.length > 0 ? (
        <section>
          <h2 className="mb-3 font-display text-2xl">Stale workers</h2>
          <div className="flex flex-col gap-3">
            {stale.map((w) => (
              <div key={w.workerId} className="vf-card rounded-sm p-5 opacity-75">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base">{w.workerId}</h3>
                    <p className="font-serif text-xs text-ink-faint">
                      last beat {ms(w.ageMs)} ago · status: {w.status}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </AdminSection>
  );
}
