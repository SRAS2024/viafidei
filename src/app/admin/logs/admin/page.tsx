import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { listRecentAuditLogs } from "@/lib/data/audit-log";
import { AdminSection } from "../../_sections/AdminSection";

export const dynamic = "force-dynamic";

const ACCOUNT_ENTITY_TYPES = new Set(["User", "Profile", "Session"]);

export default async function AdminActionsLogPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const rows = await listRecentAuditLogs();
  // Admin actions logs cover every row that is NOT a per-user account
  // action — content edits, settings, homepage edits, diagnostics
  // triggers, data-management toggles, etc.
  const adminRows = rows.filter((r) => !ACCOUNT_ENTITY_TYPES.has(r.entityType));

  return (
    <AdminSection
      titleKey="admin.card.logs"
      subtitle="Admin actions — changes admins make across the site: homepage edits, content page edits, settings, diagnostics actions, data-management toggles."
    >
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link href="/admin/logs" className="vf-nav-link">
          ← Logs
        </Link>
        <Link href="/admin/logs/accounts" className="vf-nav-link">
          Account audit →
        </Link>
        <Link href="/admin/logs/worker" className="vf-nav-link">
          Worker build log →
        </Link>
      </div>

      <div className="vf-card overflow-x-auto rounded-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-xs uppercase tracking-[0.2em] text-ink-faint">
              <th className="px-4 py-4 sm:px-5">When</th>
              <th className="px-4 py-4 sm:px-5">Admin</th>
              <th className="px-4 py-4 sm:px-5">Action</th>
              <th className="px-4 py-4 sm:px-5">Area</th>
              <th className="hidden px-4 py-4 sm:table-cell sm:px-5">IP</th>
            </tr>
          </thead>
          <tbody>
            {adminRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center font-serif text-ink-faint">
                  No admin actions logged yet.
                </td>
              </tr>
            ) : (
              adminRows.map((r) => (
                <tr key={r.id} className="border-b border-ink/5 font-serif">
                  <td className="px-4 py-3 text-ink-faint sm:px-5">
                    {r.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  </td>
                  <td className="px-4 py-3 sm:px-5">{r.actorUsername ?? "—"}</td>
                  <td className="break-words px-4 py-3 sm:px-5">{r.action}</td>
                  <td className="break-words px-4 py-3 text-ink-soft sm:px-5">
                    {r.entityType}:{r.entityId.slice(0, 16)}
                  </td>
                  <td className="hidden px-4 py-3 text-ink-faint sm:table-cell sm:px-5">
                    {r.ipAddress ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminSection>
  );
}
