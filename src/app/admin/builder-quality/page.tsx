import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getBuilderQualityReport } from "@/lib/content-factory/builder-quality";
import { AdminSection } from "../_sections/AdminSection";

export const dynamic = "force-dynamic";

/**
 * Builder quality dashboard.
 *
 * One row per builder with the spec-listed quality dimensions:
 * build attempts, complete packages, QA pass / fail rate, public
 * render / search / sitemap visibility pass rate, duplicate rate,
 * wrong-content rate, top missing fields, and top rejected source
 * hosts — all over a rolling 14-day window.
 */

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function rateClass(rate: number, goodHigh: boolean): string {
  const good = goodHigh ? rate >= 0.8 : rate <= 0.1;
  const bad = goodHigh ? rate < 0.5 : rate > 0.4;
  if (good) return "text-emerald-700";
  if (bad) return "text-red-700";
  return "text-amber-700";
}

export default async function BuilderQualityPage() {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  const report = await getBuilderQualityReport().catch(() => null);
  return (
    <AdminSection
      titleKey="admin.builderQuality.title"
      subtitle={
        report
          ? `${report.rows.length} builders · 14-day window · generated ${report.generatedAt.toISOString()}`
          : "Builder quality report unavailable"
      }
    >
      <div className="mx-auto max-w-6xl">
        {!report ? (
          <div
            className="rounded-2xl border border-red-300 bg-red-50 p-4 font-mono text-xs text-red-800"
            data-testid="builder-quality-error"
          >
            The builder quality report could not be generated.
          </div>
        ) : (
          <div
            className="overflow-x-auto rounded-2xl border border-ink/10 bg-paper p-4"
            data-testid="builder-quality-table-wrap"
          >
            <table
              className="w-full border-collapse font-mono text-xs"
              data-testid="builder-quality-table"
            >
              <thead>
                <tr className="border-b border-ink/10 text-left text-ink-faint">
                  <th className="py-2 pr-3">Builder</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3" title="Build attempts">
                    Att
                  </th>
                  <th className="py-2 pr-3" title="Complete packages built">
                    Cmpl
                  </th>
                  <th className="py-2 pr-3" title="Valid package rate">
                    Valid
                  </th>
                  <th className="py-2 pr-3" title="QA pass rate">
                    QA✓
                  </th>
                  <th className="py-2 pr-3" title="QA failure rate">
                    QA✗
                  </th>
                  <th className="py-2 pr-3" title="Public render pass rate">
                    Render
                  </th>
                  <th className="py-2 pr-3" title="Search visibility pass rate">
                    Search
                  </th>
                  <th className="py-2 pr-3" title="Sitemap visibility pass rate">
                    Sitemap
                  </th>
                  <th className="py-2 pr-3" title="Duplicate rate">
                    Dup
                  </th>
                  <th className="py-2 pr-3" title="Wrong content rate">
                    Wrong
                  </th>
                  <th className="py-2 pr-3">Top missing fields</th>
                  <th className="py-2 pr-3">Top rejected hosts</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr
                    key={`${r.builderName}-${r.contentType}`}
                    className="border-b border-ink/5 align-top"
                    data-testid={`builder-quality-row-${r.contentType}`}
                  >
                    <td className="py-1 pr-3">
                      {r.builderName}
                      <span className="text-ink-faint"> @{r.builderVersion}</span>
                    </td>
                    <td className="py-1 pr-3">{r.contentType}</td>
                    <td className="py-1 pr-3 tabular-nums">{r.totalBuilds}</td>
                    <td className="py-1 pr-3 tabular-nums">{r.buildSuccessCount}</td>
                    <td className={`py-1 pr-3 ${rateClass(r.validPackageRate, true)}`}>
                      {pct(r.validPackageRate)}
                    </td>
                    <td className={`py-1 pr-3 ${rateClass(r.qaPassRate, true)}`}>
                      {pct(r.qaPassRate)}
                    </td>
                    <td className={`py-1 pr-3 ${rateClass(r.qaFailRate, false)}`}>
                      {pct(r.qaFailRate)}
                    </td>
                    <td className={`py-1 pr-3 ${rateClass(r.publicRenderPassRate, true)}`}>
                      {pct(r.publicRenderPassRate)}
                    </td>
                    <td className={`py-1 pr-3 ${rateClass(r.searchVisibilityPassRate, true)}`}>
                      {pct(r.searchVisibilityPassRate)}
                    </td>
                    <td className={`py-1 pr-3 ${rateClass(r.sitemapVisibilityPassRate, true)}`}>
                      {pct(r.sitemapVisibilityPassRate)}
                    </td>
                    <td className={`py-1 pr-3 ${rateClass(r.duplicateRate, false)}`}>
                      {pct(r.duplicateRate)}
                    </td>
                    <td className={`py-1 pr-3 ${rateClass(r.wrongContentRate, false)}`}>
                      {pct(r.wrongContentRate)}
                    </td>
                    <td className="py-1 pr-3 text-ink-soft">
                      {r.topMissingFields.length === 0
                        ? "—"
                        : r.topMissingFields.map((f) => `${f.field} (${f.count})`).join(", ")}
                    </td>
                    <td className="py-1 pr-3 text-ink-soft">
                      {r.topRejectedHosts.length === 0
                        ? "—"
                        : r.topRejectedHosts.map((h) => `${h.host} (${h.count})`).join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminSection>
  );
}
