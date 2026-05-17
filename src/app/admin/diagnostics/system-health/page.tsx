import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { loadSystemHealth, type HealthSeverity } from "@/lib/diagnostics/system-health";
import { AdminSection } from "../../_sections/AdminSection";

export const dynamic = "force-dynamic";

function severityStyle(severity: HealthSeverity): { bg: string; text: string; label: string } {
  switch (severity) {
    case "pass":
      return { bg: "bg-emerald-100", text: "text-emerald-800", label: "OK" };
    case "warn":
      return { bg: "bg-amber-100", text: "text-amber-800", label: "WARN" };
    case "fail":
      return { bg: "bg-red-100", text: "text-red-800", label: "FAIL" };
    case "error":
      return { bg: "bg-red-200", text: "text-red-900", label: "ERROR" };
  }
}

/**
 * Comprehensive 14-card system-health dashboard. Each card displays:
 *
 *   * severity badge (OK / WARN / FAIL / ERROR)
 *   * data source ("which DB table or service feeds this card")
 *   * last updated timestamp
 *   * summary line
 *   * structured details (counts / IDs)
 *   * explicit error state when the underlying query fails — the
 *     UI never shows a false zero
 *
 * The page is read-only — no actions wire here, so the cards do
 * not need CSRF / mutation guards beyond the admin layout's
 * banned-device check and requireAdmin().
 */
export default async function SystemHealthPage() {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  const report = await loadSystemHealth();
  const overall = severityStyle(report.overallSeverity);
  return (
    <AdminSection
      titleKey="admin.card.diagnostics"
      subtitle="Live system health across queue, worker, source pipeline, content factory, strict QA, persistence, cleanup, growth, security, admin email, and database."
    >
      <div className="mb-6 vf-card rounded-sm p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-lg">Overall</h2>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs uppercase ${overall.bg} ${overall.text}`}
          >
            {overall.label}
          </span>
        </div>
        <p className="mt-2 font-serif text-xs text-ink-faint">
          Last run: {report.ranAt.slice(0, 19).replace("T", " ")} UTC
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2" data-testid="system-health-grid">
        {report.cards.map((card) => {
          const style = severityStyle(card.severity);
          return (
            <div
              key={card.id}
              className="vf-card flex h-full flex-col rounded-sm p-5"
              data-testid={`system-health-card-${card.id}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display text-xl">{card.label}</h3>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs uppercase ${style.bg} ${style.text}`}
                >
                  {style.label}
                </span>
              </div>
              <p className="mt-3 font-serif text-sm text-ink-soft">{card.summary}</p>
              {card.errorMessage ? (
                <p
                  className="mt-2 font-mono text-xs text-red-700"
                  data-testid={`system-health-error-${card.id}`}
                >
                  Error: {card.errorMessage}
                </p>
              ) : null}
              <div className="mt-4 grid grid-cols-2 gap-1 font-mono text-[10px] text-ink-faint">
                <span data-testid={`system-health-data-source-${card.id}`}>
                  data source: {card.dataSource}
                </span>
                <span>last updated: {card.lastUpdatedAt.slice(0, 19).replace("T", " ")}</span>
              </div>
            </div>
          );
        })}
      </div>
    </AdminSection>
  );
}
