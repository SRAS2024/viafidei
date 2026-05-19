import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getTabDiagnosticsReport } from "@/lib/diagnostics/tab-diagnostics";
import { AdminSection } from "../_sections/AdminSection";

export const dynamic = "force-dynamic";

/**
 * Admin "tab diagnostics" page (spec §18).
 *
 * One row per public tab with the spec-listed fields so the operator
 * can answer "which tabs are healthy?" at a glance and "what is
 * stalling tab X?" with one click.
 */
export default async function TabDiagnosticsPage() {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  const report = await getTabDiagnosticsReport();

  return (
    <AdminSection
      titleKey="admin.tabDiagnostics.title"
      subtitle={`${report.rows.length} public tabs · generated ${report.generatedAt.toISOString()}`}
    >
      <div
        className="mx-auto max-w-6xl rounded-2xl border border-ink/10 bg-paper px-5 py-4"
        data-testid="tab-diagnostics-table"
      >
        <table className="w-full font-mono text-xs">
          <thead className="text-ink-soft">
            <tr className="text-left">
              <th className="py-1">Tab</th>
              <th className="py-1">Content type</th>
              <th className="py-1">Public</th>
              <th className="py-1">Threshold</th>
              <th className="py-1">Hidden</th>
              <th className="py-1">Last added</th>
              <th className="py-1">Last deleted</th>
              <th className="py-1">Stall reason</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr
                key={row.tab}
                className="border-t border-ink/5"
                data-testid={`tab-diagnostics-row-${row.tab}`}
                data-tab-stall={row.growthStallReason ?? ""}
              >
                <td className="py-1 font-semibold text-ink">{row.label}</td>
                <td className="py-1">{row.contentType}</td>
                <td
                  className={`py-1 ${row.publicCount === 0 ? "text-red-800" : "text-emerald-700"}`}
                >
                  {row.publicCount}
                </td>
                <td className="py-1">{row.thresholdCount}</td>
                <td className={`py-1 ${row.hiddenCount > 0 ? "text-amber-800" : ""}`}>
                  {row.hiddenCount}
                </td>
                <td className="py-1">{row.lastPackageAddedAt?.toISOString() ?? "—"}</td>
                <td className="py-1">{row.lastPackageDeletedAt?.toISOString() ?? "—"}</td>
                <td className="py-1">
                  {row.growthStallReason ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 uppercase tracking-wider text-red-900">
                      {row.growthStallReason.replace(/_/g, " ")}
                    </span>
                  ) : (
                    <span className="text-emerald-700">healthy</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminSection>
  );
}
