import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { listSourceHealth } from "@/lib/data/source-health";
import { tierLabel } from "@/lib/ingestion/source-tier";
import { AdminSection } from "../../_sections/AdminSection";

export const dynamic = "force-dynamic";

const HEALTH_LABELS: Record<string, { label: string; tone: string }> = {
  active: { label: "Active", tone: "text-emerald-700" },
  stale: { label: "Stale", tone: "text-amber-700" },
  failing: { label: "Failing", tone: "text-red-700" },
  blocked: { label: "Blocked", tone: "text-red-800" },
  exhausted: { label: "Exhausted", tone: "text-ink-soft" },
  low_quality: { label: "Low quality", tone: "text-amber-800" },
  paused: { label: "Paused", tone: "text-ink-faint" },
};

function describeHealth(state: string) {
  return HEALTH_LABELS[state] ?? { label: state, tone: "text-ink-soft" };
}

export default async function SourceHealthPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const rows = await listSourceHealth();

  const counts: Record<string, number> = {};
  for (const r of rows) {
    counts[r.healthState] = (counts[r.healthState] ?? 0) + 1;
  }

  return (
    <AdminSection
      titleKey="admin.card.ingestion"
      subtitle="Source health dashboard — active, stale, failing, blocked, exhausted, or low-quality sources at a glance."
    >
      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {Object.keys(HEALTH_LABELS).map((state) => {
          const { label, tone } = describeHealth(state);
          return (
            <div key={state} className="vf-card rounded-sm p-4 text-center">
              <p className="vf-eyebrow">{label}</p>
              <p className={`mt-1 font-display text-3xl ${tone}`}>{counts[state] ?? 0}</p>
            </div>
          );
        })}
      </section>

      <section>
        <h2 className="mb-3 font-display text-2xl">Sources</h2>
        {rows.length === 0 ? (
          <div className="vf-card rounded-sm p-8 text-center font-serif text-ink-faint">
            No ingestion sources registered yet.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map((s) => {
              const { label, tone } = describeHealth(s.healthState);
              return (
                <div key={s.id} className="vf-card rounded-sm p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="vf-eyebrow">{tierLabel(s.tier)}</p>
                      <h3 className="mt-1 font-display text-xl">{s.name}</h3>
                      <p className="font-serif text-sm text-ink-faint">{s.host}</p>
                    </div>
                    <span className={`font-display text-sm ${tone}`}>{label}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 font-serif text-xs text-ink-soft sm:grid-cols-4">
                    <span>
                      last ok:{" "}
                      {s.lastSuccessfulSync ? s.lastSuccessfulSync.toISOString().slice(0, 16) : "—"}
                    </span>
                    <span>
                      last fail:{" "}
                      {s.lastFailedSync ? s.lastFailedSync.toISOString().slice(0, 16) : "—"}
                    </span>
                    <span>
                      last content update:{" "}
                      {s.lastContentUpdateAt
                        ? s.lastContentUpdateAt.toISOString().slice(0, 16)
                        : "—"}
                    </span>
                    <span>
                      HTTP: {s.lastHttpStatus ?? "—"} · failures: {s.consecutiveFailures}
                    </span>
                    {s.lowQualityRatio != null ? (
                      <span>low-quality ratio: {(s.lowQualityRatio * 100).toFixed(0)}%</span>
                    ) : null}
                    {s.pausedAt ? (
                      <span className="text-ink-soft">
                        paused {s.pausedAt.toISOString().slice(0, 16)}: {s.pausedReason ?? ""}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </AdminSection>
  );
}
