import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getProductionReadinessReport } from "@/lib/diagnostics/production-readiness";
import type { ContentTypeReadinessRow } from "@/lib/diagnostics/content-type-readiness";
import { AdminSection } from "../_sections/AdminSection";

export const dynamic = "force-dynamic";

const CHECK_GLYPH: Record<string, string> = {
  pass: "ok",
  warn: "warn",
  fail: "FAIL",
  na: "—",
};
const CHECK_CLASS: Record<string, string> = {
  pass: "text-emerald-700",
  warn: "text-amber-700",
  fail: "font-semibold text-red-700",
  na: "text-ink-faint",
};

/** Per-content-type readiness drill-down rendered inside its card. */
function ContentTypeReadinessDetail({ details }: { details?: Record<string, unknown> }) {
  const rows = (details?.rows as ContentTypeReadinessRow[] | undefined) ?? [];
  if (rows.length === 0) return null;
  return (
    <div className="mt-3 overflow-x-auto" data-testid="content-type-readiness-detail">
      <table className="w-full border-collapse font-mono text-xs">
        <thead>
          <tr className="border-b border-ink/20 text-left">
            <th className="py-1 pr-3">Content type</th>
            <th className="py-1 pr-3">Tab</th>
            <th className="py-1 pr-3" title="At least one factory-ready source configured">
              Source
            </th>
            <th className="py-1 pr-3" title="Canary fixture builds through the builder chain">
              Canary
            </th>
            <th className="py-1 pr-3" title="Strict public tab query can load">
              Public tab
            </th>
            <th className="py-1 pr-3" title="Cache revalidation tag mapped">
              Cache tag
            </th>
            <th className="py-1 pr-3">Strict packages</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.contentType}
              className="border-b border-ink/10"
              data-testid={`readiness-type-${r.contentType}`}
            >
              <td className="py-1 pr-3">{r.contentType}</td>
              <td className="py-1 pr-3 text-ink-soft">{r.tab}</td>
              <td className={`py-1 pr-3 ${CHECK_CLASS[r.checks.sourceConfigured]}`}>
                {CHECK_GLYPH[r.checks.sourceConfigured]}
              </td>
              <td className={`py-1 pr-3 ${CHECK_CLASS[r.checks.canaryBuild]}`}>
                {CHECK_GLYPH[r.checks.canaryBuild]}
              </td>
              <td className={`py-1 pr-3 ${CHECK_CLASS[r.checks.publicDisplay]}`}>
                {CHECK_GLYPH[r.checks.publicDisplay]}
              </td>
              <td className={`py-1 pr-3 ${CHECK_CLASS[r.checks.cacheTag]}`}>
                {CHECK_GLYPH[r.checks.cacheTag]}
              </td>
              <td className="py-1 pr-3">{r.strictPublicCount ?? "err"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Production readiness page. Reads every spec-listed category
 * (environment variables, database, worker, queue, content factory,
 * email, security, source configuration, public display) and renders
 * one card per category with severity + summary + lastUpdatedAt +
 * dataSource. Data flows through the production-readiness helper so
 * the rendered values cannot drift from the API response.
 */
export default async function ProductionReadinessPage() {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  const report = await getProductionReadinessReport().catch(() => null);
  if (!report) {
    return (
      <AdminSection
        titleKey="admin.productionReadiness.title"
        subtitle="Could not load production readiness report"
      >
        <div className="mx-auto max-w-6xl rounded-2xl border border-ink/10 bg-paper p-6">
          <p className="font-serif text-ink-soft">
            The production-readiness helper failed to execute. Check the server logs and confirm
            database connectivity.
          </p>
        </div>
      </AdminSection>
    );
  }
  const SEVERITY_STYLES: Record<string, string> = {
    pass: "bg-emerald-50 text-emerald-900 border-emerald-200",
    warn: "bg-amber-50 text-amber-900 border-amber-200",
    fail: "bg-red-50 text-red-900 border-red-200",
    error: "bg-red-100 text-red-950 border-red-300",
  };
  const SEVERITY_LABEL: Record<string, string> = {
    pass: "PASS",
    warn: "WARN",
    fail: "FAIL",
    error: "ERROR",
  };
  return (
    <AdminSection
      titleKey="admin.productionReadiness.title"
      subtitle={`Generated ${report.generatedAt.toISOString()} — worst severity: ${SEVERITY_LABEL[report.worst] ?? report.worst.toUpperCase()}`}
    >
      <div className="mx-auto max-w-6xl space-y-4" data-testid="production-readiness-cards">
        {report.cards.map((card) => (
          <div
            key={card.id}
            className={`rounded-2xl border px-5 py-4 ${SEVERITY_STYLES[card.severity] ?? "border-ink/10 bg-paper"}`}
            data-testid={`readiness-card-${card.id}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-serif text-lg font-semibold">{card.label}</h3>
              <span className="font-mono text-xs uppercase tracking-wider">
                {SEVERITY_LABEL[card.severity] ?? card.severity}
              </span>
            </div>
            <p className="mt-2 font-serif text-sm">{card.summary}</p>
            {card.id === "content_type_readiness" ? (
              <ContentTypeReadinessDetail details={card.details} />
            ) : null}
            <div className="mt-2 flex flex-wrap gap-3 font-mono text-xs text-ink-soft">
              <span data-testid={`readiness-card-${card.id}-data-source`}>
                source: {card.dataSource}
              </span>
              <span data-testid={`readiness-card-${card.id}-updated-at`}>
                updated: {card.lastUpdatedAt.toISOString()}
              </span>
            </div>
            {card.errorMessage && (
              <p className="mt-2 font-mono text-xs text-red-900">{card.errorMessage}</p>
            )}
          </div>
        ))}
      </div>
    </AdminSection>
  );
}
