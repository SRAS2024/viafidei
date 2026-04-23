import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { AdminSection } from "../_sections/AdminSection";

export default async function AdminAudit() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const rows = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <AdminSection titleKey="admin.card.audit">
      <div className="vf-card rounded-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-xs uppercase tracking-[0.2em] text-ink-faint">
              <th className="px-5 py-4">When</th>
              <th className="px-5 py-4">Actor</th>
              <th className="px-5 py-4">Action</th>
              <th className="px-5 py-4">Entity</th>
              <th className="px-5 py-4">IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center font-serif text-ink-faint">
                  No audit records yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-ink/5 font-serif">
                  <td className="px-5 py-3 text-ink-faint">{r.createdAt.toISOString()}</td>
                  <td className="px-5 py-3">{r.actorUsername ?? "—"}</td>
                  <td className="px-5 py-3">{r.action}</td>
                  <td className="px-5 py-3 text-ink-soft">
                    {r.entityType}:{r.entityId}
                  </td>
                  <td className="px-5 py-3 text-ink-faint">{r.ipAddress ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminSection>
  );
}
