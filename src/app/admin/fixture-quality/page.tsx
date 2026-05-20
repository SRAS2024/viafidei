import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getFixtureQualityReport } from "@/lib/content-factory/fixture-quality";
import { AdminSection } from "../_sections/AdminSection";

export const dynamic = "force-dynamic";

/**
 * Fixture quality diagnostics dashboard.
 *
 * One row per builder showing fixture counts, valid-fixture pass
 * count, invalid-fixture rejection count, false positives, false
 * negatives, and any missing fixture-coverage areas.
 */
export default async function FixtureQualityPage() {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  const report = getFixtureQualityReport();

  return (
    <AdminSection
      titleKey="admin.fixtureQuality.title"
      subtitle={
        report.healthy
          ? `${report.rows.length} builders · fixture suite discriminates valid from invalid cleanly`
          : `${report.rows.length} builders · fixture suite has false positives or negatives — review below`
      }
    >
      <div className="mx-auto max-w-6xl">
        <div
          className="overflow-x-auto rounded-2xl border border-ink/10 bg-paper p-4"
          data-testid="fixture-quality-table-wrap"
        >
          <table
            className="w-full border-collapse font-mono text-xs"
            data-testid="fixture-quality-table"
          >
            <thead>
              <tr className="border-b border-ink/10 text-left text-ink-faint">
                <th className="py-2 pr-3">Content type</th>
                <th className="py-2 pr-3">Builder</th>
                <th className="py-2 pr-3" title="valid / invalid / messy fixture counts">
                  Fixtures (v/i/m)
                </th>
                <th className="py-2 pr-3" title="Valid + messy fixtures that built">
                  Valid pass
                </th>
                <th className="py-2 pr-3" title="Invalid fixtures the builder rejected">
                  Invalid reject
                </th>
                <th className="py-2 pr-3" title="Invalid fixtures that wrongly built">
                  False +
                </th>
                <th className="py-2 pr-3" title="Valid fixtures that wrongly failed">
                  False −
                </th>
                <th className="py-2 pr-3">Missing coverage</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r) => (
                <tr
                  key={r.contentType}
                  className="border-b border-ink/5"
                  data-testid={`fixture-quality-row-${r.contentType}`}
                >
                  <td className="py-1 pr-3">{r.contentType}</td>
                  <td className="py-1 pr-3 text-ink-soft">
                    {r.builderName}
                    <span className="text-ink-faint"> @{r.builderVersion}</span>
                  </td>
                  <td className="py-1 pr-3 tabular-nums">
                    {r.validCount}/{r.invalidCount}/{r.messyCount}
                  </td>
                  <td className="py-1 pr-3 tabular-nums">{r.validPassCount}</td>
                  <td className="py-1 pr-3 tabular-nums">{r.invalidRejectionCount}</td>
                  <td
                    className={`py-1 pr-3 tabular-nums ${
                      r.falsePositiveCount > 0 ? "font-semibold text-red-700" : "text-emerald-700"
                    }`}
                  >
                    {r.falsePositiveCount}
                  </td>
                  <td
                    className={`py-1 pr-3 tabular-nums ${
                      r.falseNegativeCount > 0 ? "text-amber-700" : "text-emerald-700"
                    }`}
                  >
                    {r.falseNegativeCount}
                  </td>
                  <td className="py-1 pr-3 text-ink-soft">
                    {r.missingCoverageAreas.length === 0 ? "—" : r.missingCoverageAreas.join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 font-mono text-[11px] text-ink-faint">
            A false positive (invalid content that built) is a hard fixture-suite failure. A false
            negative can be expected for builders that assemble from multiple merged source
            documents (Rosary, Consecration).
          </p>
        </div>
      </div>
    </AdminSection>
  );
}
