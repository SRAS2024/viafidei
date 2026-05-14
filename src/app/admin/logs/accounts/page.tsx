import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { listRecentAuditLogs } from "@/lib/data/audit-log";
import { AdminSection } from "../../_sections/AdminSection";

export const dynamic = "force-dynamic";

const ACCOUNT_ENTITY_TYPES = new Set(["User", "Profile", "Session"]);

export default async function AccountAuditLogPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const rows = await listRecentAuditLogs();
  // The audit-log table mixes account actions with content actions — for
  // the Accounts logs view we surface only the rows touching User /
  // Profile / Session, but render the full audit row for forensic
  // reference. Rows targeting other entities are shown under
  // /admin/logs/admin.
  const accountRows = rows.filter((r) => ACCOUNT_ENTITY_TYPES.has(r.entityType));

  return (
    <AdminSection
      titleKey="admin.card.logs"
      subtitle="Account audit log — sign-ups, profile changes, password resets, role changes, and other per-user actions."
    >
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link href="/admin/logs" className="vf-nav-link">
          ← Logs
        </Link>
        <Link href="/admin/logs/admin" className="vf-nav-link">
          Admin actions →
        </Link>
        <Link href="/admin/logs/data-management" className="vf-nav-link">
          Data Management →
        </Link>
      </div>

      <div className="vf-card overflow-x-auto rounded-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-xs uppercase tracking-[0.2em] text-ink-faint">
              <th className="px-4 py-4 sm:px-5">When</th>
              <th className="px-4 py-4 sm:px-5">Actor</th>
              <th className="px-4 py-4 sm:px-5">Action</th>
              <th className="px-4 py-4 sm:px-5">Entity</th>
              <th className="hidden px-4 py-4 sm:table-cell sm:px-5">IP</th>
            </tr>
          </thead>
          <tbody>
            {accountRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center font-serif text-ink-faint">
                  No account audit records yet.
                </td>
              </tr>
            ) : (
              accountRows.map((r) => (
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
