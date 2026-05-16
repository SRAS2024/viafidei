import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  getContentProgressDashboard,
  getSchedulerModeStatus,
} from "@/lib/data/ingestion-dashboard";
import { AdminSection } from "../../_sections/AdminSection";

export const dynamic = "force-dynamic";

export default async function ContentProgressPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const [rows, mode] = await Promise.all([getContentProgressDashboard(), getSchedulerModeStatus()]);

  return (
    <AdminSection
      titleKey="admin.card.ingestion"
      subtitle="Content type progress — current count vs target, last ingestion, and review queue size."
    >
      <section className="mb-6 vf-card rounded-sm p-5">
        <p className="vf-eyebrow">Scheduler mode</p>
        <div className="mt-1 flex items-center gap-3">
          <span
            className={`font-display text-2xl ${
              mode.mode === "constant" ? "text-amber-700" : "text-emerald-700"
            }`}
          >
            {mode.mode === "constant" ? "CONSTANT" : "MAINTENANCE"}
          </span>
          {mode.dbError ? (
            <span className="rounded-sm bg-amber-100 px-2 py-1 font-serif text-xs text-amber-900">
              DB error — staying in constant mode
            </span>
          ) : null}
        </div>
        <p className="mt-1 font-serif text-sm text-ink-soft">{mode.reason}</p>
        {mode.errorMessage ? (
          <p className="mt-1 font-serif text-xs text-red-700">{mode.errorMessage}</p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 font-display text-2xl">Per content type</h2>
        <div className="flex flex-col gap-3">
          {rows.map((r) => {
            const tone =
              r.percentComplete >= 100
                ? "text-emerald-700"
                : r.percentComplete >= 75
                  ? "text-amber-700"
                  : "text-ink";
            return (
              <div key={r.key} className="vf-card rounded-sm p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-xl">{r.label}</h3>
                    <p className="font-serif text-sm text-ink-faint">
                      {r.currentCount.toLocaleString()} / {r.target.toLocaleString()}
                    </p>
                  </div>
                  <span className={`font-display text-2xl ${tone}`}>
                    {r.percentComplete.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-2 h-2 w-full rounded-sm bg-ink/10">
                  <div
                    className="h-full rounded-sm bg-ink"
                    style={{ width: `${Math.min(100, r.percentComplete)}%` }}
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 font-serif text-xs text-ink-soft sm:grid-cols-4">
                  <span>
                    last ingestion:{" "}
                    {r.lastSuccessfulIngestion
                      ? r.lastSuccessfulIngestion.toISOString().slice(0, 16)
                      : "—"}
                  </span>
                  <span>
                    last update found:{" "}
                    {r.lastContentUpdate ? r.lastContentUpdate.toISOString().slice(0, 16) : "—"}
                  </span>
                  <span>failed sources: {r.failedSourceCount}</span>
                  <span>review queue: {r.reviewQueueCount}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </AdminSection>
  );
}
