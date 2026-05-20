import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getBaselineAuditReport } from "@/lib/diagnostics/baseline-audit";
import { AdminSection } from "../_sections/AdminSection";

export const dynamic = "force-dynamic";

/**
 * Baseline content audit dashboard.
 *
 * Traces every baseline fixture from its source URL through to the
 * public catalog: source documents, build attempts, complete
 * builds, public packages, failures, and failure reasons.
 */

const STATUS_CLASS: Record<string, string> = {
  complete: "text-emerald-700",
  failed: "font-semibold text-red-700",
  pending: "text-amber-700",
};

export default async function BaselineAuditPage() {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  const report = await getBaselineAuditReport().catch(() => null);

  return (
    <AdminSection
      titleKey="admin.baselineAudit.title"
      subtitle={
        report
          ? `${report.totalPublicPackages}/${report.rows.length} baseline fixtures public · ${report.totalSourceDocuments} source docs · ${report.totalBuildAttempts} build attempts · ${report.totalFailures} failures`
          : "Baseline audit unavailable"
      }
    >
      {!report ? (
        <div className="mx-auto max-w-5xl rounded-2xl border border-red-300 bg-red-50 p-4 font-mono text-xs text-red-800">
          The baseline content audit could not be generated.
        </div>
      ) : (
        <div className="mx-auto max-w-5xl space-y-4">
          <div
            className={`rounded-2xl border p-4 font-mono text-xs ${
              report.healthy
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-amber-300 bg-amber-50 text-amber-900"
            }`}
            data-testid="baseline-audit-summary"
          >
            {report.healthy
              ? "Every baseline fixture reached the public catalog through the content factory."
              : `${report.rows.length - report.totalPublicPackages} baseline fixture(s) have not reached the public catalog.`}
          </div>
          <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-paper p-4">
            <table
              className="w-full border-collapse font-mono text-xs"
              data-testid="baseline-audit-table"
            >
              <thead>
                <tr className="border-b border-ink/10 text-left text-ink-faint">
                  <th className="py-2 pr-3">Content type</th>
                  <th className="py-2 pr-3">Slug</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3" title="Source document created">
                    Src doc
                  </th>
                  <th className="py-2 pr-3" title="Build attempts">
                    Builds
                  </th>
                  <th className="py-2 pr-3" title="Complete builds">
                    Complete
                  </th>
                  <th className="py-2 pr-3" title="Public package exists">
                    Public
                  </th>
                  <th className="py-2 pr-3">Failures</th>
                  <th className="py-2 pr-3">Failure reasons</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr
                    key={`${r.contentType}-${r.slug}`}
                    className="border-b border-ink/5 align-top"
                    data-testid={`baseline-audit-row-${r.slug}`}
                  >
                    <td className="py-1 pr-3">{r.contentType}</td>
                    <td className="py-1 pr-3 text-ink-soft">{r.slug}</td>
                    <td className={`py-1 pr-3 ${STATUS_CLASS[r.status] ?? ""}`}>{r.status}</td>
                    <td className="py-1 pr-3">{r.sourceDocumentCreated ? "yes" : "no"}</td>
                    <td className="py-1 pr-3 tabular-nums">{r.buildAttempts}</td>
                    <td className="py-1 pr-3 tabular-nums">{r.completeBuilds}</td>
                    <td className="py-1 pr-3">{r.publicPackage ? "yes" : "no"}</td>
                    <td className="py-1 pr-3 tabular-nums">{r.failures}</td>
                    <td className="py-1 pr-3 text-ink-soft">
                      {r.failureReasons.length === 0 ? "—" : r.failureReasons.join("; ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminSection>
  );
}
