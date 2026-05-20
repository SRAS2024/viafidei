import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { buildSourcePlanReport } from "@/lib/ingestion/sources/source-plan";
import { AdminSection } from "../_sections/AdminSection";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-900",
  warn: "bg-amber-100 text-amber-900",
  fail: "bg-red-100 text-red-900",
};

/**
 * Admin "Production source plan" page.
 *
 * Shows the spec-required readiness columns per content type:
 *   - required source count (the minimum)
 *   - configured source count (any source carrying the purpose flag)
 *   - factory-ready source count (active + non-paused + valid
 *     discovery method + non-rejected role)
 *   - validation source count
 *   - enrichment source count
 *   - shortfall + status
 *
 * Production readiness FAILS when any major content type has zero
 * factory-ready sources; WARNS when below the configured minimum.
 */
export default async function SourcePlanPage() {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  const report = await buildSourcePlanReport();

  return (
    <AdminSection
      titleKey="admin.sourcePlan.title"
      subtitle={`${report.rows.length} major content types · ${report.underMinimum} below minimum · ${report.zeroFactoryReady} with zero factory-ready sources`}
    >
      <div
        className="mx-auto max-w-6xl rounded-2xl border border-ink/10 bg-paper px-5 py-4"
        data-testid="source-plan-table"
      >
        <table className="w-full font-mono text-xs">
          <thead className="text-ink-soft">
            <tr className="text-left">
              <th className="py-1">Content type</th>
              <th className="py-1">Required</th>
              <th className="py-1">Configured</th>
              <th className="py-1">Factory-ready</th>
              <th className="py-1">Validation</th>
              <th className="py-1">Enrichment</th>
              <th className="py-1">Health</th>
              <th className="py-1">Shortfall</th>
              <th className="py-1">Status</th>
              <th className="py-1">Next automatic repair</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr
                key={row.contentType}
                className="border-t border-ink/5"
                data-testid={`source-plan-row-${row.contentType}`}
                data-source-plan-status={row.status}
                data-source-health={row.sourceHealth}
              >
                <td className="py-1 font-semibold text-ink">{row.contentType}</td>
                <td className="py-1">{row.required}</td>
                <td className="py-1">{row.configured}</td>
                <td className="py-1">{row.factoryReady}</td>
                <td className="py-1">{row.validationSources}</td>
                <td className="py-1">{row.enrichmentSources}</td>
                <td className="py-1">{row.sourceHealth}</td>
                <td className="py-1">{row.shortfall}</td>
                <td className="py-1">
                  <span
                    className={`rounded-full px-2 py-0.5 uppercase tracking-wider ${
                      STATUS_STYLES[row.status] ?? "bg-ink/10 text-ink"
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="py-1 text-ink-soft">{row.nextAutomaticRepairAction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {report.zeroFactoryReady > 0 && (
        <div
          className="mx-auto mt-6 max-w-6xl rounded-2xl border border-red-300 bg-red-50 px-5 py-4"
          data-testid="source-plan-zero-warning"
        >
          <h2 className="font-serif text-base font-semibold text-red-900">
            Production readiness FAILS — content type(s) have zero factory-ready sources
          </h2>
          <p className="mt-1 font-serif text-sm text-red-950">
            The factory cannot build content for these tabs until at least one source with a valid
            discovery method (sitemap / RSS / fixed URL list / official API / factory handler) is
            configured and approved for that content type.
          </p>
        </div>
      )}
      {report.zeroFactoryReady === 0 && report.underMinimum > 0 && (
        <div
          className="mx-auto mt-6 max-w-6xl rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4"
          data-testid="source-plan-under-minimum-warning"
        >
          <h2 className="font-serif text-base font-semibold text-amber-900">
            {report.underMinimum} content type(s) below the configured minimum source count
          </h2>
          <p className="mt-1 font-serif text-sm text-amber-950">
            Adding more factory-ready sources for these tabs will improve growth resilience and
            cross-source validation coverage.
          </p>
        </div>
      )}
    </AdminSection>
  );
}
