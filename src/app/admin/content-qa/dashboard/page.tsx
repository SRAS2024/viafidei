import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getContentQADashboard } from "@/lib/content-qa";
import { AdminSection } from "../../_sections/AdminSection";

export const dynamic = "force-dynamic";

/**
 * Strict Content QA dashboard. Shows valid / public / threshold-eligible
 * / rejected / deleted / review / removed-from-public-view counts per
 * content type, plus the per-bucket failure breakdown
 * (source-purpose / render-readiness / wrong-content /
 * package-completeness).
 *
 * Read-only — the rejected log and the audit pipeline make every
 * decision automatically; this page exists so the operator can verify
 * the system is doing the right thing.
 */
export default async function ContentQADashboardPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const rows = await getContentQADashboard().catch(() => []);

  return (
    <AdminSection
      titleKey="admin.contentQA.title"
      subtitle="Strict content QA — package validation outcomes per content type."
    >
      <div className="mt-8 overflow-x-auto">
        <table className="vf-table w-full text-left font-serif text-sm">
          <thead className="text-xs uppercase tracking-wider text-ink-soft">
            <tr>
              <th className="px-3 py-2">Content type</th>
              <th className="px-3 py-2">Raw rows</th>
              <th className="px-3 py-2">Valid</th>
              <th className="px-3 py-2">Public</th>
              <th className="px-3 py-2">Threshold-eligible</th>
              <th className="px-3 py-2">Review</th>
              <th className="px-3 py-2">Rejected</th>
              <th className="px-3 py-2">Deleted invalid</th>
              <th className="px-3 py-2">Hidden from public</th>
              <th className="px-3 py-2">Failing source</th>
              <th className="px-3 py-2">Failing render</th>
              <th className="px-3 py-2">Failing wrong-content</th>
              <th className="px-3 py-2">Failing completeness</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.contentType} className="border-t border-ink-faint/40">
                <td className="px-3 py-2 font-medium text-ink">{row.contentType}</td>
                <td className="px-3 py-2">{row.rawRows.toLocaleString()}</td>
                <td className="px-3 py-2">{row.validPackages.toLocaleString()}</td>
                <td className="px-3 py-2">{row.publicPackages.toLocaleString()}</td>
                <td className="px-3 py-2">{row.thresholdEligible.toLocaleString()}</td>
                <td className="px-3 py-2">{row.reviewRows.toLocaleString()}</td>
                <td className="px-3 py-2">{row.rejectedPackages.toLocaleString()}</td>
                <td className="px-3 py-2">{row.deletedInvalidRows.toLocaleString()}</td>
                <td className="px-3 py-2">{row.removedFromPublicView.toLocaleString()}</td>
                <td className="px-3 py-2">{row.failingSourcePurpose.toLocaleString()}</td>
                <td className="px-3 py-2">{row.failingRenderReadiness.toLocaleString()}</td>
                <td className="px-3 py-2">{row.failingWrongContent.toLocaleString()}</td>
                <td className="px-3 py-2">{row.failingPackageCompleteness.toLocaleString()}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-ink-soft" colSpan={13}>
                  No content QA data yet — run the strict cleanup job to populate.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="mt-8 text-center font-serif text-sm text-ink-soft">
        <Link href="/admin/content-qa/deleted-log" className="vf-nav-link">
          View deleted invalid content log →
        </Link>
      </div>
    </AdminSection>
  );
}
