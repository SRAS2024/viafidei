import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listDeletedInvalidContent } from "@/lib/content-qa";
import { AdminSection } from "../../_sections/AdminSection";

export const dynamic = "force-dynamic";

/**
 * Deleted Invalid Content Log — every reject / delete decision the
 * strict content QA pipeline made. One row per decision with the title,
 * content type attempted, source URL/host, delete reason, failed
 * contract name, failed fields, and date.
 */
export default async function DeletedContentLogPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const rows = await listDeletedInvalidContent(300).catch(() => []);

  return (
    <AdminSection
      titleKey="admin.contentQA.deletedLog"
      subtitle="Every rejection and deletion made by the strict content QA pipeline."
    >
      <div className="mt-8 overflow-x-auto">
        <table className="vf-table w-full text-left font-serif text-sm">
          <thead className="text-xs uppercase tracking-wider text-ink-soft">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Content type</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Decision</th>
              <th className="px-3 py-2">Contract</th>
              <th className="px-3 py-2">Failed fields</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2">Triggered by</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-ink-faint/40 align-top">
                <td className="px-3 py-2 whitespace-nowrap text-ink-soft">
                  {row.deletedAt.toISOString().slice(0, 19).replace("T", " ")}
                </td>
                <td className="px-3 py-2 font-medium text-ink">{row.contentType}</td>
                <td className="px-3 py-2">{row.originalTitle ?? row.slug ?? "—"}</td>
                <td className="px-3 py-2 max-w-xs truncate">
                  {row.sourceUrl ? (
                    <span title={row.sourceUrl}>{row.sourceHost ?? row.sourceUrl}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 uppercase">{row.decision}</td>
                <td className="px-3 py-2">{row.failedContractName ?? "—"}</td>
                <td className="px-3 py-2">
                  {row.failedFields.length > 0 ? row.failedFields.join(", ") : "—"}
                </td>
                <td className="px-3 py-2 max-w-md">{row.rejectionReason}</td>
                <td className="px-3 py-2">{row.triggeredBy}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-ink-soft" colSpan={9}>
                  No deletions yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="mt-8 text-center font-serif text-sm text-ink-soft">
        <Link href="/admin/content-qa/dashboard" className="vf-nav-link">
          ← Back to Content QA dashboard
        </Link>
      </div>
    </AdminSection>
  );
}
